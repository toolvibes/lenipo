import { z } from 'zod';

/** Events a webhook can subscribe to (D-HOOK-01). */
export const WEBHOOK_EVENT_TYPES = [
  'issue.created',
  'issue.updated',
  'issue.transitioned',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'worklog.created',
  'worklog.updated',
  'worklog.deleted',
  // Pages, sprints and versions (D-HOOK-01/-02, TL-41, E-122).
  'page.published',
  'page.commented',
  'sprint.started',
  'sprint.completed',
  'version.released',
] as const;
export const WebhookEventType = z.enum(WEBHOOK_EVENT_TYPES).meta({ id: 'WebhookEventType' });
export type WebhookEventType = z.infer<typeof WebhookEventType>;

const WebhookUrl = z.url({ protocol: /^https?$/ }).max(2_000);

/**
 * What a webhook sends (P-NTF-05, E-112): the signed JSON payload, or a readable chat message
 * for an incoming webhook of Slack, Microsoft Teams (Workflows), Mattermost or Rocket.Chat.
 */
export const WEBHOOK_FORMATS = ['standard', 'slack', 'teams', 'mattermost', 'rocketchat'] as const;
export const WebhookFormat = z.enum(WEBHOOK_FORMATS).meta({ id: 'WebhookFormat' });
export type WebhookFormat = z.infer<typeof WebhookFormat>;

export const Webhook = z
  .object({
    id: z.uuid(),
    name: z.string(),
    url: z.string(),
    events: z.array(WebhookEventType),
    /** Limited to these projects; empty means all. */
    projectKeys: z.array(z.string()),
    /** Transitions only into these statuses; empty means all (TL-75, E-86). */
    statusIds: z.array(z.uuid()),
    /** Issue events only for issues matching this TQL, with the creator's rights (TL-41). */
    tql: z.string().nullable(),
    /** Page events only from these spaces; empty means all. */
    spaceKeys: z.array(z.string()),
    format: WebhookFormat,
    /** Language of chat messages. */
    locale: z.enum(['de', 'en']),
    enabled: z.boolean(),
    disabledReason: z.string().nullable(),
    failingSince: z.iso.datetime().nullable(),
    lastDelivery: z
      .object({
        status: z.enum(['pending', 'succeeded', 'failed']),
        responseStatus: z.number().int().nullable(),
        at: z.iso.datetime(),
      })
      .nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Webhook' });
export type Webhook = z.infer<typeof Webhook>;

/** Only returned when a webhook is created or its secret rotated. */
export const WebhookSecret = z.object({ secret: z.string() }).meta({ id: 'WebhookSecret' });
export type WebhookSecret = z.infer<typeof WebhookSecret>;

export const CreatedWebhook = Webhook.extend({ secret: z.string() }).meta({ id: 'CreatedWebhook' });
export type CreatedWebhook = z.infer<typeof CreatedWebhook>;

export const CreateWebhookRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: WebhookUrl,
    events: z.array(WebhookEventType).min(1),
    projectKeys: z.array(z.string().min(1)).max(100).default([]),
    statusIds: z.array(z.uuid()).max(100).default([]),
    tql: z.string().trim().max(2_000).nullable().default(null),
    spaceKeys: z.array(z.string().min(1)).max(100).default([]),
    format: WebhookFormat.default('standard'),
    locale: z.enum(['de', 'en']).default('de'),
    enabled: z.boolean().default(true),
  })
  .meta({ id: 'CreateWebhookRequest' });
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequest>;

export const UpdateWebhookRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: WebhookUrl,
    events: z.array(WebhookEventType).min(1),
    projectKeys: z.array(z.string().min(1)).max(100),
    statusIds: z.array(z.uuid()).max(100),
    tql: z.string().trim().max(2_000).nullable(),
    spaceKeys: z.array(z.string().min(1)).max(100),
    format: WebhookFormat,
    locale: z.enum(['de', 'en']),
    enabled: z.boolean(),
  })
  .partial()
  .meta({ id: 'UpdateWebhookRequest' });
export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookRequest>;

export const WebhookDelivery = z
  .object({
    id: z.uuid(),
    type: z.string(),
    status: z.enum(['pending', 'succeeded', 'failed']),
    attempts: z.number().int(),
    nextAttemptAt: z.iso.datetime().nullable(),
    lastAttemptAt: z.iso.datetime().nullable(),
    responseStatus: z.number().int().nullable(),
    responseBody: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'WebhookDelivery' });
export type WebhookDelivery = z.infer<typeof WebhookDelivery>;
