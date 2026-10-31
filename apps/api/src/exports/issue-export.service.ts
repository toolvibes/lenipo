import { Inject, Injectable } from '@nestjs/common';
import { nodeText } from '@tasklore/editor';
import {
  type CustomField,
  ISSUE_EXPORT_LIMIT,
  type IssueExportRequest,
  type IssueSummary,
  type ListColumn,
} from '@tasklore/shared';
import type { Principal } from '../core/http/principal.js';
import { SearchService } from '../search/search.service.js';
import { CustomFieldService } from '../tracking/custom-field.service.js';
import { type Cell, toCsv, toXlsx } from './spreadsheet.js';

const BATCH = 500;

const hours = (seconds: number | null) =>
  seconds === null ? null : Math.round((seconds / 3600) * 100) / 100;

const names = (items: Array<{ name: string }>) => items.map((item) => item.name).join(', ');

function customCell(field: CustomField, value: unknown): Cell {
  if (value === undefined || value === null) return null;
  switch (field.type) {
    case 'number':
      return typeof value === 'number' ? value : null;
    case 'date':
      return { date: String(value) };
    case 'datetime':
      return { dateTime: String(value) };
    case 'checkbox':
      return value === true ? '✓' : null;
    case 'textarea':
      return typeof value === 'string' ? value : nodeText(value as never);
    default:
      break;
  }
  const text = (entry: unknown): string => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
      const object = entry as { value?: string; displayName?: string };
      return object.value ?? object.displayName ?? '';
    }
    return String(entry);
  };
  return Array.isArray(value) ? value.map(text).join(', ') : text(value);
}

/** Search results as CSV, Excel or JSON, all pages of the query up to a cap (T-QRY-09, E-111). */
@Injectable()
export class IssueExportService {
  constructor(
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
  ) {}

  private async issues(principal: Principal, query: string): Promise<IssueSummary[]> {
    const found: IssueSummary[] = [];
    for (let offset = 0; offset < ISSUE_EXPORT_LIMIT; offset += BATCH) {
      const page = await this.search.search(principal, {
        query,
        limit: Math.min(BATCH, ISSUE_EXPORT_LIMIT - offset),
        offset,
      });
      found.push(...page.issues);
      if (offset + page.issues.length >= page.total || page.issues.length === 0) break;
    }
    return found;
  }

  async export(
    principal: Principal,
    request: IssueExportRequest,
  ): Promise<{ body: Uint8Array | string; type: string; fileName: string }> {
    const issues = await this.issues(principal, request.query);
    const stamp = new Date().toISOString().slice(0, 10);
    if (request.format === 'json') {
      const plain = issues.map(({ canEdit, canAssign, canTransition, rank, ...issue }) => issue);
      return {
        body: JSON.stringify(
          { query: request.query, exportedAt: new Date().toISOString(), issues: plain },
          null,
          2,
        ),
        type: 'application/json; charset=utf-8',
        fileName: `vorgaenge-${stamp}.json`,
      };
    }
    const fields = await this.customFields.list();
    const columns = request.columns as ListColumn[];
    const cell = (issue: IssueSummary, column: ListColumn): Cell => {
      switch (column) {
        case 'issuetype':
          return issue.issueType.name;
        case 'status':
          return issue.status.name;
        case 'priority':
          return issue.priority.name;
        case 'assignee':
          return issue.assignee?.displayName ?? null;
        case 'reporter':
          return issue.reporter?.displayName ?? null;
        case 'created':
          return { dateTime: issue.createdAt };
        case 'updated':
          return { dateTime: issue.updatedAt };
        case 'due':
          return issue.dueDate ? { date: issue.dueDate } : null;
        case 'resolution':
          return issue.resolution?.name ?? null;
        case 'labels':
          return issue.labels.join(', ');
        case 'component':
          return names(issue.components);
        case 'fixVersion':
          return names(issue.fixVersions);
        case 'storyPoints':
          return issue.storyPoints;
        case 'originalEstimate':
          return hours(issue.timeTracking.originalEstimateSeconds);
        case 'remainingEstimate':
          return hours(issue.timeTracking.remainingEstimateSeconds);
        case 'timeSpent':
          return hours(issue.timeTracking.timeSpentSeconds);
        default: {
          const field = fields.find((entry) => `cf[${entry.number}]` === column);
          return field ? customCell(field, issue.customFields[field.id]) : null;
        }
      }
    };
    const fallback = [
      'key',
      'summary',
      ...columns.map(
        (column) => fields.find((entry) => `cf[${entry.number}]` === column)?.name ?? column,
      ),
    ];
    const headings = fallback.map((name, index) => request.headings?.[index] || name);
    const rows: Cell[][] = [
      headings,
      ...issues.map((issue) => [
        issue.key,
        issue.summary,
        ...columns.map((column) => cell(issue, column)),
      ]),
    ];
    if (request.format === 'csv') {
      return {
        body: toCsv(rows),
        type: 'text/csv; charset=utf-8',
        fileName: `vorgaenge-${stamp}.csv`,
      };
    }
    return {
      body: toXlsx(rows, 'Vorgänge'),
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `vorgaenge-${stamp}.xlsx`,
    };
  }
}
