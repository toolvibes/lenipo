import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, Plus } from '@phosphor-icons/react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { BacklogData, IssueSummary, Me, Sprint } from '@tasklore/shared';
import { type FormEvent, type MouseEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useRealtimeRooms } from '../../lib/realtime';
import { trackingMetaQuery, versionsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { IssueSplit, useWideScreen } from '../tracking/IssueSplit';
import { IssueTypeIcon, PriorityIcon, StatusLozenge } from '../tracking/icons';
import { Avatar } from '../tracking/UserPicker';
import { BoardTabs } from './BoardTabs';
import { CompleteSprintDialog, SprintDialog, useEstimate } from './SprintDialogs';

const BACKLOG = 'backlog';

interface Section {
  id: string;
  sprint: Sprint | null;
  issues: IssueSummary[];
}

function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface RowProps {
  issue: IssueSummary;
  checked: boolean;
  selected: boolean;
  onCheck: (event: MouseEvent<HTMLInputElement>) => void;
  onOpen?: (key: string) => void;
  estimate: string | null;
}

function Row(props: RowProps) {
  const sortable = useSortable({ id: props.issue.key });
  return (
    <RowView
      {...props}
      nodeRef={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      dragging={sortable.isDragging}
      handle={{ ...sortable.attributes, ...sortable.listeners }}
    />
  );
}

function RowView({
  issue,
  checked,
  selected,
  onCheck,
  onOpen,
  estimate,
  nodeRef,
  style,
  dragging = false,
  handle,
  floating = false,
}: RowProps & {
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
  handle?: object;
  floating?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li
      ref={nodeRef}
      style={style}
      data-checked={checked}
      data-selected={selected}
      className={`flex min-h-10 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-1)] px-2 last:border-b-0 data-[checked=true]:bg-[var(--accent-soft)] data-[selected=true]:outline data-[selected=true]:outline-[var(--accent)] ${dragging ? 'opacity-40' : ''} ${floating ? 'rounded-[var(--radius-md)] border shadow-[var(--shadow-float)]' : ''}`}
    >
      <button
        type="button"
        aria-label={t('boards.dragCard', { key: issue.key })}
        className="grid w-5 shrink-0 cursor-grab place-items-center text-[var(--ink-muted)] hover:text-[var(--ink)]"
        {...handle}
      >
        <DotsSixVertical size={16} aria-hidden />
      </button>
      <input
        type="checkbox"
        aria-label={t('sprints.select', { key: issue.key })}
        checked={checked}
        onClick={onCheck}
        onChange={() => undefined}
      />
      <IssueTypeIcon type={issue.issueType} size={14} />
      <PriorityIcon priority={issue.priority} />
      <Link
        to="/issues/$key"
        params={{ key: issue.key }}
        onClick={(event) => {
          if (!onOpen || !plainClick(event)) return;
          event.preventDefault();
          onOpen(issue.key);
        }}
        className="tl-key shrink-0 no-underline hover:underline"
      >
        {issue.key}
      </Link>
      <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
      {issue.parent && (
        <span
          className="hidden max-w-40 truncate rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold md:inline"
          title={`${issue.parent.key} ${issue.parent.summary}`}
        >
          {issue.parent.summary}
        </span>
      )}
      <StatusLozenge status={issue.status} />
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
        {estimate ?? '–'}
      </span>
      <span className="w-6 shrink-0">
        {issue.assignee && <Avatar user={issue.assignee} size={20} />}
      </span>
    </li>
  );
}

function SectionList({
  id,
  keys,
  children,
}: {
  id: string;
  keys: string[];
  children: React.ReactNode;
}) {
  const droppable = useDroppable({ id: `section:${id}` });
  return (
    <SortableContext id={id} items={keys} strategy={verticalListSortingStrategy}>
      <ul
        ref={droppable.setNodeRef}
        className="m-0 flex min-h-12 list-none flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] p-0"
      >
        {children}
      </ul>
    </SortableContext>
  );
}

/** Backlog of a Scrum board: open sprints, then the backlog (T-SPR-01 to -03, -06 to -08). */
export function BacklogPage({ me, id, selected }: { me: Me; id: string; selected?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wide = useWideScreen();
  const queryKey = ['board', id, 'backlog'];
  const data = useQuery({
    queryKey,
    queryFn: () => unwrap(client.GET('/api/v1/boards/{id}/backlog', { params: { path: { id } } })),
  });
  const meta = useQuery(trackingMetaQuery).data;
  const [checked, setChecked] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [epic, setEpic] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [active, setActive] = useState<IssueSummary | null>(null);
  const [editing, setEditing] = useState<{ sprint: Sprint; starting: boolean } | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const board = data.data?.board;
  useRealtimeRooms([
    `board:${id}`,
    ...(board ? [`project:${board.project.key}`] : []),
    ...(data.data?.backlog ?? []).map((issue) => `project:${issue.project.key}`),
    ...(data.data?.sprints ?? []).flatMap((entry) =>
      entry.issues.map((issue) => `project:${issue.project.key}`),
    ),
  ]);
  const estimate = useEstimate(board?.estimation ?? 'storyPoints');
  const doneStatusIds = useMemo(
    () =>
      new Set(
        (meta?.statuses ?? [])
          .filter((status) => status.category === 'done')
          .map((status) => status.id),
      ),
    [meta],
  );

  const sections: Section[] = useMemo(() => {
    if (!data.data) return [];
    const keep = (issues: IssueSummary[]) =>
      issues.filter(
        (issue) =>
          (!epic || issue.parent?.key === epic) &&
          (!version || issue.fixVersions.some((entry) => entry.id === version)),
      );
    return [
      ...data.data.sprints.map((entry) => ({
        id: entry.sprint.id,
        sprint: entry.sprint,
        issues: keep(entry.issues),
      })),
      { id: BACKLOG, sprint: null, issues: keep(data.data.backlog) },
    ];
  }, [data.data, epic, version]);
  const all = sections.flatMap((section) => section.issues);
  const epics = useMemo(() => {
    const found = new Map<string, string>();
    for (const entry of [
      ...(data.data?.sprints.flatMap((sprint) => sprint.issues) ?? []),
      ...(data.data?.backlog ?? []),
    ]) {
      if (entry.parent) found.set(entry.parent.key, entry.parent.summary);
    }
    return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.data]);
  // Unreleased versions of the board's projects (E-57): the location and those of its issues.
  const projectKeys = useMemo(() => {
    const keys = new Set<string>(board ? [board.project.key] : []);
    for (const entry of [
      ...(data.data?.sprints.flatMap((sprint) => sprint.issues) ?? []),
      ...(data.data?.backlog ?? []),
    ]) {
      keys.add(entry.project.key);
    }
    return [...keys].sort();
  }, [board, data.data]);
  const versionLists = useQueries({
    queries: projectKeys.map((key) => versionsQuery(key)),
  });
  const versions = projectKeys.flatMap((key, index) =>
    (versionLists[index]?.data ?? [])
      .filter((entry) => !entry.released && !entry.archived)
      .map((entry) => ({ ...entry, projectKey: key })),
  );
  const sectionOf = (key: string) =>
    sections.find((section) => section.issues.some((issue) => issue.key === key));
  const running = data.data?.sprints.some((entry) => entry.sprint.state === 'active') ?? false;
  const planned = (data.data?.sprints ?? [])
    .map((entry) => entry.sprint)
    .filter((sprint) => sprint.state === 'future');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['board', id] });
  const fail = (error: Error) => {
    setMessage(error.message);
    void refresh();
  };

  /** Moves issues into a section, then ranks them as a block after or before a neighbour. */
  const move = useMutation({
    mutationFn: async ({
      keys,
      sectionId,
      afterKey,
      beforeKey,
    }: {
      keys: string[];
      sectionId: string;
      afterKey?: string | null;
      beforeKey?: string | null;
    }) => {
      const leaving = keys.filter((key) => sectionOf(key)?.id !== sectionId);
      if (leaving.length > 0) {
        await unwrap(
          client.POST('/api/v1/sprints/move-issues', {
            body: { issueKeys: leaving, sprintId: sectionId === BACKLOG ? null : sectionId },
          }),
        );
      }
      // Ranked one after the other, so the block keeps its order.
      let after = afterKey ?? null;
      for (const [index, key] of keys.entries()) {
        const body =
          index === 0 && !after
            ? beforeKey
              ? { beforeKey }
              : null
            : { afterKey: after, ...(beforeKey ? { beforeKey } : {}) };
        if (body) {
          await unwrap(
            client.PUT('/api/v1/issues/{key}/rank', { params: { path: { key } }, body }),
          );
        }
        after = key;
      }
    },
    onSuccess: () => {
      setChecked([]);
      void refresh();
    },
    onError: fail,
  });

  /** Adds a fix version to the selected issues of its project. */
  const assignVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const target = versions.find((entry) => entry.id === versionId);
      const chosen = all.filter(
        (issue) => checked.includes(issue.key) && issue.project.key === target?.projectKey,
      );
      for (const issue of chosen) {
        const ids = [...new Set([...issue.fixVersions.map((entry) => entry.id), versionId])];
        await unwrap(
          client.PATCH('/api/v1/issues/{key}', {
            params: { path: { key: issue.key } },
            body: { fixVersions: ids },
          }),
        );
      }
    },
    onSuccess: () => {
      setChecked([]);
      void refresh();
    },
    onError: fail,
  });

  const createSprint = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/boards/{id}/sprints', { params: { path: { id } }, body: {} })),
    onSuccess: () => void refresh(),
    onError: fail,
  });
  const deleteSprint = useMutation({
    mutationFn: (sprintId: string) =>
      unwrap(client.DELETE('/api/v1/sprints/{id}', { params: { path: { id: sprintId } } })),
    onSuccess: () => void refresh(),
    onError: fail,
  });
  const createIssue = useMutation({
    mutationFn: async (text: string) => {
      const issue = await unwrap(
        client.POST('/api/v1/issues', {
          body: { projectKey: board?.project.key ?? '', issueType: 'story', summary: text },
        }),
      );
      // New issues join the bottom of the backlog.
      const last = data.data?.backlog.at(-1);
      if (last) {
        await unwrap(
          client.PUT('/api/v1/issues/{key}/rank', {
            params: { path: { key: issue.key } },
            body: { afterKey: last.key },
          }),
        );
      }
    },
    onSuccess: () => {
      setSummary('');
      void refresh();
    },
    onError: fail,
  });

  function check(key: string, event: MouseEvent<HTMLInputElement>) {
    setMessage(null);
    const keys = all.map((issue) => issue.key);
    if (event.shiftKey && anchor) {
      const [from, to] = [keys.indexOf(anchor), keys.indexOf(key)].sort((a, b) => a - b);
      const range = keys.slice(from, (to ?? 0) + 1);
      setChecked([...new Set([...checked, ...range])]);
    } else {
      setChecked(
        checked.includes(key) ? checked.filter((entry) => entry !== key) : [...checked, key],
      );
    }
    setAnchor(key);
  }

  function select(key: string | undefined) {
    void navigate({
      to: '/boards/$id/backlog',
      params: { id },
      search: { selected: key },
      replace: true,
    });
  }

  function onDragStart(event: DragStartEvent) {
    setMessage(null);
    setActive(all.find((issue) => issue.key === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const dragged = active;
    setActive(null);
    const { over } = event;
    if (!dragged || !over) return;
    const overId = String(over.id);
    const target = overId.startsWith('section:')
      ? sections.find((section) => `section:${section.id}` === overId)
      : sectionOf(overId);
    if (!target) return;
    // Dragging a checked row takes the whole selection along (E-55).
    const block = checked.includes(dragged.key)
      ? all.map((issue) => issue.key).filter((key) => checked.includes(key))
      : [dragged.key];
    const items = target.issues.map((issue) => issue.key);
    let order: string[];
    if (block.length === 1 && sectionOf(dragged.key)?.id === target.id) {
      const from = items.indexOf(dragged.key);
      const to = overId.startsWith('section:') ? items.length - 1 : items.indexOf(overId);
      if (from === to) return;
      order = arrayMove(items, from, to);
    } else {
      const rest = items.filter((key) => !block.includes(key));
      const at = overId.startsWith('section:') ? rest.length : rest.indexOf(overId);
      order = [
        ...rest.slice(0, at < 0 ? rest.length : at),
        ...block,
        ...rest.slice(at < 0 ? rest.length : at),
      ];
    }
    const first = order.indexOf(block[0] as string);
    move.mutate({
      keys: block,
      sectionId: target.id,
      afterKey: order[first - 1] ?? null,
      beforeKey: order[first + block.length] ?? null,
    });
  }

  function moveSelection(sectionId: string, where: 'top' | 'bottom' | 'end' = 'end') {
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    const block = all.map((issue) => issue.key).filter((key) => checked.includes(key));
    const rest = target.issues.map((issue) => issue.key).filter((key) => !block.includes(key));
    move.mutate(
      where === 'top'
        ? { keys: block, sectionId, beforeKey: rest[0] ?? null }
        : { keys: block, sectionId, afterKey: rest.at(-1) ?? null },
    );
  }

  function addIssue(event: FormEvent) {
    event.preventDefault();
    if (summary.trim()) createIssue.mutate(summary.trim());
  }

  if (data.error) return <p className="px-6 py-8 text-[var(--ink-muted)]">{data.error.message}</p>;
  if (!board) return <p className="px-6 py-8 text-[var(--ink-muted)]">{t('common.loading')}</p>;
  const checkedSection =
    checked.length > 0
      ? sections.find((section) => section.issues.some((issue) => checked.includes(issue.key)))
      : null;

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-[var(--ink-muted)]">{board.project.name}</span>
          <h1 className="tl-heading-xl">{board.name}</h1>
        </div>
        <Button onClick={() => createSprint.mutate()} disabled={createSprint.isPending}>
          <Plus size={16} aria-hidden />
          {t('sprints.create')}
        </Button>
      </header>
      <BoardTabs id={id} type={board.type} current="backlog" />
      {message && <FormError message={message} />}
      {data.data?.truncated && (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-3 py-2">
          {t('sprints.truncated')}
        </p>
      )}

      {checked.length > 0 && (
        <div
          role="toolbar"
          aria-label={t('sprints.selection')}
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--surface-1)] px-3 py-2"
        >
          <span className="font-semibold">{t('sprints.checked', { count: checked.length })}</span>
          <select
            aria-label={t('sprints.moveSelection')}
            value=""
            onChange={(event) => event.target.value && moveSelection(event.target.value)}
            className="h-[var(--control-sm)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
          >
            <option value="">{t('sprints.moveSelection')}</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.sprint ? section.sprint.name : t('sprints.backlog')}
              </option>
            ))}
          </select>
          {versions.length > 0 && (
            <select
              aria-label={t('versions.assign')}
              value=""
              onChange={(event) => event.target.value && assignVersion.mutate(event.target.value)}
              className="h-[var(--control-sm)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            >
              <option value="">{t('versions.assign')}</option>
              {versions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {projectKeys.length > 1 ? `${entry.projectKey} ` : ''}
                  {entry.name}
                </option>
              ))}
            </select>
          )}
          {checkedSection && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => moveSelection(checkedSection.id, 'top')}
              >
                {t('sprints.toTop')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => moveSelection(checkedSection.id, 'bottom')}
              >
                {t('sprints.toBottom')}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setChecked([])}>
            {t('sprints.clearSelection')}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {(epics.length > 0 || versions.length > 0) && (
          <div className="flex shrink-0 flex-col gap-4 lg:w-52">
            {versions.length > 0 && (
              <nav aria-label={t('versions.panel')} className="flex flex-col gap-0.5">
                <h2 className="tl-label px-2 uppercase text-[var(--ink-muted)]">
                  {t('versions.panel')}
                </h2>
                {[{ id: null, name: t('versions.all'), projectKey: '' }, ...versions].map(
                  (entry) => (
                    <button
                      key={entry.id ?? 'all'}
                      type="button"
                      aria-pressed={version === entry.id}
                      onClick={() => setVersion(entry.id)}
                      className="truncate rounded-[var(--radius-md)] px-2 py-1 text-left hover:bg-[var(--surface-2)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
                    >
                      {entry.name}
                      {entry.id && projectKeys.length > 1 && (
                        <span className="ml-1 text-xs text-[var(--ink-muted)]">
                          {entry.projectKey}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </nav>
            )}
            {epics.length > 0 && (
              <nav aria-label={t('sprints.epics')} className="flex flex-col gap-0.5">
                <h2 className="tl-label px-2 uppercase text-[var(--ink-muted)]">
                  {t('sprints.epics')}
                </h2>
                {[[null, t('sprints.allEpics')] as const, ...epics].map(([key, name]) => (
                  <button
                    key={key ?? 'all'}
                    type="button"
                    aria-pressed={epic === key}
                    onClick={() => setEpic(key)}
                    className="truncate rounded-[var(--radius-md)] px-2 py-1 text-left hover:bg-[var(--surface-2)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
                  >
                    {name}
                  </button>
                ))}
              </nav>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <IssueSplit me={me} selected={selected} onClose={() => select(undefined)}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActive(null)}
              accessibility={{
                screenReaderInstructions: { draggable: t('boards.announce.instructions') },
              }}
            >
              {sections.map((section) => {
                const sprint = section.sprint;
                return (
                  <section
                    key={section.id}
                    aria-label={sprint ? sprint.name : t('sprints.backlog')}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="tl-heading-md m-0">
                        {sprint ? sprint.name : t('sprints.backlog')}
                      </h2>
                      {sprint?.state === 'active' && (
                        <span className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 text-xs font-semibold text-[var(--accent)] uppercase">
                          {t('sprints.active')}
                        </span>
                      )}
                      {sprint?.startDate && (
                        <span className="text-xs text-[var(--ink-muted)]">
                          {formatDate(sprint.startDate)} –{' '}
                          {sprint.endDate ? formatDate(sprint.endDate) : '…'}
                        </span>
                      )}
                      <span className="text-xs text-[var(--ink-muted)]">
                        {t('sprints.count', { count: section.issues.length })} ·{' '}
                        {estimate(section.issues)}
                      </span>
                      {sprint && (
                        <span className="ml-auto flex flex-wrap gap-1">
                          {sprint.state === 'future' && !running && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setEditing({ sprint, starting: true })}
                            >
                              {t('sprints.startAction')}
                            </Button>
                          )}
                          {sprint.state === 'active' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setCompleting(sprint)}
                            >
                              {t('sprints.complete')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing({ sprint, starting: false })}
                          >
                            {t('sprints.edit')}
                          </Button>
                          {sprint.state === 'future' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSprint.mutate(sprint.id)}
                            >
                              {t('sprints.delete')}
                            </Button>
                          )}
                        </span>
                      )}
                    </div>
                    {sprint?.goal && <p className="m-0 text-[var(--ink-muted)]">{sprint.goal}</p>}
                    <SectionList id={section.id} keys={section.issues.map((issue) => issue.key)}>
                      {section.issues.length === 0 && (
                        <li className="px-3 py-3 text-[var(--ink-muted)]">
                          {sprint ? t('sprints.emptySprint') : t('sprints.emptyBacklog')}
                        </li>
                      )}
                      {section.issues.map((issue) => (
                        <Row
                          key={issue.key}
                          issue={issue}
                          checked={checked.includes(issue.key)}
                          selected={issue.key === selected}
                          onCheck={(event) => check(issue.key, event)}
                          onOpen={wide ? select : undefined}
                          estimate={board.estimation === 'issueCount' ? null : estimate([issue])}
                        />
                      ))}
                    </SectionList>
                    {!sprint && (
                      <form onSubmit={addIssue} className="flex gap-2">
                        <input
                          aria-label={t('sprints.quickCreate')}
                          placeholder={t('sprints.quickCreate')}
                          value={summary}
                          maxLength={255}
                          onChange={(event) => setSummary(event.target.value)}
                          className="h-[var(--control-sm)] min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
                        />
                        <Button
                          size="sm"
                          type="submit"
                          disabled={!summary.trim() || createIssue.isPending}
                        >
                          {t('sprints.add')}
                        </Button>
                      </form>
                    )}
                  </section>
                );
              })}
              <DragOverlay>
                {active && (
                  <ul className="m-0 list-none p-0">
                    <RowView
                      issue={active}
                      checked={checked.includes(active.key)}
                      selected={false}
                      onCheck={() => undefined}
                      estimate={null}
                      floating
                    />
                  </ul>
                )}
              </DragOverlay>
            </DndContext>
          </IssueSplit>
        </div>
      </div>

      {editing && (
        <SprintDialog
          sprint={editing.sprint}
          starting={editing.starting}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onDone={() => void refresh()}
        />
      )}
      {completing && (
        <CompleteSprintDialog
          sprint={completing}
          issues={
            (data.data as BacklogData).sprints.find((entry) => entry.sprint.id === completing.id)
              ?.issues ?? []
          }
          planned={planned}
          doneStatusIds={doneStatusIds}
          open
          onOpenChange={(open) => !open && setCompleting(null)}
        />
      )}
    </main>
  );
}
