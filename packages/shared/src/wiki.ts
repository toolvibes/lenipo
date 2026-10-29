import { z } from 'zod';
import { Id } from './identity.js';
import { RichText, RichTextOutput, UserRef } from './tracking.js';

/** What a space role allows (W-SPC-03, E-59). `edit` covers creating, moving and deleting pages. */
export const SPACE_PERMISSIONS = ['view', 'comment', 'edit', 'administer'] as const;
export const SpacePermission = z.enum(SPACE_PERMISSIONS).meta({ id: 'SpacePermission' });
export type SpacePermission = z.infer<typeof SpacePermission>;

export const SpaceRole = z
  .enum(['administrators', 'editors', 'commenters', 'viewers'])
  .meta({ id: 'SpaceRole' });
export type SpaceRole = z.infer<typeof SpaceRole>;

export const SpaceKey = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Use 2 to 10 upper-case letters or digits, starting with a letter')
  .meta({ id: 'SpaceKey' });

export const SpaceSummary = z
  .object({
    id: Id,
    key: z.string(),
    name: z.string(),
    description: z.string(),
    homePageId: Id.nullable(),
    createdAt: z.iso.datetime(),
    favourite: z.boolean(),
    /** The linked tracking project; null if none or the caller may not browse it (E-60). */
    project: z.object({ key: z.string(), name: z.string() }).nullable(),
  })
  .meta({ id: 'SpaceSummary' });
export type SpaceSummary = z.infer<typeof SpaceSummary>;

export const Space = SpaceSummary.extend({
  permissions: z.array(SpacePermission),
}).meta({ id: 'Space' });
export type Space = z.infer<typeof Space>;

const SpaceName = z.string().trim().min(1).max(100);

export const CreateSpaceRequest = z
  .object({
    key: SpaceKey,
    name: SpaceName,
    description: z.string().max(2000).default(''),
  })
  .meta({ id: 'CreateSpaceRequest' });
export type CreateSpaceRequest = z.infer<typeof CreateSpaceRequest>;

export const UpdateSpaceRequest = z
  .object({
    name: SpaceName,
    description: z.string().max(2000),
    homePageId: Id.nullable(),
    /** Links the space with a project, or unlinks it (null); needs administer on both (E-60). */
    projectKey: z.string().trim().min(1).max(20).nullable(),
  })
  .partial()
  .meta({ id: 'UpdateSpaceRequest' });
export type UpdateSpaceRequest = z.infer<typeof UpdateSpaceRequest>;

/** A role assignment: a user or a group (all signed-in users are the built-in "users" group). */
export const SpaceMember = z
  .object({
    id: Id,
    role: SpaceRole,
    user: UserRef.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
  })
  .meta({ id: 'SpaceMember' });
export type SpaceMember = z.infer<typeof SpaceMember>;

export const AddSpaceMemberRequest = z
  .union([
    z.strictObject({ role: SpaceRole, userId: Id }),
    z.strictObject({ role: SpaceRole, groupId: Id }),
  ])
  .meta({ id: 'AddSpaceMemberRequest' });
export type AddSpaceMemberRequest = z.infer<typeof AddSpaceMemberRequest>;

/** One page in the space's tree; the client nests them by `parentId`, in `rank` order. */
export const PageTreeEntry = z
  .object({
    id: Id,
    parentId: Id.nullable(),
    title: z.string(),
    /** False for pages never published; only editors see those. */
    published: z.boolean(),
  })
  .meta({ id: 'PageTreeEntry' });
export type PageTreeEntry = z.infer<typeof PageTreeEntry>;

export const PageRef = z.object({ id: Id, title: z.string() }).meta({ id: 'PageRef' });
export type PageRef = z.infer<typeof PageRef>;

/** A page as readers see it: the latest published version (E-59). */
export const Page = z
  .object({
    id: Id,
    space: z.object({ key: z.string(), name: z.string() }),
    parentId: Id.nullable(),
    /** From the space root down to the parent (W-PAG-16). */
    ancestors: z.array(PageRef),
    title: z.string(),
    /** Number of the published version; 0 for a draft that was never published. */
    version: z.number().int(),
    /** Null for drafts. */
    content: RichTextOutput.nullable(),
    publishedAt: z.iso.datetime().nullable(),
    publishedBy: UserRef.nullable(),
    createdAt: z.iso.datetime(),
    canEdit: z.boolean(),
    favourite: z.boolean(),
  })
  .meta({ id: 'Page' });
export type Page = z.infer<typeof Page>;

const PageTitle = z.string().trim().min(1).max(255);

export const CreatePageRequest = z
  .object({
    title: PageTitle,
    /** Null or missing: a top-level page. */
    parentId: Id.nullable().optional(),
  })
  .meta({ id: 'CreatePageRequest' });
export type CreatePageRequest = z.infer<typeof CreatePageRequest>;

export const UpdatePageRequest = z.object({ title: PageTitle }).meta({ id: 'UpdatePageRequest' });
export type UpdatePageRequest = z.infer<typeof UpdatePageRequest>;

/** Moves a page under `parentId` (null: top level), before the sibling `beforeId` or last. */
export const MovePageRequest = z
  .object({ parentId: Id.nullable(), beforeId: Id.nullable().optional() })
  .meta({ id: 'MovePageRequest' });
export type MovePageRequest = z.infer<typeof MovePageRequest>;

/** Publishes the editor's current document as the next version (E-59). */
export const PublishPageRequest = z
  .object({
    title: PageTitle,
    content: RichText,
    comment: z.string().trim().max(500).default(''),
  })
  .meta({ id: 'PublishPageRequest' });
export type PublishPageRequest = z.infer<typeof PublishPageRequest>;

export const PageVersionSummary = z
  .object({
    number: z.number().int(),
    title: z.string(),
    author: UserRef.nullable(),
    comment: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'PageVersionSummary' });
export type PageVersionSummary = z.infer<typeof PageVersionSummary>;

export const PageVersion = PageVersionSummary.extend({
  content: RichTextOutput,
}).meta({ id: 'PageVersion' });
export type PageVersion = z.infer<typeof PageVersion>;

/** A page in the space's trash (W-PAG-13). */
export const TrashedPage = z
  .object({
    id: Id,
    title: z.string(),
    deletedAt: z.iso.datetime(),
    deletedBy: UserRef.nullable(),
  })
  .meta({ id: 'TrashedPage' });
export type TrashedPage = z.infer<typeof TrashedPage>;
