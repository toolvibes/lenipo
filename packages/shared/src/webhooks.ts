import { z } from 'zod';

/** Events a webhook can subscribe to (D-HOOK-01). */
export const WEBHOOK_EVENT_TYPES = [
  'issue.created',
  'issue.updated',
  'issue.transitioned',
  'comment.created',
  'comment.updated',
  'comment.deleted',
] as const;
export const WebhookEventType = z.enum(WEBHOOK_EVENT_TYPES).meta({ id: 'WebhookEventType' });
export type WebhookEventType = z.infer<typeof WebhookEventType>;

const WebhookUrl = z.url({ protocol: /^https?$/ }).max(2_000);

export const Webhook = z
  .object({
    id: z.uuid(),
    name: z.string(),
    url: z.string(),
    events: z.array(WebhookEventType),
    /** Limited to these projects; empty means all. */
    projectKeys: z.array(z.string()),
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
