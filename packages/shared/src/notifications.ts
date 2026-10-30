import { z } from 'zod';
import { UserRef } from './tracking.js';

export const NOTIFICATION_CATEGORIES = [
  'mention',
  'assigned',
  'comment',
  'status',
  'other',
] as const;
export const NotificationCategory = z
  .enum(NOTIFICATION_CATEGORIES)
  .meta({ id: 'NotificationCategory' });
export type NotificationCategory = z.infer<typeof NotificationCategory>;

export const NotificationDetails = z
  .object({
    kind: z.enum(['created', 'updated', 'commented', 'published']),
    items: z.array(
      z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
    ),
    /** Start of the comment, for comments and mentions in comments. */
    excerpt: z.string().optional(),
    /** The quoted page text of an inline comment (E-63). */
    quote: z.string().optional(),
    /** A published page version (E-65); `excerpt` holds its change comment. */
    version: z.number().int().optional(),
  })
  .meta({ id: 'NotificationDetails' });
export type NotificationDetails = z.infer<typeof NotificationDetails>;

export const Notification = z
  .object({
    id: z.number().int(),
    /** What the notification is about: an issue, or a wiki page (E-63). */
    issue: z.object({ key: z.string(), summary: z.string() }).nullable(),
    page: z.object({ id: z.string(), title: z.string(), spaceKey: z.string() }).nullable(),
    actor: UserRef.nullable(),
    category: NotificationCategory,
    details: NotificationDetails,
    createdAt: z.iso.datetime(),
    read: z.boolean(),
  })
  .meta({ id: 'Notification' });
export type Notification = z.infer<typeof Notification>;

export const NotificationList = z
  .object({ notifications: z.array(Notification), unreadCount: z.number().int() })
  .meta({ id: 'NotificationList' });
export type NotificationList = z.infer<typeof NotificationList>;

export const NotificationListQuery = z.object({
  unread: z.stringbool().default(false),
  /** Only this category, e.g. mentions for the home page. */
  category: NotificationCategory.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Older than this notification id, for paging. */
  before: z.coerce.number().int().positive().optional(),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuery>;

export const UnreadCount = z.object({ count: z.number().int() }).meta({ id: 'UnreadCount' });
export type UnreadCount = z.infer<typeof UnreadCount>;

export const MarkNotificationsRead = z
  .object({
    /** These notifications; omit and set `all` to mark everything read. */
    ids: z.array(z.number().int()).max(500).optional(),
    all: z.boolean().default(false),
  })
  .meta({ id: 'MarkNotificationsRead' });
export type MarkNotificationsRead = z.infer<typeof MarkNotificationsRead>;

export const NotificationSettings = z
  .object({
    emailEnabled: z.boolean(),
    emailCategories: z.array(NotificationCategory),
    /** False when the server has no mail server configured. */
    emailAvailable: z.boolean(),
  })
  .meta({ id: 'NotificationSettings' });
export type NotificationSettings = z.infer<typeof NotificationSettings>;

export const UpdateNotificationSettings = z
  .object({ emailEnabled: z.boolean(), emailCategories: z.array(NotificationCategory) })
  .meta({ id: 'UpdateNotificationSettings' });
export type UpdateNotificationSettings = z.infer<typeof UpdateNotificationSettings>;
