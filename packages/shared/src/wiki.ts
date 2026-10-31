import { z } from 'zod';
import { Id } from './identity.js';
import { RichText, RichTextInput, RichTextOutput, UserRef } from './tracking.js';

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
    /** The caller watches the whole space (E-65). */
    watching: z.boolean(),
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

/** How the caller follows a page (E-65): directly, with its subtree, or through a parent or the space. */
export const PageWatchState = z
  .object({
    page: z.boolean(),
    subtree: z.boolean(),
    /** Followed already through a page above it or the whole space. */
    inherited: z.enum(['ancestor', 'space']).nullable(),
  })
  .meta({ id: 'PageWatchState' });
export type PageWatchState = z.infer<typeof PageWatchState>;

/** Labels as written: trimmed, lower case, without spaces (E-65). */
export const PageLabels = z
  .array(z.string().trim().toLowerCase().min(1).max(64).regex(/^\S+$/, 'Labels ohne Leerzeichen'))
  .max(30);

export const SetPageLabelsRequest = z
  .object({ labels: PageLabels })
  .meta({ id: 'SetPageLabelsRequest' });
export type SetPageLabelsRequest = z.infer<typeof SetPageLabelsRequest>;

export const LabelCount = z
  .object({ label: z.string(), pages: z.number().int() })
  .meta({ id: 'LabelCount' });
export type LabelCount = z.infer<typeof LabelCount>;

/** A page found by label, as far as the caller may see it. */
export const LabelledPage = z
  .object({
    id: Id,
    title: z.string(),
    space: z.object({ key: z.string(), name: z.string() }),
    labels: z.array(z.string()),
    publishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'LabelledPage' });
export type LabelledPage = z.infer<typeof LabelledPage>;

export const WatchPageRequest = z
  .object({ scope: z.enum(['page', 'subtree']).default('page') })
  .meta({ id: 'WatchPageRequest' });
export type WatchPageRequest = z.infer<typeof WatchPageRequest>;

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
    /** The live draft differs from the published version; only ever true for editors. */
    draftChanged: z.boolean(),
    /** May write, answer and resolve comments (E-63). */
    canComment: z.boolean(),
    /** Free-text labels, lower case (W-PAG-08, E-65). */
    labels: z.array(z.string()),
    watch: PageWatchState,
    /** Restrictions on this page, and whether a page above limits who sees it (E-95). */
    restrictions: z.object({ view: z.boolean(), edit: z.boolean(), inherited: z.boolean() }),
  })
  .meta({ id: 'Page' });
export type Page = z.infer<typeof Page>;

const PageTitle = z.string().trim().min(1).max(255);

export const CreatePageRequest = z
  .object({
    title: PageTitle,
    /** Null or missing: a top-level page. */
    parentId: Id.nullable().optional(),
    /** A template id or `blueprint:<key>`; its content becomes the new draft (E-72). */
    template: z.string().max(64).optional(),
    /** Values of the template's input variables (TL-27). */
    variables: z.record(z.string().max(60), z.string().max(500)).optional(),
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
    /** Set when this version restored an older one (E-62). */
    restoredFrom: z.number().int().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'PageVersionSummary' });
export type PageVersionSummary = z.infer<typeof PageVersionSummary>;

export const PageVersion = PageVersionSummary.extend({
  content: RichTextOutput,
}).meta({ id: 'PageVersion' });
export type PageVersion = z.infer<typeof PageVersion>;

/** Publishes the content of an older version again as the newest one (W-PAG-06, E-62). */
export const RestoreVersionRequest = z
  .object({ comment: z.string().trim().max(500).default('') })
  .meta({ id: 'RestoreVersionRequest' });
export type RestoreVersionRequest = z.infer<typeof RestoreVersionRequest>;

export const DiffQuery = z.object({
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
});
export type DiffQuery = z.infer<typeof DiffQuery>;

/** One block of a page as compared: heading, paragraph, list or task item, table row, … */
export const DiffBlockContent = z
  .object({
    type: z.enum([
      'heading',
      'paragraph',
      'listItem',
      'taskItem',
      'quote',
      'codeBlock',
      'tableRow',
      'image',
      'rule',
    ]),
    text: z.string(),
    depth: z.number().int(),
    level: z.number().int().optional(),
    checked: z.boolean().optional(),
    cells: z.array(z.string()).optional(),
    header: z.boolean().optional(),
    attachmentId: z.string().optional(),
  })
  .meta({ id: 'DiffBlockContent' });
export type DiffBlockContent = z.infer<typeof DiffBlockContent>;

export const WordChange = z
  .object({ op: z.enum(['same', 'added', 'removed']), text: z.string() })
  .meta({ id: 'WordChange' });

export const DiffBlock = z
  .union([
    z.object({ op: z.enum(['same', 'added', 'removed']), block: DiffBlockContent }),
    z.object({
      op: z.literal('changed'),
      before: DiffBlockContent,
      after: DiffBlockContent,
      words: z.array(WordChange),
    }),
  ])
  .meta({ id: 'DiffBlock' });
export type DiffBlock = z.infer<typeof DiffBlock>;

/** Two versions compared block by block, with changed words inside changed blocks (W-PAG-05). */
export const PageDiff = z
  .object({
    from: PageVersionSummary,
    to: PageVersionSummary,
    blocks: z.array(DiffBlock),
  })
  .meta({ id: 'PageDiff' });
export type PageDiff = z.infer<typeof PageDiff>;

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

// ---------------------------------------------------------------- comments (E-63)

/** The quoted text of an inline comment, with context and block number in the published page. */
export const TextAnchor = z
  .object({
    exact: z.string().min(1).max(1000),
    prefix: z.string().max(64),
    suffix: z.string().max(64),
    block: z.number().int().min(0),
  })
  .meta({ id: 'TextAnchor' });
export type TextAnchor = z.infer<typeof TextAnchor>;

/** A comment on a page; replies have `parentId`, inline threads an `anchor`. */
export const PageComment = z
  .object({
    id: Id,
    parentId: Id.nullable(),
    author: UserRef.nullable(),
    /** Null for a deleted comment that is kept because the thread has answers. */
    body: RichTextOutput.nullable(),
    anchor: TextAnchor.nullable(),
    /** The quoted text is no longer in the page. */
    detached: z.boolean(),
    resolved: z.object({ at: z.iso.datetime(), by: UserRef.nullable() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    edited: z.boolean(),
    deleted: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  })
  .meta({ id: 'PageComment' });
export type PageComment = z.infer<typeof PageComment>;

export const CreatePageCommentRequest = z
  .object({
    body: RichTextInput,
    /** Answers this thread. */
    parentId: Id.optional(),
    /** Starts an inline thread on this quote of the published version. */
    anchor: TextAnchor.optional(),
  })
  .refine((request) => !(request.parentId && request.anchor), {
    message: 'Answers belong to their thread and take no anchor',
  })
  .meta({ id: 'CreatePageCommentRequest' });
export type CreatePageCommentRequest = z.infer<typeof CreatePageCommentRequest>;

export const UpdatePageCommentRequest = z
  .object({ body: RichTextInput })
  .meta({ id: 'UpdatePageCommentRequest' });
export type UpdatePageCommentRequest = z.infer<typeof UpdatePageCommentRequest>;

// ---------------------------------------------------------------- templates (E-72)

export const PageTemplateSummary = z
  .object({
    /** What `template` takes when creating a page: the id, or `blueprint:<key>`. */
    ref: z.string(),
    kind: z.enum(['blueprint', 'space', 'global']),
    id: Id.nullable(),
    name: z.string(),
    description: z.string(),
    /** Suggested page title; `{date}` becomes today's date. */
    title: z.string(),
    spaceKey: z.string().nullable(),
    updatedAt: z.iso.datetime().nullable(),
    /** Input variables ({{input:Name}}) asked for when creating a page (TL-27, E-108). */
    inputs: z.array(z.string()),
  })
  .meta({ id: 'PageTemplateSummary' });
export type PageTemplateSummary = z.infer<typeof PageTemplateSummary>;

export const PageTemplate = PageTemplateSummary.extend({
  content: RichText,
  /** The caller may change or delete it (never for blueprints). */
  canEdit: z.boolean(),
}).meta({ id: 'PageTemplate' });
export type PageTemplate = z.infer<typeof PageTemplate>;

export const SavePageTemplateRequest = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).default(''),
    title: z.string().trim().max(255).default(''),
    content: RichText,
  })
  .meta({ id: 'SavePageTemplateRequest' });
export type SavePageTemplateRequest = z.infer<typeof SavePageTemplateRequest>;

/** A wiki page that refers to an issue, for "Wiki-Seiten" on the issue (W-INT-03, E-73). */
export const IssuePageRef = z
  .object({
    id: Id,
    title: z.string(),
    space: z.object({ key: z.string(), name: z.string() }),
    /** "macro": embeds the issue; "mention": names its key in the text. */
    kind: z.enum(['mention', 'macro']),
    publishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'IssuePageRef' });
export type IssuePageRef = z.infer<typeof IssuePageRef>;

// ---------------------------------------------------------------- restrictions (TL-14, E-95)

const RestrictionList = z.object({
  users: z.array(UserRef),
  groups: z.array(z.object({ id: Id, name: z.string() })),
});

/** Who may see and edit a page; empty lists mean the space permissions alone decide. */
export const PageRestrictions = z
  .object({
    view: RestrictionList,
    edit: RestrictionList,
    /** Pages above that limit who sees this one too. */
    inheritedFrom: z.array(PageRef),
  })
  .meta({ id: 'PageRestrictions' });
export type PageRestrictions = z.infer<typeof PageRestrictions>;

const RestrictionInput = z.object({
  userIds: z.array(Id).max(100).default([]),
  groupIds: z.array(Id).max(100).default([]),
});

/** Replaces both lists; whoever sets them stays in every non-empty list. */
export const SetPageRestrictionsRequest = z
  .object({ view: RestrictionInput, edit: RestrictionInput })
  .meta({ id: 'SetPageRestrictionsRequest' });
export type SetPageRestrictionsRequest = z.infer<typeof SetPageRestrictionsRequest>;

/** A restricted page of a space, for its administrators (who may not see it otherwise). */
export const RestrictedPage = z
  .object({ id: Id, title: z.string(), view: z.boolean(), edit: z.boolean() })
  .meta({ id: 'RestrictedPage' });
export type RestrictedPage = z.infer<typeof RestrictedPage>;

// ---------------------------------------------------------------- macros with data (TL-26, E-107)

export const MacroPageQuery = z.object({
  space: z.string().trim().min(1).max(20).optional(),
  label: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  /** For tasks: only those that mention the caller. */
  assignee: z.enum(['me', 'all']).default('all'),
});
export type MacroPageQuery = z.infer<typeof MacroPageQuery>;

const PageLink = z.object({ id: Id, title: z.string(), spaceKey: z.string() });

/** Page properties of labelled pages as one table (W-MAC-09). */
export const PagePropertiesReport = z
  .object({
    keys: z.array(z.string()),
    rows: z.array(z.object({ page: PageLink, values: z.record(z.string(), z.string()) })),
  })
  .meta({ id: 'PagePropertiesReport' });
export type PagePropertiesReport = z.infer<typeof PagePropertiesReport>;

/** An open task of a wiki page: `- [ ] @person … 2026-11-30` (W-MAC-11, W-INT-07). */
export const WikiTask = z
  .object({
    page: PageLink,
    text: z.string(),
    assignees: z.array(UserRef),
    due: z.iso.date().nullable(),
  })
  .meta({ id: 'WikiTask' });
export type WikiTask = z.infer<typeof WikiTask>;

/** Hosts whose pages may be embedded (W-MAC-16); everything else shows as a link. */
export const EmbedHosts = z
  .object({ hosts: z.array(z.string().trim().toLowerCase().min(3).max(200)).max(100) })
  .meta({ id: 'EmbedHosts' });
export type EmbedHosts = z.infer<typeof EmbedHosts>;
