import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import postgres from 'postgres';
import { createApiApp } from '../api-app.js';
import { loadConfig } from '../core/config.js';
import { createLogger } from '../core/logger.js';
import { createDatabase, type DatabaseHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

const DEFAULT_URL = 'postgres://tasklore:tasklore@localhost:5440/tasklore';

export interface TestApp {
  app: NestExpressApplication;
  database: DatabaseHandle;
  baseUrl: string;
  close(): Promise<void>;
}

/** Starts the real API against a fresh, migrated database that is dropped again on close. */
export async function startTestApp(): Promise<TestApp> {
  const serverUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_URL;
  const name = `tasklore_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;

  const config = loadConfig({
    DATABASE_URL: url.toString(),
    NODE_ENV: 'test',
    LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? 'fatal',
  });
  const database = createDatabase(config.DATABASE_URL);
  await runMigrations(database);
  const app = await createApiApp({ config, database, logger: createLogger(config) });
  await app.listen(0, '127.0.0.1');
  const baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1`;

  return {
    app,
    database,
    baseUrl,
    async close() {
      await app.close();
      await database.sql.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

/** A tiny HTTP client that keeps the session cookie like a browser would. */
export class TestClient {
  cookie: string | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly defaults: Record<string, string> = {},
  ) {}

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...this.defaults,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie()[0];
    if (setCookie) {
      this.cookie = setCookie.split(';')[0];
    }
    const text = await response.text();
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : undefined) as T,
      headers: response.headers,
    };
  }
}
