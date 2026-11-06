import { trace } from '@opentelemetry/api';
import { pino } from 'pino';
import type { AppConfig } from './config.js';

export type Logger = pino.Logger;

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { app: 'lenipo' },
    // Defence in depth: secrets in logged objects never reach the log (TL-44).
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-lenipo-token"]',
        'req.headers["x-setup-code"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.secret',
        '*.bindPassword',
      ],
      censor: '[redacted]',
    },
    // With tracing on, every line names its trace, so logs and traces meet (TL-42).
    mixin() {
      const context = trace.getActiveSpan()?.spanContext();
      return context ? { trace_id: context.traceId, span_id: context.spanId } : {};
    },
  });
}
