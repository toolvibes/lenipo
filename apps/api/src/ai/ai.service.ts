import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiTestResult, UpdateAiSettingsRequest } from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { aiUsage, systemSettings } from '../db/schema/index.js';

const KEY = 'ai';
const CACHE_MS = 10_000;
const CHAT_TIMEOUT_MS = 60_000;
/** For a search; indexing in the worker may wait longer (local models on a CPU are slow). */
const EMBEDDING_TIMEOUT_MS = 30_000;
/** Longest answer kept for `{{ai.response}}`. */
const RESPONSE_LIMIT = 20_000;

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  /** Written before every query and every document; some models expect it (TL-108). */
  queryPrefix: string;
  documentPrefix: string;
  dailyLimit: number;
}

const DEFAULTS: AiConfig = {
  baseUrl: '',
  apiKey: '',
  chatModel: '',
  embeddingModel: '',
  queryPrefix: '',
  documentPrefix: '',
  dailyLimit: 200,
};

/** The model answered with an error or not at all; the message says which. */
export class AiCallError extends HttpException {
  constructor(message: string) {
    super(message, 502);
  }
}

/**
 * The connection to the language model (TL-49, E-139): one OpenAI-compatible endpoint for
 * embeddings and chat, set by admins. The key is kept like the LDAP bind password: in the
 * database, never sent back.
 */
@Injectable()
export class AiService {
  private cached: { at: number; value: AiConfig } | undefined;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async config(): Promise<AiConfig> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.value;
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, KEY));
    const value = { ...DEFAULTS, ...((row?.value as Partial<AiConfig>) ?? {}) };
    this.cached = { at: Date.now(), value };
    return value;
  }

  async save(principal: Principal, request: UpdateAiSettingsRequest): Promise<void> {
    const current = await this.config();
    const next: AiConfig = {
      baseUrl: request.baseUrl.replace(/\/+$/, ''),
      apiKey: request.apiKey === undefined ? current.apiKey : request.apiKey,
      chatModel: request.chatModel,
      embeddingModel: request.embeddingModel,
      queryPrefix: request.queryPrefix,
      documentPrefix: request.documentPrefix,
      dailyLimit: request.dailyLimit,
    };
    await this.database.db
      .insert(systemSettings)
      .values({ key: KEY, value: next })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: next, updatedAt: sql`now()` },
      });
    this.cached = undefined;
    const { apiKey, ...details } = next;
    await this.audit.record({
      action: 'system.ai_settings_changed',
      actorId: principal.userId,
      via: principal.via,
      details: { ...details, apiKeyChanged: request.apiKey !== undefined },
    });
  }

  async usedToday(): Promise<number> {
    const [row] = await this.database.db
      .select({ calls: aiUsage.chatCalls })
      .from(aiUsage)
      .where(eq(aiUsage.day, sql`current_date`));
    return row?.calls ?? 0;
  }

  /** Counts a chat call, or refuses it when today's calls reached the limit. */
  private async takeChatCall(limit: number): Promise<void> {
    if (limit === 0) throw new AiCallError('The AI action is switched off (daily limit 0).');
    const taken = await this.database.db
      .insert(aiUsage)
      .values({ day: sql`current_date`, chatCalls: 1 })
      .onConflictDoUpdate({
        target: aiUsage.day,
        set: { chatCalls: sql`${aiUsage.chatCalls} + 1` },
        setWhere: sql`${aiUsage.chatCalls} < ${limit}`,
      })
      .returning({ calls: aiUsage.chatCalls });
    if (taken.length === 0) {
      throw new AiCallError(`The daily limit of ${limit} AI calls is reached.`);
    }
  }

  private async post(config: AiConfig, path: string, body: unknown, timeoutMs: number) {
    if (!config.baseUrl) throw new ServiceUnavailableException('No AI model is set up.');
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AiCallError(`The model did not answer: ${(error as Error).message}`);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new AiCallError(`The model answered ${response.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiCallError('The model did not answer with JSON.');
    }
  }

  /** One answer to a prompt; counted against the daily limit. */
  async chat(prompt: string): Promise<string> {
    const config = await this.config();
    if (!config.baseUrl || !config.chatModel) {
      throw new ServiceUnavailableException('No chat model is set up.');
    }
    await this.takeChatCall(config.dailyLimit);
    const body = (await this.post(
      config,
      '/chat/completions',
      { model: config.chatModel, messages: [{ role: 'user', content: prompt }] },
      CHAT_TIMEOUT_MS,
    )) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiCallError('The model sent no answer.');
    return content.trim().slice(0, RESPONSE_LIMIT);
  }

  /** Embeddings of the texts, in their order; `model` names what made them. */
  async embed(
    texts: string[],
    timeoutMs = EMBEDDING_TIMEOUT_MS,
  ): Promise<{ model: string; vectors: number[][] }> {
    const config = await this.config();
    if (!config.baseUrl || !config.embeddingModel) {
      throw new ServiceUnavailableException('No embedding model is set up.');
    }
    const body = (await this.post(
      config,
      '/embeddings',
      { model: config.embeddingModel, input: texts },
      timeoutMs,
    )) as { data?: Array<{ index?: number; embedding?: unknown }> };
    const data = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = data.map((entry) => entry.embedding);
    if (
      vectors.length !== texts.length ||
      !vectors.every(
        (vector): vector is number[] =>
          Array.isArray(vector) &&
          vector.length > 0 &&
          vector.length === (vectors[0] as unknown[]).length &&
          vector.every((value) => typeof value === 'number' && Number.isFinite(value)),
      )
    ) {
      throw new AiCallError('The model sent no usable embeddings.');
    }
    await this.database.db
      .insert(aiUsage)
      .values({ day: sql`current_date`, embeddingCalls: 1 })
      .onConflictDoUpdate({
        target: aiUsage.day,
        set: { embeddingCalls: sql`${aiUsage.embeddingCalls} + 1` },
      });
    return { model: config.embeddingModel, vectors };
  }

  /** Tries both models once; the chat call counts against the limit like any other. */
  async test(): Promise<AiTestResult> {
    const config = await this.config();
    if (!config.baseUrl) throw new BadRequestException('Set the address of the model first.');
    const attempt = async (run: () => Promise<string>) => {
      try {
        return { ok: true, detail: await run() };
      } catch (error) {
        return { ok: false, detail: (error as Error).message };
      }
    };
    return {
      chat: config.chatModel
        ? await attempt(async () =>
            (await this.chat('Reply with the single word: OK')).slice(0, 200),
          )
        : { ok: false, detail: 'No chat model is set.' },
      embeddings: config.embeddingModel
        ? await attempt(async () => {
            const { vectors } = await this.embed(['Lenipo']);
            return `${vectors[0]?.length ?? 0} dimensions`;
          })
        : { ok: false, detail: 'No embedding model is set.' },
    };
  }
}
