import { z } from 'zod';
import { Id } from './identity.js';
import { RichTextInput, RichTextOutput, StatusInfo, UserRef } from './tracking.js';

/**
 * Service desk (TL-47, E-137): a project with a customer portal, request types, internal notes
 * and SLAs. Customers file and follow their own requests in the portal only.
 */
export const ServiceDeskSettings = z
  .object({
    /** list: the customers named below; everyone: everyone signed in. */
    customerAccess: z.enum(['list', 'everyone']),
    intro: z.string().max(2000),
    /** SLA targets in working hours by priority key; missing means no target. */
    firstResponseHours: z.record(z.string(), z.number().positive().max(10_000)),
    resolutionHours: z.record(z.string(), z.number().positive().max(10_000)),
    /** Statuses in which the clocks pause while waiting for the customer. */
    pauseStatusIds: z.array(Id),
    timeZone: z.string().min(1).max(64),
    dayStartHour: z.number().int().min(0).max(23),
    /**
     * Mail from people without an account becomes a request: they get an external account without
     * a password, as a customer of this desk only (E-168). Needs a passed SPF, DKIM or DMARC check.
     */
    acceptUnknownSenders: z.boolean().default(false),
    /** With unknown senders: only these mail domains; empty means any. */
    allowedDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Eine Domain wie beispiel.de'),
      )
      .max(50)
      .default([]),
  })
  .meta({ id: 'ServiceDeskSettings' });
export type ServiceDeskSettings = z.infer<typeof ServiceDeskSettings>;

export const RequestType = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    issueType: z.object({ key: z.string(), name: z.string() }),
    /** Optional fields the form asks: priority, dueDate or custom field ids. */
    fields: z.array(z.string()),
  })
  .meta({ id: 'RequestType' });
export type RequestType = z.infer<typeof RequestType>;

export const SaveRequestTypeRequest = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).default(''),
    issueType: z.string().min(1),
    fields: z.array(z.string().max(64)).max(20).default([]),
  })
  .meta({ id: 'SaveRequestTypeRequest' });
export type SaveRequestTypeRequest = z.infer<typeof SaveRequestTypeRequest>;

export const ServiceCustomer = z
  .object({
    id: Id,
    user: UserRef.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
  })
  .meta({ id: 'ServiceCustomer' });
export type ServiceCustomer = z.infer<typeof ServiceCustomer>;

export const AddServiceCustomerRequest = z
  .union([z.strictObject({ userId: Id }), z.strictObject({ groupId: Id })])
  .meta({ id: 'AddServiceCustomerRequest' });
export type AddServiceCustomerRequest = z.infer<typeof AddServiceCustomerRequest>;

/** For project administrators: the settings, request types and customers. */
export const ServiceDesk = z
  .object({
    settings: ServiceDeskSettings,
    requestTypes: z.array(RequestType),
    customers: z.array(ServiceCustomer),
    /** Where customers go: /portal/KEY. */
    portalPath: z.string(),
    /** Requests from other systems, e.g. a form on a website (E-168). */
    inbound: z.object({
      /** Where they post: /api/v1/service-desk/inbound/KEY. */
      path: z.string(),
      /** Whether a token is set; the token itself is only shown once. */
      enabled: z.boolean(),
      tokenCreatedAt: z.iso.datetime().nullable(),
    }),
  })
  .meta({ id: 'ServiceDesk' });

/** A new token for the inbound endpoint; the old one stops working at once. */
export const InboundToken = z
  .object({ secret: z.string(), path: z.string() })
  .meta({ id: 'InboundToken' });
export type InboundToken = z.infer<typeof InboundToken>;

/**
 * A request from another system, e.g. a contact form (E-168). The person is found by email or
 * gets an external account without a password, as a customer of this desk.
 */
export const InboundServiceRequest = z
  .object({
    email: z.email().max(254).describe('The person asking; answers reach them at this address.'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Their name in Lenipo; without it the part of the address before the @.'),
    requestType: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe('Id or name of a request type of the desk; without it the first one.'),
    summary: z.string().trim().min(1).max(255).describe('Short title of the request.'),
    description: z.string().max(20_000).optional().describe('Plain text or Markdown.'),
    priority: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .describe('Priority key such as high; only if the request type asks for it.'),
    dueDate: z.iso.date().optional().describe('Due date, only if the request type asks for it.'),
    customFields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Values by custom field id, as far as the request type asks for them.'),
  })
  .meta({ id: 'InboundServiceRequest' });
export type InboundServiceRequest = z.infer<typeof InboundServiceRequest>;

export const InboundServiceResponse = z
  .object({ key: z.string() })
  .meta({ id: 'InboundServiceResponse' });
export type InboundServiceResponse = z.infer<typeof InboundServiceResponse>;
export type ServiceDesk = z.infer<typeof ServiceDesk>;

/** A desk as a customer sees it. */
export const PortalDesk = z
  .object({
    key: z.string(),
    name: z.string(),
    intro: z.string(),
    requestTypes: z.array(RequestType),
  })
  .meta({ id: 'PortalDesk' });
export type PortalDesk = z.infer<typeof PortalDesk>;

export const CreatePortalRequest = z
  .object({
    requestTypeId: Id,
    summary: z.string().trim().min(1).max(255),
    description: RichTextInput.optional(),
    priority: z.string().min(1).optional(),
    dueDate: z.iso.date().optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .meta({ id: 'CreatePortalRequest' });
export type CreatePortalRequest = z.infer<typeof CreatePortalRequest>;

export const PortalRequest = z
  .object({
    key: z.string(),
    summary: z.string(),
    status: StatusInfo,
    requestType: z.string(),
    project: z.object({ key: z.string(), name: z.string() }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'PortalRequest' });
export type PortalRequest = z.infer<typeof PortalRequest>;

export const PortalRequestDetail = PortalRequest.extend({
  description: RichTextOutput.nullable(),
  /** Public comments only; `fromAgent` marks the desk's answers. */
  comments: z.array(
    z.object({
      id: Id,
      author: UserRef.nullable(),
      body: RichTextOutput,
      createdAt: z.iso.datetime(),
      fromAgent: z.boolean(),
    }),
  ),
}).meta({ id: 'PortalRequestDetail' });
export type PortalRequestDetail = z.infer<typeof PortalRequestDetail>;

export const PortalCommentRequest = z
  .object({ body: RichTextInput })
  .meta({ id: 'PortalCommentRequest' });
export type PortalCommentRequest = z.infer<typeof PortalCommentRequest>;

/** One SLA clock of a request (TL-47, E-137), in working hours. */
export const SlaMetric = z
  .object({
    targetHours: z.number(),
    elapsedHours: z.number(),
    /** Negative once breached. */
    remainingHours: z.number(),
    breached: z.boolean(),
    /** The goal was reached: first answer given, or request resolved. */
    stopped: z.boolean(),
    /** Waiting for the customer: the clock rests. */
    paused: z.boolean(),
  })
  .meta({ id: 'SlaMetric' });
export type SlaMetric = z.infer<typeof SlaMetric>;

export const IssueSla = z
  .object({ firstResponse: SlaMetric.nullable(), resolution: SlaMetric.nullable() })
  .meta({ id: 'IssueSla' });
export type IssueSla = z.infer<typeof IssueSla>;

/** A request in the agents' queue, most urgent first. */
export const QueueEntry = z
  .object({
    key: z.string(),
    summary: z.string(),
    status: StatusInfo,
    requestType: z.string(),
    reporter: UserRef.nullable(),
    assignee: UserRef.nullable(),
    priority: z.string(),
    createdAt: z.iso.datetime(),
    sla: IssueSla,
  })
  .meta({ id: 'QueueEntry' });
export type QueueEntry = z.infer<typeof QueueEntry>;

/** The IMAP mailbox of a project (TL-53, E-142); the password is never sent back. */
export const MailHandler = z
  .object({
    enabled: z.boolean(),
    host: z.string(),
    port: z.number().int(),
    secure: z.boolean(),
    username: z.string(),
    hasPassword: z.boolean(),
    folder: z.string(),
    doneFolder: z.string(),
    issueType: z.string(),
    lastRunAt: z.iso.datetime().nullable(),
    lastResult: z.string().nullable(),
  })
  .meta({ id: 'MailHandler' });
export type MailHandler = z.infer<typeof MailHandler>;

export const SaveMailHandlerRequest = z
  .object({
    enabled: z.boolean().default(true),
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535).default(993),
    secure: z.boolean().default(true),
    username: z.string().trim().min(1).max(255),
    /** Left out: unchanged. */
    password: z.string().min(1).max(500).optional(),
    folder: z.string().trim().min(1).max(200).default('INBOX'),
    doneFolder: z.string().trim().max(200).default(''),
    issueType: z.string().min(1).max(40),
  })
  .meta({ id: 'SaveMailHandlerRequest' });
export type SaveMailHandlerRequest = z.infer<typeof SaveMailHandlerRequest>;

/** A mail the handler took in, and what became of it. */
export const MailReceipt = z
  .object({
    messageId: z.string(),
    issueKey: z.string().nullable(),
    outcome: z.string(),
    receivedAt: z.iso.datetime(),
  })
  .meta({ id: 'MailReceipt' });
export type MailReceipt = z.infer<typeof MailReceipt>;

/** The JSON schema of {@link InboundServiceRequest}, as the settings show it to integrators. */
export function inboundRequestJsonSchema(): Record<string, unknown> {
  const full = z.toJSONSchema(InboundServiceRequest, { io: 'input' }) as {
    $schema?: string;
    $defs?: Record<string, Record<string, unknown>>;
  };
  const definition = full.$defs?.InboundServiceRequest ?? full;
  return { $schema: full.$schema, title: 'InboundServiceRequest', ...definition };
}
