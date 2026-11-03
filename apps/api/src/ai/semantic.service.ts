import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, pages, pageVersions } from '../db/schema/index.js';
import { AiService } from './ai.service.js';

/** Embeddings live outside the Drizzle schema: the table exists only where pgvector does. */
const TABLE = 'semantic_embeddings';
const STATUS_MS = 60_000;
const BATCH = 8;
const INDEX_TIMEOUT_MS = 180_000;
/** After a failed batch the worker waits this long instead of asking the model again at once. */
const PAUSE_AFTER_FAILURE_MS = 5 * 60_000;
/** Characters of an issue or page that go into its embedding. */
const TEXT_LIMIT = 8_000;
/**
 * HNSW indexes `vector` up to 2,000 dimensions and `halfvec` (half precision) up to 4,000;
 * larger embeddings are searched exactly.
 */
const MAX_VECTOR_DIMENSIONS = 2_000;
const MAX_INDEXED_DIMENSIONS = 4_000;
/** Nearest candidates a semantic clause hands to the rest of the query. */
export const SEMANTIC_CANDIDATES = 100;

export type EmbeddingKind = 'issue' | 'page';

/** A query text as vector, for the SQL below. */
export interface QueryVector {
  literal: string;
  dimensions: number;
  model: string;
}

/** The type compared for one dimension count, as the index has it; never user text. */
function typeName(dimensions: number): string {
  if (!Number.isInteger(dimensions) || dimensions < 1) throw new Error('Invalid dimensions');
  const base =
    dimensions > MAX_VECTOR_DIMENSIONS && dimensions <= MAX_INDEXED_DIMENSIONS
      ? 'halfvec'
      : 'vector';
  return `${base}(${dimensions})`;
}

function vectorType(dimensions: number): SQL {
  return sql.raw(typeName(dimensions));
}

/** Ids of the nearest issues or pages; the partial HNSW index serves it (literal dimensions). */
export function nearestIds(kind: EmbeddingKind, query: QueryVector, limit: number): SQL {
  const type = vectorType(query.dimensions);
  return sql`select target_id from ${sql.raw(TABLE)}
    where kind = ${kind} and model = ${query.model} and dimensions = ${sql.raw(String(query.dimensions))}
    order by embedding::${type} <=> ${query.literal}::${type} limit ${limit}`;
}

/** Cosine distance of one issue or page to the query; null without an embedding. */
export function distanceTo(kind: EmbeddingKind, query: QueryVector, id: SQLWrapper): SQL {
  const type = vectorType(query.dimensions);
  return sql`(select embedding::${type} <=> ${query.literal}::${type} from ${sql.raw(TABLE)}
    where kind = ${kind} and target_id = ${id} and model = ${query.model}
      and dimensions = ${sql.raw(String(query.dimensions))})`;
}

function literal(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Semantic search (TL-49, E-139): embeddings of issues and published pages, made by the
 * configured model and kept current by the worker, searched with pgvector. Without pgvector or
 * an embedding model nothing of it runs and searches by meaning report that.
 */
@Injectable()
export class SemanticService {
  private status: { at: number; vector: Promise<boolean> } | undefined;
  private readonly indexed = new Set<number>();
  private readonly queries = new Map<string, QueryVector>();
  private pausedUntil = 0;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(AiService) private readonly ai: AiService,
  ) {}

  /** Whether pgvector is installed; installs it and the table when the database offers it. */
  vectorAvailable(): Promise<boolean> {
    // One check at a time: two would race to create the extension.
    if (!this.status || Date.now() - this.status.at > STATUS_MS) {
      this.status = { at: Date.now(), vector: this.checkVector() };
    }
    return this.status.vector;
  }

  private async checkVector(): Promise<boolean> {
    let vector = false;
    try {
      const [offered] = await this.database.sql<{ installed: boolean }[]>`
        select installed_version is not null as installed from pg_available_extensions
        where name = 'vector'`;
      if (offered && !offered.installed) {
        // Needs a superuser, as in the shipped setup; otherwise an admin installs it once.
        await this.database.sql`create extension if not exists vector`;
      }
      if (offered) {
        await this.database.sql.unsafe(`create table if not exists ${TABLE} (
          kind text not null,
          target_id uuid not null,
          model text not null,
          dimensions integer not null,
          content_hash text not null,
          embedding vector not null,
          updated_at timestamptz not null default now(),
          primary key (kind, target_id))`);
        vector = true;
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'pgvector is not usable; semantic search stays off');
    }
    return vector;
  }

  /** Whether searches by meaning work: pgvector and an embedding model. */
  async available(): Promise<boolean> {
    const config = await this.ai.config();
    return !!config.baseUrl && !!config.embeddingModel && (await this.vectorAvailable());
  }

  /** The query text as vector; null when semantic search is not available. */
  async queryVector(text: string): Promise<QueryVector | null> {
    if (!(await this.available())) return null;
    const { embeddingModel } = await this.ai.config();
    const key = `${embeddingModel}\n${text}`;
    const cached = this.queries.get(key);
    if (cached) return cached;
    const { model, vectors } = await this.ai.embed([text.slice(0, TEXT_LIMIT)]);
    const vector = vectors[0] ?? [];
    const result = { literal: literal(vector), dimensions: vector.length, model };
    // Paging through results asks again with the same text.
    if (this.queries.size >= 200) this.queries.delete(this.queries.keys().next().value ?? '');
    this.queries.set(key, result);
    return result;
  }

  async indexedCounts(): Promise<{ issues: number; pages: number }> {
    if (!(await this.vectorAvailable())) return { issues: 0, pages: 0 };
    const { embeddingModel } = await this.ai.config();
    const rows = await this.database.sql<{ kind: string; n: number }[]>`
      select kind, count(*)::int as n from semantic_embeddings
      where model = ${embeddingModel} group by kind`;
    const of = (kind: string) => rows.find((row) => row.kind === kind)?.n ?? 0;
    return { issues: of('issue'), pages: of('page') };
  }

  /**
   * Embeds issues and published pages that have none, an older text or another model, a batch
   * per kind; afterwards drops embeddings of what is gone. Returns how many it embedded.
   */
  async indexPending(): Promise<number> {
    if (Date.now() < this.pausedUntil || !(await this.available())) return 0;
    try {
      return await this.indexBatch();
    } catch (error) {
      this.pausedUntil = Date.now() + PAUSE_AFTER_FAILURE_MS;
      throw error;
    }
  }

  private async indexBatch(): Promise<number> {
    const { embeddingModel } = await this.ai.config();
    const db = this.database.db;
    const stale = (kind: EmbeddingKind, id: SQLWrapper, hash: SQL) =>
      sql`not exists (select 1 from ${sql.raw(TABLE)} e where e.kind = ${kind}
        and e.target_id = ${id} and e.model = ${embeddingModel} and e.content_hash = ${hash})`;

    const issueText = sql<string>`left(${issues.key} || ': ' || ${issues.summary} || E'\n\n' || ${issues.descriptionText}, ${TEXT_LIMIT})`;
    const issueHash = sql<string>`md5(${issueText})`;
    const issueRows = await db
      .select({ id: issues.id, text: issueText, hash: issueHash })
      .from(issues)
      .where(and(isNull(issues.deletedAt), stale('issue', issues.id, issueHash)))
      .limit(BATCH);

    const pageText = sql<string>`left(${pages.title} || E'\n\n' || ${pageVersions.text}, ${TEXT_LIMIT})`;
    const pageHash = sql<string>`md5(${pageText})`;
    const pageRows = await db
      .select({ id: pages.id, text: pageText, hash: pageHash })
      .from(pages)
      .innerJoin(
        pageVersions,
        and(eq(pageVersions.pageId, pages.id), eq(pageVersions.number, pages.version)),
      )
      .where(and(isNull(pages.deletedAt), gt(pages.version, 0), stale('page', pages.id, pageHash)))
      .limit(BATCH);

    let embedded = 0;
    for (const [kind, rows] of [
      ['issue', issueRows],
      ['page', pageRows],
    ] as const) {
      if (rows.length === 0) continue;
      const { model, vectors } = await this.ai.embed(
        rows.map((row) => row.text),
        INDEX_TIMEOUT_MS,
      );
      const dimensions = vectors[0]?.length ?? 0;
      await this.ensureIndex(dimensions);
      for (const [index, row] of rows.entries()) {
        const vector = literal(vectors[index] ?? []);
        await this.database.sql`
          insert into semantic_embeddings (kind, target_id, model, dimensions, content_hash, embedding)
          values (${kind}, ${row.id}, ${model}, ${dimensions}, ${row.hash}, ${vector}::vector)
          on conflict (kind, target_id) do update set model = excluded.model,
            dimensions = excluded.dimensions, content_hash = excluded.content_hash,
            embedding = excluded.embedding, updated_at = now()`;
      }
      embedded += rows.length;
    }
    if (embedded === 0) {
      await this.database.sql`
        delete from semantic_embeddings e where (e.kind = 'issue' and not exists (
          select 1 from issues i where i.id = e.target_id and i.deleted_at is null))
        or (e.kind = 'page' and not exists (
          select 1 from pages p where p.id = e.target_id and p.deleted_at is null and p.version > 0))`;
    }
    return embedded;
  }

  /** One partial HNSW index per dimension count in use. */
  private async ensureIndex(dimensions: number): Promise<void> {
    if (this.indexed.has(dimensions) || dimensions > MAX_INDEXED_DIMENSIONS) return;
    const type = typeName(dimensions);
    const ops = type.startsWith('halfvec') ? 'halfvec_cosine_ops' : 'vector_cosine_ops';
    await this.database.sql.unsafe(
      `create index if not exists ${TABLE}_hnsw_${dimensions} on ${TABLE}
       using hnsw ((embedding::${type}) ${ops}) where dimensions = ${dimensions}`,
    );
    this.indexed.add(dimensions);
  }
}
