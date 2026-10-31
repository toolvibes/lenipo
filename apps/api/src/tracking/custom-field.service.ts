import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateCustomFieldRequest,
  CustomField,
  CustomFieldInputs,
  CustomFieldValue,
  ProjectFieldConfig,
  ProjectFieldSetting,
  UpdateCustomFieldRequest,
} from '@tasklore/shared';
import { customFieldNameClash, FieldCatalogue } from '@tasklore/tql';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  customFieldOptions,
  customFields,
  groups,
  projectCustomFields,
  projectVersions,
  users,
} from '../db/schema/index.js';
import type { Change } from './history.js';
import { ProjectAccessService } from './project-access.service.js';

const CACHE_MS = 30_000;
const CLASH_MESSAGES = {
  field: 'This name belongs to a system field',
  function: 'This name belongs to a TQL function',
  keyword: 'This name is a TQL keyword',
} as const;

/** Stored values: strings, numbers, booleans, or arrays of option ids. */
export type StoredValues = Record<string, unknown>;

/** Custom fields, their use per project and the values on issues (T-FLD-01, E-50). */
@Injectable()
export class CustomFieldService {
  private cached?: { at: number; fields: CustomField[] };

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- definitions

  /** All fields with their options, archived ones included; cached briefly per process. */
  async list(): Promise<CustomField[]> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.fields;
    const db = this.database.db;
    const [rows, options] = await Promise.all([
      db.select().from(customFields).orderBy(asc(customFields.number)),
      db.select().from(customFieldOptions).orderBy(asc(customFieldOptions.position)),
    ]);
    const fields = rows.map((row) => ({
      id: row.id,
      number: row.number,
      name: row.name,
      description: row.description,
      type: row.type,
      options: options
        .filter((option) => option.fieldId === row.id)
        .map(({ id, value, archived }) => ({ id, value, archived })),
      archived: row.archivedAt !== null,
    }));
    this.cached = { at: Date.now(), fields };
    return fields;
  }

  private async field(id: string): Promise<CustomField> {
    const field = (await this.list()).find((entry) => entry.id === id);
    if (!field) throw new NotFoundException('Custom field not found');
    return field;
  }

  /** The fields TQL knows: system fields plus custom fields that are not archived. */
  async catalogue(): Promise<FieldCatalogue> {
    const fields = await this.list();
    return new FieldCatalogue(fields.filter((field) => !field.archived));
  }

  private checkName(name: string): void {
    const clash = customFieldNameClash(name);
    if (clash) throw new BadRequestException(CLASH_MESSAGES[clash]);
  }

  private nameTaken(error: unknown): never {
    if (isUniqueViolation(error)) throw new ConflictException('A field with this name exists');
    throw error;
  }

  async create(principal: Principal, request: CreateCustomFieldRequest): Promise<CustomField> {
    this.checkName(request.name);
    const choices = request.type === 'select' || request.type === 'multiselect';
    if (!choices && request.options.length > 0) {
      throw new BadRequestException('Only select fields have options');
    }
    const id = uuidv7();
    try {
      await this.database.db.transaction(async (tx) => {
        await tx.insert(customFields).values({
          id,
          name: request.name,
          description: request.description,
          type: request.type,
        });
        if (request.options.length > 0) {
          await tx.insert(customFieldOptions).values(
            request.options.map((value, position) => ({
              id: uuidv7(),
              fieldId: id,
              value,
              position,
            })),
          );
        }
      });
    } catch (error) {
      this.nameTaken(error);
    }
    this.cached = undefined;
    await this.audit.record({
      action: 'custom_field.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'custom_field',
      targetId: id,
      details: { name: request.name, type: request.type },
    });
    return this.field(id);
  }

  async update(
    principal: Principal,
    id: string,
    request: UpdateCustomFieldRequest,
  ): Promise<CustomField> {
    const field = await this.field(id);
    if (request.name !== undefined) this.checkName(request.name);
    if (request.options && field.type !== 'select' && field.type !== 'multiselect') {
      throw new BadRequestException('Only select fields have options');
    }
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(customFields)
          .set({
            ...(request.name !== undefined ? { name: request.name } : {}),
            ...(request.description !== undefined ? { description: request.description } : {}),
            ...(request.archived !== undefined
              ? { archivedAt: request.archived ? sql`now()` : null }
              : {}),
            updatedAt: sql`now()`,
          })
          .where(eq(customFields.id, id));
        if (request.options) await this.replaceOptions(tx, field, request.options);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Names of fields and of the options of a field must be unique');
      }
      throw error;
    }
    this.cached = undefined;
    await this.audit.record({
      action: 'custom_field.updated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'custom_field',
      targetId: id,
      details: { ...request },
    });
    return this.field(id);
  }

  /** Options left out of the list are archived, never deleted, so stored values keep a name. */
  private async replaceOptions(
    tx: Executor,
    field: CustomField,
    options: NonNullable<UpdateCustomFieldRequest['options']>,
  ): Promise<void> {
    const known = new Set(field.options.map((option) => option.id));
    for (const option of options) {
      if (option.id && !known.has(option.id)) throw new BadRequestException('Unknown option');
    }
    const kept = new Set(options.flatMap((option) => (option.id ? [option.id] : [])));
    const dropped = field.options.filter((option) => !kept.has(option.id));
    // Renames may swap names; a temporary name avoids clashes in the unique index meanwhile.
    for (const option of field.options) {
      await tx
        .update(customFieldOptions)
        .set({ value: `${option.id}~` })
        .where(eq(customFieldOptions.id, option.id));
    }
    for (const option of dropped) {
      await tx
        .update(customFieldOptions)
        .set({ value: option.value, archived: true, position: options.length + 1 })
        .where(eq(customFieldOptions.id, option.id));
    }
    for (const [position, option] of options.entries()) {
      if (option.id) {
        await tx
          .update(customFieldOptions)
          .set({ value: option.value, archived: option.archived, position })
          .where(eq(customFieldOptions.id, option.id));
      } else {
        await tx.insert(customFieldOptions).values({
          id: uuidv7(),
          fieldId: field.id,
          value: option.value,
          archived: option.archived,
          position,
        });
      }
    }
  }

  // ---------------------------------------------------------------- projects

  async projectFieldIds(projectId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ fieldId: projectCustomFields.fieldId })
      .from(projectCustomFields)
      .innerJoin(customFields, eq(customFields.id, projectCustomFields.fieldId))
      .where(and(eq(projectCustomFields.projectId, projectId), isNull(customFields.archivedAt)))
      .orderBy(asc(projectCustomFields.position));
    return rows.map((row) => row.fieldId);
  }

  /** The project's fields with their configuration, in display order (TL-12, E-89). */
  async projectFieldConfig(projectId: string): Promise<ProjectFieldConfig[]> {
    return this.database.db
      .select({
        fieldId: projectCustomFields.fieldId,
        required: projectCustomFields.required,
        hidden: projectCustomFields.hidden,
        description: projectCustomFields.description,
      })
      .from(projectCustomFields)
      .innerJoin(customFields, eq(customFields.id, projectCustomFields.fieldId))
      .where(and(eq(projectCustomFields.projectId, projectId), isNull(customFields.archivedAt)))
      .orderBy(asc(projectCustomFields.position));
  }

  /**
   * Names of required fields without a value; with `only`, just those among them, so editing one
   * field does not trip over another left empty before it became required.
   */
  async missingRequired(
    projectId: string,
    values: StoredValues,
    only?: string[],
  ): Promise<string[]> {
    const config = await this.projectFieldConfig(projectId);
    const fields = await this.list();
    return config
      .filter((entry) => entry.required && !entry.hidden && (!only || only.includes(entry.fieldId)))
      .filter((entry) => {
        const value = values[entry.fieldId];
        return (
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        );
      })
      .map((entry) => fields.find((field) => field.id === entry.fieldId)?.name ?? entry.fieldId);
  }

  async setProjectFields(
    principal: Principal,
    projectId: string,
    fieldIds: string[],
    settings: Record<string, ProjectFieldSetting> = {},
  ) {
    await this.projectAccess.require(principal, projectId, 'administer');
    const fields = await this.list();
    const ids = [...new Set(fieldIds)];
    for (const id of ids) {
      const field = fields.find((entry) => entry.id === id);
      if (!field || field.archived) throw new BadRequestException('Unknown custom field');
      if (settings[id]?.required && settings[id]?.hidden) {
        throw new BadRequestException(`${field.name} cannot be both required and hidden`);
      }
    }
    await this.database.db.transaction(async (tx) => {
      await tx.delete(projectCustomFields).where(eq(projectCustomFields.projectId, projectId));
      if (ids.length > 0) {
        await tx.insert(projectCustomFields).values(
          ids.map((fieldId, position) => ({
            projectId,
            fieldId,
            position,
            required: settings[fieldId]?.required ?? false,
            hidden: settings[fieldId]?.hidden ?? false,
            description: settings[fieldId]?.description || null,
          })),
        );
      }
    });
    await this.audit.record({
      action: 'project.custom_fields_changed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: projectId,
      details: { fieldIds: ids, settings },
    });
  }

  // ---------------------------------------------------------------- values

  /** Display names of the people in stored values, read in one query. */
  /** Names of the people, groups and versions in stored values, one query per kind. */
  private async people(fields: CustomField[], stored: StoredValues[]) {
    const wanted = {
      user: new Set<string>(),
      group: new Set<string>(),
      version: new Set<string>(),
    };
    for (const field of fields) {
      const kind =
        field.type === 'user' || field.type === 'users'
          ? 'user'
          : field.type === 'group' || field.type === 'version'
            ? field.type
            : null;
      if (!kind) continue;
      for (const values of stored) {
        const value = values[field.id];
        for (const id of Array.isArray(value) ? value : [value]) {
          if (typeof id === 'string') wanted[kind].add(id);
        }
      }
    }
    const names = new Map<string, string>();
    const load = async (rows: Promise<Array<{ id: string; name: string }>>) => {
      for (const row of await rows) names.set(row.id, row.name);
    };
    if (wanted.user.size > 0) {
      await load(
        this.database.db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(inArray(users.id, [...wanted.user])),
      );
    }
    if (wanted.group.size > 0) {
      await load(
        this.database.db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, [...wanted.group])),
      );
    }
    if (wanted.version.size > 0) {
      await load(
        this.database.db
          .select({ id: projectVersions.id, name: projectVersions.name })
          .from(projectVersions)
          .where(inArray(projectVersions.id, [...wanted.version])),
      );
    }
    return names;
  }

  /**
   * Stored values of many issues as the API shows them, in the same order; only fields that
   * are not archived and that the issue's project uses (E-50). One query per kind.
   */
  async presentAll(
    entries: ReadonlyArray<{ projectId: string; values: StoredValues }>,
  ): Promise<Array<Record<string, CustomFieldValue>>> {
    if (entries.every((entry) => Object.keys(entry.values).length === 0)) {
      return entries.map(() => ({}));
    }
    const fields = (await this.list()).filter((field) => !field.archived);
    const projectIds = [...new Set(entries.map((entry) => entry.projectId))];
    const [enabledRows, people] = await Promise.all([
      this.database.db
        .select({ projectId: projectCustomFields.projectId, fieldId: projectCustomFields.fieldId })
        .from(projectCustomFields)
        .where(inArray(projectCustomFields.projectId, projectIds)),
      this.people(
        fields,
        entries.map((entry) => entry.values),
      ),
    ]);
    const enabled = new Set(enabledRows.map((row) => `${row.projectId}:${row.fieldId}`));
    return entries.map(({ projectId, values }) => {
      const result: Record<string, CustomFieldValue> = {};
      for (const field of fields) {
        if (!enabled.has(`${projectId}:${field.id}`)) continue;
        const value = this.show(field, values[field.id], people);
        if (value !== undefined) result[field.id] = value;
      }
      return result;
    });
  }

  private show(
    field: CustomField,
    raw: unknown,
    people: Map<string, string>,
  ): CustomFieldValue | undefined {
    if (raw === undefined || raw === null) return undefined;
    const option = (id: unknown) => {
      const found = field.options.find((entry) => entry.id === id);
      return found ? { id: found.id, value: found.value } : undefined;
    };
    switch (field.type) {
      case 'select':
        return option(raw);
      case 'multiselect':
        return Array.isArray(raw)
          ? raw.flatMap((id) => {
              const found = option(id);
              return found ? [found] : [];
            })
          : undefined;
      case 'user':
      case 'group': {
        const name = people.get(raw as string);
        return name ? { id: raw as string, displayName: name } : undefined;
      }
      case 'users':
        return Array.isArray(raw)
          ? raw.flatMap((id) => {
              const name = people.get(id);
              return name ? [{ id: id as string, displayName: name }] : [];
            })
          : undefined;
      case 'version': {
        const name = people.get(raw as string);
        return name ? { id: raw as string, value: name } : undefined;
      }
      default:
        return raw as CustomFieldValue;
    }
  }

  /** History text of a value; checkboxes as "true"/"false", which the web app translates. */
  private display(field: CustomField, raw: unknown, people: Map<string, string>): string | null {
    const shown = this.show(field, raw, people);
    if (shown === undefined) return null;
    if (Array.isArray(shown)) {
      return (
        shown
          .map((entry) =>
            typeof entry === 'string' ? entry : 'value' in entry ? entry.value : entry.displayName,
          )
          .join(', ') || null
      );
    }
    if (typeof shown === 'object') return 'value' in shown ? shown.value : shown.displayName;
    return String(shown);
  }

  /**
   * Checks new values against the fields the project uses and returns the stored values after
   * the change plus the history entries (E-50). Unchanged values are no change.
   */
  async apply(
    projectId: string,
    current: StoredValues,
    inputs: CustomFieldInputs,
  ): Promise<{ next: StoredValues; changes: Change[] }> {
    const fields = await this.list();
    const enabled = new Set(await this.projectFieldIds(projectId));
    const next: StoredValues = { ...current };
    for (const [id, input] of Object.entries(inputs)) {
      const field = fields.find((entry) => entry.id === id);
      if (!field || field.archived || !enabled.has(id)) {
        throw new BadRequestException(`The field ${id} is not used in this project`);
      }
      const value =
        input === null ? undefined : await this.normalize(field, input, projectId, current[id]);
      if (value === undefined) delete next[id];
      else next[id] = value;
    }
    const people = await this.people(fields, [current, next]);
    const changes: Change[] = [];
    for (const id of Object.keys(inputs)) {
      const field = fields.find((entry) => entry.id === id) as CustomField;
      const before = JSON.stringify(current[id] ?? null);
      const after = JSON.stringify(next[id] ?? null);
      if (before === after) continue;
      changes.push({
        field: `cf:${id}`,
        fromValue: current[id] === undefined ? null : before,
        toValue: next[id] === undefined ? null : after,
        fromDisplay: this.display(field, current[id], people),
        toDisplay: this.display(field, next[id], people),
      });
    }
    return { next, changes };
  }

  /** A person a value may name: active and able to see the project. */
  private async checkPerson(field: CustomField, userId: string, projectId: string) {
    const [person] = await this.database.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId));
    const visible =
      person?.status === 'active' &&
      (await this.projectAccess.permissions(userId, projectId)).has('browse');
    if (!visible) this.invalid(field, 'this person cannot see the project');
  }

  private invalid(field: CustomField, reason: string): never {
    throw new BadRequestException(`${field.name}: ${reason}`);
  }

  /** The stored form of one input, or undefined for "no value". */
  private async normalize(
    field: CustomField,
    input: NonNullable<CustomFieldInputs[string]>,
    projectId: string,
    current: unknown,
  ): Promise<unknown> {
    // An archived option may stay where it is set, but cannot be chosen anew.
    const usable = (id: string) =>
      field.options.some(
        (option) =>
          option.id === id &&
          (!option.archived || current === id || (Array.isArray(current) && current.includes(id))),
      );
    switch (field.type) {
      case 'text':
      case 'textarea': {
        if (typeof input !== 'string') this.invalid(field, 'expected text');
        const text = field.type === 'text' ? input.trim() : input.replace(/\s+$/, '');
        if (field.type === 'text' && text.length > 255)
          this.invalid(field, 'at most 255 characters');
        return text === '' ? undefined : text;
      }
      case 'url': {
        if (typeof input !== 'string') this.invalid(field, 'expected a URL');
        const text = input.trim();
        if (text === '') return undefined;
        let url: URL;
        try {
          url = new URL(text);
        } catch {
          this.invalid(field, 'expected a URL');
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          this.invalid(field, 'only http and https links');
        }
        return url.toString();
      }
      case 'number':
        if (typeof input !== 'number' || !Number.isFinite(input)) {
          this.invalid(field, 'expected a number');
        }
        return input;
      case 'date':
        if (
          typeof input !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
          Number.isNaN(Date.parse(input))
        ) {
          this.invalid(field, 'expected a date (YYYY-MM-DD)');
        }
        return input;
      case 'datetime': {
        const time = typeof input === 'string' ? Date.parse(input) : Number.NaN;
        if (Number.isNaN(time)) this.invalid(field, 'expected a date and time');
        return new Date(time).toISOString();
      }
      case 'checkbox':
        if (typeof input !== 'boolean') this.invalid(field, 'expected true or false');
        // An unticked box is "no value", so `= false` and EMPTY agree.
        return input ? true : undefined;
      case 'select':
        if (typeof input !== 'string' || !usable(input)) this.invalid(field, 'unknown option');
        return input;
      case 'multiselect': {
        if (!Array.isArray(input)) this.invalid(field, 'expected a list of options');
        const ids = [...new Set(input)];
        if (!ids.every(usable)) this.invalid(field, 'unknown option');
        // Stored in the order of the options, so equal choices compare equal.
        const order = field.options.map((option) => option.id);
        ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return ids.length > 0 ? ids : undefined;
      }
      case 'user': {
        if (typeof input !== 'string') this.invalid(field, 'expected a person');
        if (input !== current) await this.checkPerson(field, input, projectId);
        return input;
      }
      case 'users': {
        if (!Array.isArray(input)) this.invalid(field, 'expected a list of people');
        const ids = [...new Set(input as string[])].sort();
        const before = Array.isArray(current) ? current : [];
        for (const id of ids) {
          if (!before.includes(id)) await this.checkPerson(field, id, projectId);
        }
        return ids.length > 0 ? ids : undefined;
      }
      case 'group': {
        if (typeof input !== 'string') this.invalid(field, 'expected a group');
        const [group] = await this.database.db
          .select({ id: groups.id })
          .from(groups)
          .where(eq(groups.id, input));
        if (!group) this.invalid(field, 'unknown group');
        return input;
      }
      case 'version': {
        if (typeof input !== 'string') this.invalid(field, 'expected a version');
        const [version] = await this.database.db
          .select({ id: projectVersions.id })
          .from(projectVersions)
          .where(and(eq(projectVersions.id, input), eq(projectVersions.projectId, projectId)));
        if (!version) this.invalid(field, 'not a version of this project');
        return input;
      }
      case 'labels': {
        if (!Array.isArray(input)) this.invalid(field, 'expected a list of labels');
        const labels = [...new Set((input as string[]).map((label) => String(label).trim()))]
          .filter(Boolean)
          .sort();
        if (labels.some((label) => !/^\S{1,64}$/.test(label))) {
          this.invalid(field, 'labels are single words of at most 64 characters');
        }
        return labels.length > 0 ? labels : undefined;
      }
    }
  }
}
