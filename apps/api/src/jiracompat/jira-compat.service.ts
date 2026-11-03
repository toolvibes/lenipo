import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateIssueRequest,
  type CustomFieldInputs,
  type Issue,
  UpdateIssueRequest,
} from '@toolvibes/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, users } from '../db/schema/index.js';
import { SearchService } from '../search/search.service.js';
import { markdownOf } from '../tracking/content-format.js';
import { IssueService } from '../tracking/issue.service.js';
import { type MetaIndex, MetaService } from '../tracking/meta.service.js';
import { ProjectService } from '../tracking/project.service.js';
import {
  jiraComment,
  jiraFields,
  jiraIssue,
  jiraStatus,
  jiraTransition,
  pickFields,
} from './jira-mapping.js';

/** A field Jira clients send that Lenipo cannot take; answered per field like Jira does. */
export class JiraFieldError extends BadRequestException {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super({ message, field });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESULTS = 100;

type Named = { id?: unknown; key?: unknown; name?: unknown; value?: unknown };
type FieldOperation = { set?: unknown; add?: unknown; remove?: unknown };

export interface JiraSearch {
  jql: string;
  startAt: number;
  maxResults: number;
  fields?: string[];
}

export interface JiraWrite {
  fields?: Record<string, unknown>;
  update?: Record<string, FieldOperation[]>;
}

function asObject(field: string, value: unknown): Named {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Named;
  throw new JiraFieldError(field, `Field '${field}' expects an object.`);
}

function names(field: string, value: unknown): string[] {
  if (!Array.isArray(value)) throw new JiraFieldError(field, `Field '${field}' expects a list.`);
  return value.map((entry) => {
    const name = typeof entry === 'string' ? entry : asObject(field, entry).name;
    if (typeof name !== 'string')
      throw new JiraFieldError(field, `Field '${field}' expects names.`);
    return name;
  });
}

/** An entry of the metadata by id, key or name, as Jira clients name types and priorities. */
function byIdOrName<T extends { id: string; key: string; name: string }>(
  field: string,
  entries: T[],
  value: unknown,
): T {
  const wanted = asObject(field, value);
  const match = entries.find(
    (entry) =>
      entry.id === wanted.id ||
      (typeof wanted.name === 'string' &&
        [entry.name, entry.key].some(
          (name) => name.toLowerCase() === wanted.name?.toString().toLowerCase(),
        )),
  );
  if (!match) throw new JiraFieldError(field, `The ${field} you specified does not exist.`);
  return match;
}

/**
 * The Jira REST API v2 subset over Lenipo's own services (TL-48, E-138): search, read, create
 * and change issues, transitions and comments. Every call runs with the caller's permissions.
 */
@Injectable()
export class JiraCompatService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(SearchService) private readonly searchService: SearchService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(ProjectService) private readonly projects: ProjectService,
  ) {}

  /** Jira addresses issues by id or key; Lenipo's services take keys. */
  private async keyOf(idOrKey: string): Promise<string> {
    if (!UUID.test(idOrKey)) return idOrKey.toUpperCase();
    const [row] = await this.database.db
      .select({ key: issues.key })
      .from(issues)
      .where(eq(issues.id, idOrKey));
    if (!row)
      throw new NotFoundException('Issue does not exist or you do not have permission to see it.');
    return row.key;
  }

  /** A person named the way Jira clients do: account id, or user name / address. */
  private async userId(field: string, value: unknown): Promise<string | null> {
    if (value === null) return null;
    const person = asObject(field, value) as Named & {
      accountId?: unknown;
      emailAddress?: unknown;
    };
    const id =
      person.accountId ?? person.id ?? (UUID.test(String(person.name)) ? person.name : undefined);
    if (typeof id === 'string') return id;
    const email = person.emailAddress ?? person.name;
    if (typeof email !== 'string')
      throw new JiraFieldError(field, `Field '${field}' names no user.`);
    const [row] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.status, 'active')));
    if (!row) throw new JiraFieldError(field, `User '${email}' does not exist.`);
    return row.id;
  }

  /** Jira field values as the fields of a Lenipo request. */
  private async translate(meta: MetaIndex, fields: Record<string, unknown>) {
    const request: Record<string, unknown> = {};
    const customFields: CustomFieldInputs = {};
    for (const [field, value] of Object.entries(fields)) {
      if (field.startsWith('customfield_')) {
        customFields[field.slice('customfield_'.length)] = value as CustomFieldInputs[string];
        continue;
      }
      switch (field) {
        case 'project':
          break;
        case 'summary':
          request.summary = value;
          break;
        case 'description':
          request.description =
            typeof value === 'string' && value !== '' ? { markdown: value } : null;
          break;
        case 'issuetype':
          request.issueType = byIdOrName(field, meta.issueTypes, value).key;
          break;
        case 'priority':
          request.priority = byIdOrName(field, meta.priorities, value).key;
          break;
        case 'assignee':
          request.assigneeId = await this.userId(field, value);
          break;
        case 'labels':
          request.labels = value;
          break;
        case 'duedate':
          request.dueDate = value || null;
          break;
        case 'parent':
          request.parentKey = value === null ? null : String(asObject(field, value).key ?? '');
          break;
        case 'components':
          request.components = names(field, value);
          break;
        case 'fixVersions':
          request.fixVersions = names(field, value);
          break;
        case 'versions':
          request.affectsVersions = names(field, value);
          break;
        default:
          throw new JiraFieldError(
            field,
            `Field '${field}' cannot be set. It is not on the appropriate screen, or unknown.`,
          );
      }
    }
    if (Object.keys(customFields).length > 0) request.customFields = customFields;
    return request;
  }

  /** `update` operations: `set` for every field, `add` and `remove` for labels. */
  private async operations(issue: Issue | null, update: JiraWrite['update']) {
    const fields: Record<string, unknown> = {};
    const comments: string[] = [];
    for (const [field, steps] of Object.entries(update ?? {})) {
      for (const step of steps) {
        if (field === 'comment') {
          const body = (step.add as { body?: unknown } | undefined)?.body;
          if (typeof body !== 'string') throw new JiraFieldError(field, 'A comment needs a body.');
          comments.push(body);
        } else if ('set' in step) {
          fields[field] = step.set;
        } else if (field === 'labels' && ('add' in step || 'remove' in step)) {
          const current = (fields.labels as string[] | undefined) ?? issue?.labels ?? [];
          fields.labels =
            'add' in step
              ? [...new Set([...current, String(step.add)])]
              : current.filter((label) => label !== String(step.remove));
        } else {
          throw new JiraFieldError(field, `Field '${field}' supports only the operation 'set'.`);
        }
      }
    }
    return { fields, comments };
  }

  async search(principal: Principal, base: string, query: JiraSearch) {
    const maxResults = Math.min(Math.max(query.maxResults, 0), MAX_RESULTS);
    const result = await this.searchService.search(principal, {
      query: query.jql,
      limit: Math.max(maxResults, 1),
      offset: query.startAt,
    });
    return {
      expand: 'names,schema',
      startAt: query.startAt,
      maxResults,
      total: result.total,
      issues: (maxResults === 0 ? [] : result.issues).map((issue) =>
        jiraIssue(base, issue, pickFields(jiraFields(issue), query.fields)),
      ),
    };
  }

  async issue(principal: Principal, base: string, idOrKey: string, requested?: string[]) {
    const issue = await this.issueService.get(principal, await this.keyOf(idOrKey));
    const description = issue.description === null ? null : markdownOf(issue.description);
    return jiraIssue(base, issue, pickFields(jiraFields(issue, description), requested));
  }

  async create(principal: Principal, base: string, body: JiraWrite) {
    const meta = await this.meta.load();
    const { fields: updates, comments } = await this.operations(null, body.update);
    const fields = { ...body.fields, ...updates };
    const project = fields.project === undefined ? {} : asObject('project', fields.project);
    const projectKey = project.key ?? project.id;
    if (typeof projectKey !== 'string') {
      throw new JiraFieldError('project', 'Specify a valid project ID or key');
    }
    await this.projects.findBrowsable(principal, projectKey);
    const created = await this.issueService.create(
      principal,
      CreateIssueRequest.parse({ projectKey, ...(await this.translate(meta, fields)) }),
    );
    for (const comment of comments) {
      await this.issueService.addComment(principal, created.key, { body: { markdown: comment } });
    }
    return { id: created.id, key: created.key, self: `${base}/issue/${created.id}` };
  }

  async update(principal: Principal, idOrKey: string, body: JiraWrite): Promise<void> {
    const key = await this.keyOf(idOrKey);
    const meta = await this.meta.load();
    const current = body.update?.labels ? await this.issueService.get(principal, key) : null;
    const { fields: updates, comments } = await this.operations(current, body.update);
    const request = UpdateIssueRequest.parse(
      await this.translate(meta, { ...body.fields, ...updates }),
    );
    if (Object.keys(request).length > 0) await this.issueService.update(principal, key, request);
    for (const comment of comments) {
      await this.issueService.addComment(principal, key, { body: { markdown: comment } });
    }
  }

  async transitions(principal: Principal, idOrKey: string) {
    const transitions = await this.issueService.transitions(principal, await this.keyOf(idOrKey));
    return { expand: 'transitions', transitions: transitions.map(jiraTransition) };
  }

  async transition(
    principal: Principal,
    idOrKey: string,
    body: JiraWrite & { transition?: Named },
  ) {
    const transitionId = body.transition?.id;
    if (typeof transitionId !== 'string' && typeof transitionId !== 'number') {
      throw new BadRequestException('Missing transition id');
    }
    const key = await this.keyOf(idOrKey);
    const meta = await this.meta.load();
    const { resolution, ...rest } = body.fields ?? {};
    const { fields: updates, comments } = await this.operations(null, body.update);
    const fields = UpdateIssueRequest.parse(await this.translate(meta, { ...rest, ...updates }));
    await this.issueService.transition(principal, key, {
      transitionId: String(transitionId),
      resolution: resolution
        ? byIdOrName('resolution', meta.resolutions, resolution).key
        : undefined,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
      comment: comments.length > 0 ? { markdown: comments.join('\n\n') } : undefined,
    });
  }

  async comments(
    principal: Principal,
    base: string,
    idOrKey: string,
    startAt: number,
    maxResults: number,
  ) {
    const key = await this.keyOf(idOrKey);
    const issue = await this.issueService.get(principal, key);
    const all = await this.issueService.comments(principal, key);
    const page = all.slice(startAt, startAt + Math.min(maxResults, 5000));
    return {
      startAt,
      maxResults,
      total: all.length,
      comments: page.map((comment) =>
        jiraComment(base, issue.id, comment, markdownOf(comment.body)),
      ),
    };
  }

  async addComment(principal: Principal, base: string, idOrKey: string, body: unknown) {
    if (typeof body !== 'string' || body.trim() === '') {
      throw new JiraFieldError('comment', 'Comment body can not be empty!');
    }
    const key = await this.keyOf(idOrKey);
    const comment = await this.issueService.addComment(principal, key, {
      body: { markdown: body },
    });
    const issue = await this.issueService.get(principal, key);
    return jiraComment(base, issue.id, comment, markdownOf(comment.body));
  }

  async myself(principal: Principal) {
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        timeZone: users.timeZone,
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.id, principal.userId));
    if (!user) throw new NotFoundException('User not found');
    return {
      accountId: user.id,
      key: user.id,
      name: user.id,
      emailAddress: user.email,
      displayName: user.displayName,
      active: true,
      timeZone: user.timeZone,
      locale: user.locale,
    };
  }

  async project(principal: Principal, base: string, key: string) {
    const project = await this.projects.findBrowsable(principal, key);
    const meta = await this.meta.load();
    return {
      id: project.key,
      key: project.key,
      name: project.name,
      self: `${base}/project/${project.key}`,
      issueTypes: meta.issueTypes.map((type) => ({
        id: type.id,
        name: type.name,
        subtask: type.hierarchyLevel < 0,
      })),
    };
  }

  async lists() {
    const meta = await this.meta.load();
    const plain = ({ id, name }: { id: string; name: string }) => ({ id, name });
    return {
      issueTypes: meta.issueTypes.map((type) => ({
        ...plain(type),
        subtask: type.hierarchyLevel < 0,
      })),
      priorities: meta.priorities.map(plain),
      resolutions: meta.resolutions.map(plain),
      statuses: meta.statuses.map(jiraStatus),
    };
  }
}
