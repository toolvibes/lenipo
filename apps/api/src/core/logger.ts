import { pino } from 'pino';
import type { AppConfig } from './config.js';

export type Logger = pino.Logger;

export function createLogger(config: AppConfig): Logger {
  return pino({ level: config.LOG_LEVEL, base: { app: 'tasklore' } });
}
