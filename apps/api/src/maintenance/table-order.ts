import type { Sql, TransactionSql } from 'postgres';

export interface TableInfo {
  name: string;
  /** Columns that can be written: everything except generated ones. */
  columns: string[];
  primaryKey: string[];
  /**
   * Foreign key columns written after all rows are in, because they point at the same table
   * or close a cycle between tables.
   */
  deferred: string[];
}

/**
 * The tables of the current schema in an order in which rows can be inserted without breaking
 * a foreign key (TL-39, E-120). Self-references and cycles are broken by deferring nullable
 * foreign key columns.
 */
export async function tableOrder(
  sql: Sql | TransactionSql,
  skip: readonly string[] = [],
): Promise<TableInfo[]> {
  const columns = await sql<
    { table_name: string; column_name: string; is_generated: string; is_nullable: string }[]
  >`
    select c.table_name, c.column_name, c.is_generated, c.is_nullable
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = current_schema() and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position`;
  const keys = await sql<{ table_name: string; kind: string; target: string; columns: string[] }[]>`
    select src.relname as table_name, con.contype as kind, ref.relname as target,
      array(select a.attname::text from unnest(con.conkey) k
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k) as columns
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_namespace n on n.oid = src.relnamespace
    left join pg_class ref on ref.oid = con.confrelid
    where n.nspname = current_schema() and con.contype in ('p', 'f')`;

  const tables = new Map<string, TableInfo>();
  const nullable = new Set<string>();
  for (const column of columns) {
    if (skip.includes(column.table_name)) continue;
    const table = tables.get(column.table_name) ?? {
      name: column.table_name,
      columns: [],
      primaryKey: [],
      deferred: [],
    };
    tables.set(column.table_name, table);
    if (column.is_generated !== 'ALWAYS') table.columns.push(column.column_name);
    if (column.is_nullable === 'YES') nullable.add(`${column.table_name}.${column.column_name}`);
  }
  const edges: Array<{ from: string; to: string; columns: string[] }> = [];
  for (const key of keys) {
    const table = tables.get(key.table_name);
    if (!table) continue;
    if (key.kind === 'p') table.primaryKey = key.columns;
    else if (key.target === key.table_name) table.deferred.push(...key.columns);
    else if (tables.has(key.target)) edges.push({ from: key.table_name, to: key.target, ...key });
  }

  const ordered: TableInfo[] = [];
  const remaining = new Set(tables.keys());
  let open = edges;
  while (remaining.size > 0) {
    const blocked = new Set(open.filter((edge) => remaining.has(edge.to)).map((edge) => edge.from));
    const ready = [...remaining].filter((name) => !blocked.has(name)).sort();
    if (ready.length === 0) {
      // A cycle: defer one nullable foreign key inside it and try again.
      const breakable = open.find(
        (edge) =>
          remaining.has(edge.from) &&
          remaining.has(edge.to) &&
          edge.columns.every((column) => nullable.has(`${edge.from}.${column}`)),
      );
      if (!breakable) throw new Error('The tables form a cycle of required foreign keys');
      tables.get(breakable.from)?.deferred.push(...breakable.columns);
      open = open.filter((edge) => edge !== breakable);
      continue;
    }
    for (const name of ready) {
      remaining.delete(name);
      ordered.push(tables.get(name) as TableInfo);
    }
  }
  return ordered;
}
