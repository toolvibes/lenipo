import { createServer, type Server } from 'node:http';
import type { Request, Response } from 'express';
import client from 'prom-client';
import type { DatabaseHandle } from '../db/client.js';
import type { Logger } from './logger.js';

/**
 * Prometheus metrics (P-OPS-04, TL-42, E-123), served on their own port so they are never
 * public: Node defaults, HTTP latency per route, open connections and the work waiting in the
 * database.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpDuration = new client.Histogram({
  name: 'tasklore_http_request_duration_seconds',
  help: 'Duration of HTTP requests by method, route template and status',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** Times every request; the route is the template (/api/v1/issues/:key), never the raw path. */
export function httpMetrics(request: Request, response: Response, next: () => void): void {
  const end = httpDuration.startTimer();
  response.on('finish', () => {
    const route = request.route?.path
      ? `${request.baseUrl}${request.route.path}`
      : response.statusCode === 404
        ? 'unmatched'
        : 'static';
    end({ method: request.method, route, status: String(response.statusCode) });
  });
  next();
}

const counters = new Map<string, () => number>();

/** Open realtime or collab connections, counted when Prometheus asks. */
export function countConnections(kind: string, count: () => number): void {
  counters.set(kind, count);
}

new client.Gauge({
  name: 'tasklore_connections',
  help: 'Open WebSocket connections by kind (realtime, collab)',
  labelNames: ['kind'],
  registers: [registry],
  collect() {
    for (const [kind, count] of counters) this.set({ kind }, count());
  },
});

/** Queues and lags read from PostgreSQL on every scrape; cheap counts on indexed columns. */
export function databaseMetrics(database: DatabaseHandle): void {
  type Row = Record<'events' | 'webhooks' | 'automation' | 'imports' | 'emails' | 'lag', number>;
  // One query per scrape, shared by the gauges below.
  let cached: { at: number; value: Promise<Row | null> } | undefined;
  const read = () => {
    if (!cached || Date.now() - cached.at > 1_000) {
      cached = {
        at: Date.now(),
        value: database.sql<Row[]>`
          select
            (select count(*)::int from domain_events where processed_at is null) as events,
            coalesce((select extract(epoch from now() - min(created_at))::float
              from domain_events where processed_at is null), 0) as lag,
            (select count(*)::int from webhook_deliveries where status = 'pending') as webhooks,
            (select count(*)::int from automation_queue) as automation,
            (select count(*)::int from import_jobs where state in ('pending', 'running')) as imports,
            (select count(*)::int from notifications where email_pending) as emails`.then(
          (rows) => rows[0] ?? null,
          () => null,
        ),
      };
    }
    return cached.value;
  };
  new client.Gauge({
    name: 'tasklore_backlog',
    help: 'Work waiting in the database by queue',
    labelNames: ['queue'],
    registers: [registry],
    async collect() {
      const row = await read();
      if (!row) return;
      for (const queue of ['events', 'webhooks', 'automation', 'imports', 'emails'] as const)
        this.set({ queue }, row[queue]);
    },
  });
  new client.Gauge({
    name: 'tasklore_outbox_lag_seconds',
    help: 'Age of the oldest unprocessed domain event',
    registers: [registry],
    async collect() {
      const row = await read();
      if (row) this.set(row.lag);
    },
  });
  new client.Gauge({
    name: 'tasklore_database_up',
    help: '1 if PostgreSQL answered the last scrape',
    registers: [registry],
    async collect() {
      this.set((await read()) ? 1 : 0);
    },
  });
}

/** The metrics endpoint on METRICS_PORT; GET /metrics only. */
export function startMetricsServer(port: number, logger: Logger): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url?.split('?')[0] !== '/metrics') {
      response.writeHead(404).end();
      return;
    }
    registry.metrics().then(
      (text) => {
        response.writeHead(200, { 'content-type': registry.contentType }).end(text);
      },
      (error: unknown) => {
        logger.error({ err: error }, 'Metrics failed');
        response.writeHead(500).end();
      },
    );
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
