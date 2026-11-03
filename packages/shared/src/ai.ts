import { z } from 'zod';

/**
 * The AI extension (TL-49, E-139): one OpenAI-compatible endpoint (Ollama, vLLM, LocalAI,
 * OpenAI, Mistral …) for embeddings and chat. Off as long as no address is set.
 */
export const AiSettings = z
  .object({
    /** Base address ending before `/embeddings` and `/chat/completions`, e.g. …/v1; empty: off. */
    baseUrl: z.string(),
    /** The key is never sent back. */
    hasApiKey: z.boolean(),
    chatModel: z.string(),
    embeddingModel: z.string(),
    /** Text before every search and every document, as some embedding models expect. */
    queryPrefix: z.string(),
    documentPrefix: z.string(),
    /** Calls of the automation action per day, across all rules. */
    dailyLimit: z.number().int(),
    usedToday: z.number().int(),
    /** Whether the database has pgvector; without it there is no semantic search. */
    vectorAvailable: z.boolean(),
    /** Issues and pages with an embedding of the current model. */
    indexed: z.object({ issues: z.number().int(), pages: z.number().int() }),
  })
  .meta({ id: 'AiSettings' });
export type AiSettings = z.infer<typeof AiSettings>;

export const UpdateAiSettingsRequest = z
  .object({
    baseUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/ })]),
    /** Left out: unchanged; empty: removed. */
    apiKey: z.string().max(1_000).optional(),
    chatModel: z.string().trim().max(200),
    embeddingModel: z.string().trim().max(200),
    queryPrefix: z.string().max(500).default(''),
    documentPrefix: z.string().max(500).default(''),
    dailyLimit: z.number().int().min(0).max(1_000_000),
  })
  .meta({ id: 'UpdateAiSettingsRequest' });
export type UpdateAiSettingsRequest = z.infer<typeof UpdateAiSettingsRequest>;

/** What a test call to both models returned. */
export const AiTestResult = z
  .object({
    chat: z.object({ ok: z.boolean(), detail: z.string() }),
    embeddings: z.object({ ok: z.boolean(), detail: z.string() }),
  })
  .meta({ id: 'AiTestResult' });
export type AiTestResult = z.infer<typeof AiTestResult>;

/** Whether searches by meaning work right now, for the toggle in the search. */
export const SemanticStatus = z.object({ available: z.boolean() }).meta({ id: 'SemanticStatus' });
export type SemanticStatus = z.infer<typeof SemanticStatus>;
