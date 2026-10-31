import { trace } from '@opentelemetry/api';
import { pino } from 'pino';
import type { AppConfig } from './config.js';

export type Logger = pino.Logger;

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { app: 'tasklore' },
    // With tracing on, every line names its trace, so logs and traces meet (TL-42).
    mixin() {
      const context = trace.getActiveSpan()?.spanContext();
      return context ? { trace_id: context.traceId, span_id: context.spanId } : {};
    },
  });
}
