import { NotFoundException } from '@nestjs/common';
import type { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import type { SearchService } from '../search/search.service.js';
import type { SpaceService } from '../wiki/space.service.js';
import type { IssueService } from './issue.service.js';
import type { ProjectService } from './project.service.js';
import type { VersionService } from './version.service.js';

/**
 * The project's own backlog from its roadmap (E-77): an epic per open phase and one for the
 * leftovers of finished phases, a story per row of a phase table (or bullet), with the
 * features it names, their texts and priorities from the feature lists. A migration tool:
 * issues that exist already (same type and summary) are left alone, so a rerun only adds
 * what is missing and never overwrites what was changed in the tool.
 */

export interface Feature {
  text: string;
  priority: string;
}

export interface PlannedIssue {
  summary: string;
  description: string;
  fixVersion: string | null;
}

export interface PlannedEpic extends PlannedIssue {
  stories: PlannedIssue[];
}

const TABLE_ROW = /^\|(.*)\|\s*$/;
const cells = (line: string) =>
  (TABLE_ROW.exec(line)?.[1] ?? '').split(/(?<!\\)\|/).map((cell) => cell.trim());
const plain = (text: string) =>
  text
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "T-WF-02, -04 bis -06, P-PRM-02" → T-WF-02, T-WF-04, T-WF-05, T-WF-06, P-PRM-02. */
export function expandFeatureIds(text: string): string[] {
  const ids: string[] = [];
  let prefix = '';
  let width = 2;
  let range = false;
  for (const [token] of text.matchAll(/[A-Z]-[A-Z]+-\d+|-\d+|bis/g)) {
    if (token === 'bis') {
      range = true;
      continue;
    }
    const full = /^([A-Z]-[A-Z]+)-(\d+)$/.exec(token);
    if (full) {
      prefix = full[1] as string;
      width = (full[2] as string).length;
    }
    const number = Number(token.slice(token.lastIndexOf('-') + 1));
    if (!prefix) continue;
    const from = range ? Number(ids.at(-1)?.split('-').at(-1) ?? number) + 1 : number;
    for (let value = from; value <= number; value++) {
      ids.push(`${prefix}-${String(value).padStart(width, '0')}`);
    }
    range = false;
  }
  return ids;
}

/** Feature IDs with text and priority from the tables `| ID | Feature | Prio |`. */
export function featureCatalog(markdown: string[]): Map<string, Feature> {
  const catalog = new Map<string, Feature>();
  for (const text of markdown) {
    for (const line of text.split('\n')) {
      const [id, feature, priority] = cells(line);
      if (id && feature && priority && /^[A-Z]-[A-Z]+-\d+$/.test(id)) {
        catalog.set(id, { text: feature, priority });
      }
    }
  }
  return catalog;
}

interface Phase {
  number: number;
  title: string;
  milestone: string | null;
  goal: string;
  done: string;
  rows: Array<{ content: string; ids: string }>;
}

/** The phases of the roadmap with their tables or bullet lists, and the "Offen aus …" lines. */
export function parseRoadmap(markdown: string): { phases: Phase[]; leftovers: string[] } {
  const phases: Phase[] = [];
  const leftovers: string[] = [];
  let phase: Phase | null = null;
  for (const line of markdown.split('\n')) {
    const heading = /^## Phase (\d+): (.+?)(?: \([^)]*\))?(?: → ◆ (.+))?$/.exec(line);
    if (heading) {
      phase = {
        number: Number(heading[1]),
        title: (heading[2] as string).trim(),
        milestone: heading[3]?.trim() ?? null,
        goal: '',
        done: '',
        rows: [],
      };
      phases.push(phase);
      continue;
    }
    if (line.startsWith('## ')) {
      phase = null;
      continue;
    }
    const open = /^Offen aus Phase \d+: (.+)$/.exec(line);
    if (open) {
      leftovers.push(
        ...(open[1] as string)
          .split(';')
          .map((item) => item.trim().replace(/\.$/, ''))
          .filter(Boolean),
      );
      continue;
    }
    if (!phase) continue;
    if (line.startsWith('**Ziel:**')) phase.goal = line.slice('**Ziel:**'.length).trim();
    else if (/^\*\*Fertig\b/.test(line)) phase.done = line;
    else if (TABLE_ROW.test(line)) {
      const [content, ids] = cells(line);
      if (content && content !== 'Inhalt' && !/^-+$/.test(content)) {
        phase.rows.push({ content, ids: ids ?? '' });
      }
    } else if (/^- /.test(line)) phase.rows.push({ content: line.slice(2).trim(), ids: '' });
  }
  return { phases, leftovers };
}

/** Epics and stories for the phases from `fromPhase` on; up to the milestone they get its version. */
export function planBacklog(
  roadmap: ReturnType<typeof parseRoadmap>,
  catalog: Map<string, Feature>,
  options: { fromPhase: number; version: string },
): PlannedEpic[] {
  const open = roadmap.phases.filter((phase) => phase.number >= options.fromPhase);
  const last = open.find((phase) => phase.milestone?.includes(options.version))?.number;
  const versionOf = (number: number) =>
    last !== undefined && number <= last ? options.version : null;
  const epics: PlannedEpic[] = [];
  if (roadmap.leftovers.length > 0) {
    epics.push({
      summary: `Reste aus Phase 1–${options.fromPhase - 1}`,
      description: 'Was aus den fertigen Phasen noch offen ist.',
      fixVersion: last !== undefined ? options.version : null,
      stories: roadmap.leftovers.map((item) => ({
        summary: plain(item).slice(0, 255),
        description: `Offen aus den fertigen Phasen: ${item}`,
        fixVersion: last !== undefined ? options.version : null,
      })),
    });
  }
  for (const phase of open) {
    const context = `Aus der Roadmap, Phase ${phase.number} (${phase.title}).`;
    epics.push({
      summary: `Phase ${phase.number}: ${phase.title}`,
      description: [phase.goal && `**Ziel:** ${phase.goal}`, phase.done]
        .filter(Boolean)
        .join('\n\n'),
      fixVersion: versionOf(phase.number),
      stories: phase.rows.map((row) => {
        const ids = expandFeatureIds(row.ids);
        const table = ids.map((id) => {
          const feature = catalog.get(id);
          return `| ${id} | ${feature?.text ?? '(nicht in den Feature-Listen)'} | ${feature?.priority ?? ''} |`;
        });
        const parts = [`${context} ${row.content}`];
        if (table.length > 0) {
          parts.push(['| ID | Feature | Prio |', '| --- | --- | --- |', ...table].join('\n'));
        }
        return {
          summary: plain(row.content).slice(0, 255),
          description: parts.join('\n\n'),
          fixVersion: versionOf(phase.number),
        };
      }),
    });
  }
  return epics;
}

export interface BacklogServices {
  projects: ProjectService;
  boards: BoardService;
  versions: VersionService;
  issues: IssueService;
  search: SearchService;
  spaces: SpaceService;
}

export interface BacklogResult {
  created: string[];
  existing: number;
}

/**
 * Creates the project, its Scrum board and the version when missing, links the wiki space of
 * the same key, and adds the planned issues that do not exist yet.
 */
export async function importBacklog(
  services: BacklogServices,
  principal: Principal,
  epics: PlannedEpic[],
  options: { projectKey: string; projectName: string },
): Promise<BacklogResult> {
  const key = options.projectKey.toUpperCase();
  if (!(await services.projects.list(principal)).some((project) => project.key === key)) {
    await services.projects.create(principal, {
      key,
      name: options.projectName,
      description: '',
      template: 'scrum',
    });
  }
  if (!(await services.boards.list(principal, key)).some((board) => board.type === 'scrum')) {
    await services.boards.create(principal, {
      name: options.projectName,
      projectKey: key,
      type: 'scrum',
    });
  }
  const space = await services.spaces.get(principal, key).catch((error: unknown) => {
    if (error instanceof NotFoundException) return null;
    throw error;
  });
  if (space && !space.project) {
    await services.spaces.update(principal, key, { projectKey: key });
  }
  const versions = new Set((await services.versions.list(principal, key)).map((v) => v.name));
  for (const name of new Set(
    epics.flatMap((epic) => [epic, ...epic.stories]).map((i) => i.fixVersion),
  )) {
    if (name && !versions.has(name)) {
      await services.versions.create(principal, key, {
        name,
        description: '',
        startDate: null,
        releaseDate: null,
      });
    }
  }

  const known = new Map<string, string>();
  for (let offset = 0; ; offset += 100) {
    const page = await services.search.search(principal, {
      query: `project = ${key}`,
      limit: 100,
      offset,
    });
    for (const issue of page.issues)
      known.set(`${issue.issueType.key}:${issue.summary}`, issue.key);
    if (offset + page.issues.length >= page.total) break;
  }

  const result: BacklogResult = { created: [], existing: 0 };
  const ensure = async (type: string, planned: PlannedIssue, parentKey: string | null) => {
    const found = known.get(`${type}:${planned.summary}`);
    if (found) {
      result.existing += 1;
      return found;
    }
    const issue = await services.issues.create(principal, {
      projectKey: key,
      issueType: type,
      summary: planned.summary,
      description: { markdown: planned.description },
      assigneeId: null,
      parentKey,
      labels: [],
      storyPoints: null,
      startDate: null,
      dueDate: null,
      components: [],
      fixVersions: planned.fixVersion ? [planned.fixVersion] : [],
      affectsVersions: [],
      customFields: {},
    });
    known.set(`${type}:${planned.summary}`, issue.key);
    result.created.push(issue.key);
    return issue.key;
  };
  for (const epic of epics) {
    const epicKey = await ensure('epic', epic, null);
    for (const story of epic.stories) await ensure('story', story, epicKey);
  }
  return result;
}
