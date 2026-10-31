import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export function createDatabase(url: string) {
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  const root = drizzle(sql, { schema, casing: 'snake_case' });
  const scope = new AsyncLocalStorage<typeof root>();
  return {
    sql,
    /** The database, or inside {@link atomic} its transaction; services need not pass it on. */
    get db(): typeof root {
      return scope.getStore() ?? root;
    },
    /**
     * Runs `work` with every `db` use in one transaction, e.g. an all-or-nothing bulk change
     * (TL-41, E-122); transactions inside become savepoints.
     */
    atomic<T>(work: () => Promise<T>): Promise<T> {
      return root.transaction((tx) => scope.run(tx as unknown as typeof root, work));
    },
  };
}

export type DatabaseHandle = ReturnType<typeof createDatabase>;
export type Database = DatabaseHandle['db'];
/** A transaction handle, accepted wherever a query may run inside or outside a transaction. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;

/** True for PostgreSQL unique-constraint violations (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (
    typeof cause === 'object' && cause !== null && (cause as { code?: string }).code === '23505'
  );
}
