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
  })
  .meta({ id: 'ServiceDesk' });
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
