import {
  type Announcements,
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
import { DotsSixVertical, DotsThree, GearSix, Plus, Warning } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type {
  Board,
  BoardColumn,
  BoardData,
  IssueSummary,
  Me,
  MoveCardRequest,
} from '@toolvibes/shared';
import { type MouseEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { boardDataQuery } from '../../lib/boards';
import { formatDate } from '../../lib/format';
import { useRecordView } from '../../lib/personal';
import { useRealtimeRooms } from '../../lib/realtime';
import { useCurrentProject } from '../../lib/shortcuts';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { CHIP, PageHeading, TopBar } from '../../ui/TopBar';
import { FavouriteButton } from '../personal/FavouriteButton';
import { CreateIssueDialog } from '../tracking/CreateIssueDialog';
import { IssueSplit, useWideScreen } from '../tracking/IssueSplit';
import { IssueTypeIcon, PriorityIcon } from '../tracking/icons';
import { useTransitionScreen } from '../tracking/TransitionDialog';
import { Avatar } from '../tracking/UserPicker';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { BoardTabs } from './BoardTabs';
import { CompleteSprintDialog } from './SprintDialogs';

interface Lane {
  id: string;
  title: string | null;
}

const cellId = (laneId: string, columnId: string) => `${laneId}::${columnId}`;

function laneOf(board: Board, issue: IssueSummary): string {
  if (board.swimlanes === 'assignee') return issue.assignee?.id ?? 'none';
  if (board.swimlanes === 'epic') return issue.parent?.key ?? 'none';
  return 'all';
}

/** Swimlanes in a stable order: by name, "none" (unassigned / no epic) last (T-BRD-06). */
function lanesOf(board: Board, issues: IssueSummary[], noneTitle: string): Lane[] {
  if (board.swimlanes === 'none') return [{ id: 'all', title: null }];
  const lanes = new Map<string, string>();
  for (const issue of issues) {
    const id = laneOf(board, issue);
    if (id === 'none') continue;
    lanes.set(
      id,
      board.swimlanes === 'assignee'
        ? (issue.assignee?.displayName ?? id)
        : `${issue.parent?.key} ${issue.parent?.summary}`,
    );
  }
  return [
    ...[...lanes.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, title]) => ({ id, title })),
    { id: 'none', title: noneTitle },
  ];
}

/** A plain left click; anything else (new tab, copy link) is left to the browser. */
function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface CardProps {
  issue: IssueSummary;
  columns: BoardColumn[];
  allowed: Set<string>;
  selected: boolean;
  onOpen?: (key: string) => void;
  onMove?: (columnId: string) => void;
}

/** A card that can be dragged by its handle or moved with its menu (E-54). */
function SortableCard(props: CardProps) {
  const sortable = useSortable({ id: props.issue.key });
  return (
    <CardView
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

function CardView({
  issue,
  columns,
  allowed,
  selected,
  onOpen,
  onMove,
  nodeRef,
  style,
  dragging = false,
  handle,
  floating = false,
}: CardProps & {
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
  handle?: object;
  floating?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      ref={nodeRef}
      style={style}
      data-selected={selected}
      className={`group flex gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] py-2.5 pr-2.5 pl-1.5 text-[13px] leading-[18px] hover:border-[var(--border-control)] data-[selected=true]:border-[var(--accent)] ${dragging ? 'opacity-40' : ''} ${floating ? 'shadow-[var(--shadow-float)]' : ''}`}
    >
      <button
        type="button"
        aria-label={t('boards.dragCard', { key: issue.key })}
        className="grid w-4 shrink-0 cursor-grab place-items-start pt-px text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--ink)] active:cursor-grabbing"
        {...handle}
      >
        <DotsSixVertical size={16} aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          to="/issues/$key"
          params={{ key: issue.key }}
          onClick={(event) => {
            if (!onOpen || !plainClick(event)) return;
            event.preventDefault();
            onOpen(issue.key);
          }}
          className="break-words text-[var(--ink)] no-underline hover:underline"
        >
          {issue.summary}
        </Link>
        <span className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.issueType} size={14} />
          <PriorityIcon priority={issue.priority} />
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--ink-muted)]">
            {issue.key}
          </span>
          <span className="ml-auto" />
          {issue.storyPoints !== null && (
            <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--ink-muted)]">
              {issue.storyPoints}
            </span>
          )}
          <span className="flex items-center gap-1">
            {issue.assignee && <Avatar user={issue.assignee} size={20} />}
            {onMove && issue.canTransition && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label={t('boards.moveCard', { key: issue.key })}
                  className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <DotsThree size={16} weight="bold" aria-hidden />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-50 min-w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
                  >
                    <DropdownMenu.Label className="px-2 py-1 text-xs text-[var(--ink-muted)]">
                      {t('boards.moveTo')}
                    </DropdownMenu.Label>
                    {columns.map((column) => (
                      <DropdownMenu.Item
                        key={column.id}
                        disabled={!allowed.has(column.id)}
                        onSelect={() => onMove(column.id)}
                        className="cursor-pointer rounded-[var(--radius-sm)] px-2 py-1.5 outline-none data-[disabled]:cursor-default data-[disabled]:opacity-45 data-[highlighted]:bg-[var(--surface-2)]"
                      >
                        {column.name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

function Cell({
  id,
  keys,
  state,
  children,
}: {
  id: string;
  keys: string[];
  state: 'idle' | 'allowed' | 'blocked';
  children: React.ReactNode;
}) {
  const droppable = useDroppable({ id });
  return (
    <SortableContext id={id} items={keys} strategy={verticalListSortingStrategy}>
      <div
        ref={droppable.setNodeRef}
        data-state={state}
        className="flex min-h-16 flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-2)] p-2.5 data-[state=allowed]:outline-2 data-[state=allowed]:outline-dashed data-[state=allowed]:outline-[var(--accent)] data-[state=blocked]:opacity-50"
      >
        {children}
      </div>
    </SortableContext>
  );
}

/** A board: columns by status, swimlanes, quick filters, drag and drop (T-BRD, E-53, E-54). */
export function BoardPage({
  me,
  id,
  filters,
  selected,
}: {
  me: Me;
  id: string;
  filters: string[];
  selected?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wide = useWideScreen();
  // With parallel sprints, one of them or all (E-113).
  const [sprintChoice, setSprintChoice] = useState<string | undefined>(undefined);
  const query = boardDataQuery(id, filters, sprintChoice);
  const data = useQuery(query);
  const [active, setActive] = useState<IssueSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const meta = useQuery(trackingMetaQuery).data;
  const doneStatusIds = useMemo(
    () =>
      new Set(
        (meta?.statuses ?? [])
          .filter((status) => status.category === 'done')
          .map((status) => status.id),
      ),
    [meta],
  );
  const planned = useQuery({
    queryKey: ['board', id, 'sprints', 'future'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/boards/{id}/sprints', {
          params: { path: { id }, query: { state: 'future' } },
        }),
      ),
    enabled: completing,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const board = data.data?.board;
  // Remembered for "Zuletzt angesehen" and the board list (TL-6).
  useRecordView('board', board?.id);
  const project = useQuery({
    ...projectQuery(board?.project.key ?? ''),
    enabled: board !== undefined,
  });
  const issues = data.data?.issues ?? [];
  // Others' changes on this board and its projects show up live (T-BRD-09).
  useCurrentProject(board?.project.key);
  useRealtimeRooms([
    `board:${id}`,
    ...(board ? [`project:${board.project.key}`] : []),
    ...issues.map((issue) => `project:${issue.project.key}`),
  ]);
  const lanes = useMemo(
    () =>
      board
        ? lanesOf(
            board,
            issues,
            t(board.swimlanes === 'epic' ? 'boards.noEpic' : 'boards.unassigned'),
          )
        : [],
    [board, issues, t],
  );
  const columnOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const column of board?.columns ?? []) {
      for (const statusId of column.statusIds) map.set(statusId, column.id);
    }
    return map;
  }, [board]);

  const cell = (issue: IssueSummary) =>
    board ? cellId(laneOf(board, issue), columnOf.get(issue.status.id) ?? '') : '';
  const keysIn = (target: string) =>
    issues.filter((issue) => cell(issue) === target).map((issue) => issue.key);

  /** The columns a card may go to now: its own and those with a reachable status. */
  const allowedFor = (issue: IssueSummary) => {
    const reachable = new Set(data.data?.reachable[issue.id] ?? []);
    return new Set(
      (board?.columns ?? [])
        .filter(
          (column) =>
            column.id === columnOf.get(issue.status.id) ||
            column.statusIds.some((statusId) => reachable.has(statusId)),
        )
        .map((column) => column.id),
    );
  };

  const select = (key: string | undefined) =>
    void navigate({
      to: '/boards/$id',
      params: { id },
      search: (previous) => ({ ...previous, selected: key }),
      replace: true,
    });

  const move = useMutation({
    mutationFn: (body: MoveCardRequest) =>
      unwrap(client.POST('/api/v1/boards/{id}/move', { params: { path: { id } }, body })),
    onMutate: async (body) => {
      // Show the card in its new place at once; the server answer replaces it.
      await queryClient.cancelQueries({ queryKey: query.queryKey });
      const previous = queryClient.getQueryData<BoardData>(query.queryKey);
      if (previous) {
        const column = previous.board.columns.find((entry) => entry.id === body.columnId);
        const moving = previous.issues.find((issue) => issue.key === body.issueKey);
        if (column && moving) {
          const stays = column.statusIds.includes(moving.status.id);
          const status =
            stays || !column.statusIds[0]
              ? moving.status
              : { ...moving.status, id: column.statusIds[0] };
          const rest = previous.issues.filter((issue) => issue.key !== body.issueKey);
          const anchor = body.beforeKey
            ? rest.findIndex((issue) => issue.key === body.beforeKey)
            : body.afterKey
              ? rest.findIndex((issue) => issue.key === body.afterKey) + 1
              : rest.length;
          rest.splice(anchor < 0 ? rest.length : anchor, 0, { ...moving, status });
          queryClient.setQueryData(query.queryKey, { ...previous, issues: rest });
        }
      }
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(query.queryKey, context.previous);
      setMessage(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['board', id] }),
  });

  // A pending move waits for the transition's dialog (TL-85); the dialog sends it with the fields.
  const [held, setHeld] = useState<MoveCardRequest | null>(null);
  const screen = useTransitionScreen((_issue, _transitionId, extras) =>
    held ? move.mutateAsync({ ...held, ...extras }) : Promise.resolve(),
  );

  /** Moves at once, or first asks in the dialog when the transition into the column wants it. */
  async function send(issue: IssueSummary, body: MoveCardRequest) {
    const column = board?.columns.find((entry) => entry.id === body.columnId);
    if (column && !column.statusIds.includes(issue.status.id)) {
      setHeld(body);
      const asked = await screen.ask(issue, (offered) =>
        column.statusIds
          .map((statusId) => offered.find((entry) => entry.to.id === statusId))
          .find(Boolean),
      );
      if (asked) return;
    }
    move.mutate(body);
  }

  function moveTo(issue: IssueSummary, columnId: string) {
    setMessage(null);
    void send(issue, { issueKey: issue.key, columnId });
  }

  function onDragStart(event: DragStartEvent) {
    setMessage(null);
    setActive(issues.find((issue) => issue.key === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const dragged = active;
    setActive(null);
    const { over } = event;
    if (!dragged || !over || !board) return;
    const overId = String(over.id);
    const target = overId.includes('::')
      ? overId
      : cell(issues.find((issue) => issue.key === overId) as IssueSummary);
    const columnId = target.split('::')[1] ?? '';
    if (!allowedFor(dragged).has(columnId)) {
      const name = board.columns.find((column) => column.id === columnId)?.name ?? '';
      setMessage(t('boards.notReachable', { key: dragged.key, column: name }));
      return;
    }
    const source = cell(dragged);
    const items = keysIn(target);
    let order: string[];
    if (source === target) {
      const from = items.indexOf(dragged.key);
      const to = overId.includes('::') ? items.length - 1 : items.indexOf(overId);
      if (from === to) return;
      order = arrayMove(items, from, to);
    } else {
      const at = overId.includes('::') ? items.length : items.indexOf(overId);
      order = [...items.slice(0, at), dragged.key, ...items.slice(at)];
    }
    const position = order.indexOf(dragged.key);
    // Without edit rights the card only changes column; its rank stays.
    const neighbours = dragged.canEdit
      ? { afterKey: order[position - 1] ?? null, beforeKey: order[position + 1] ?? null }
      : {};
    void send(dragged, { issueKey: dragged.key, columnId, ...neighbours });
  }

  const columnName = (columnId: string) =>
    board?.columns.find((column) => column.id === columnId)?.name ?? '';
  const announcements: Announcements = {
    onDragStart: ({ active: item }) => t('boards.announce.start', { key: String(item.id) }),
    onDragOver: ({ active: item, over }) =>
      over
        ? t('boards.announce.over', {
            key: String(item.id),
            column: columnName(
              String(over.id).includes('::')
                ? (String(over.id).split('::')[1] ?? '')
                : (columnOf.get(issues.find((issue) => issue.key === over.id)?.status.id ?? '') ??
                    ''),
            ),
          })
        : t('boards.announce.outside', { key: String(item.id) }),
    onDragEnd: ({ active: item }) => t('boards.announce.end', { key: String(item.id) }),
    onDragCancel: ({ active: item }) => t('boards.announce.cancel', { key: String(item.id) }),
  };

  function toggleFilter(filter: string) {
    const next = filters.includes(filter)
      ? filters.filter((entry) => entry !== filter)
      : [...filters, filter];
    void navigate({
      to: '/boards/$id',
      params: { id },
      search: (previous) => ({
        ...previous,
        filters: next.length > 0 ? next.join(',') : undefined,
      }),
      replace: true,
    });
  }

  if (data.error) {
    return <p className="px-6 py-8 text-[var(--ink-muted)]">{data.error.message}</p>;
  }
  if (!board) return <p className="px-6 py-8 text-[var(--ink-muted)]">{t('common.loading')}</p>;

  const allowed = active ? allowedFor(active) : null;
  const sprint = board.type === 'scrum' ? (data.data?.sprint ?? null) : null;
  // Status colours only where status is shown (E-67): the column's first status decides.
  const dotColor = (column: BoardColumn) => {
    const category = meta?.statuses.find((status) => status.id === column.statusIds[0])?.category;
    return category === 'done'
      ? 'var(--success)'
      : category === 'in_progress'
        ? 'var(--accent)'
        : 'var(--border-strong)';
  };
  const quick = [
    { id: 'mine', name: t('boards.onlyMine') },
    { id: 'recent', name: t('boards.recent') },
    ...board.quickFilters,
  ];

  return (
    <main className="flex flex-col">
      <TopBar
        crumbs={[
          <Link key="project" to="/projects/$key" params={{ key: board.project.key }} search={{}}>
            {board.project.name}
          </Link>,
          board.name,
        ]}
        actions={
          <>
            <FavouriteButton
              kind="board"
              refId={board.id}
              active={board.favourite}
              name={board.name}
            />
            {board.canConfigure && (
              <Button size="sm" onClick={() => setConfiguring(true)}>
                <GearSix size={14} aria-hidden />
                {t('boards.configure')}
              </Button>
            )}
          </>
        }
      />
      <PageHeading
        title={sprint ? sprint.name : board.name}
        subtitle={
          sprint ? (
            <>
              {sprint.endDate && t('sprints.until', { date: formatDate(sprint.endDate) })}
              {sprint.goal && ` · ${sprint.goal}`}
            </>
          ) : (
            board.project.name
          )
        }
        actions={
          <>
            {sprint && <Button onClick={() => setCompleting(true)}>{t('sprints.complete')}</Button>}
            {project.data?.permissions.includes('create-issues') && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={14} aria-hidden />
                {t('issues.create')}
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-3.5 px-6 pb-6">
        <BoardTabs id={id} type={board.type} current="board" />
        {board.type === 'scrum' && data.data && !data.data.sprint && (
          <p className="m-0 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[var(--ink-muted)]">
            {t('sprints.noActive')}{' '}
            <Link to="/boards/$id/backlog" params={{ id }} search={{}}>
              {t('sprints.toBacklog')}
            </Link>
          </p>
        )}

        {(data.data?.activeSprints.length ?? 0) > 1 && (
          <div role="toolbar" aria-label={t('sprints.choose')} className="flex flex-wrap gap-1.5">
            {[
              { id: undefined, name: t('sprints.allRunning') },
              ...(data.data?.activeSprints ?? []),
            ].map((entry) => (
              <button
                key={entry.id ?? 'all'}
                type="button"
                aria-pressed={sprintChoice === entry.id}
                onClick={() => setSprintChoice(entry.id)}
                className="h-7 rounded-full border border-[var(--border-strong)] px-3 text-[12.5px] aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
              >
                {entry.name}
              </button>
            ))}
          </div>
        )}
        <div
          role="toolbar"
          aria-label={t('boards.quickFilters')}
          className="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            aria-pressed={filters.length === 0}
            onClick={() =>
              void navigate({
                to: '/boards/$id',
                params: { id },
                search: (previous) => ({ ...previous, filters: undefined }),
              })
            }
            className={CHIP}
          >
            {t('boards.allIssues')}
          </button>
          {quick.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={filters.includes(filter.id)}
              onClick={() => toggleFilter(filter.id)}
              className={CHIP}
            >
              {filter.name}
            </button>
          ))}
        </div>

        {message && <FormError message={message} />}
        {screen.dialog}
        {data.data?.truncated && (
          <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-3 py-2">
            {t('boards.truncated')}
          </p>
        )}

        <IssueSplit me={me} selected={selected} onClose={() => select(undefined)}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActive(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: t('boards.announce.instructions') },
            }}
          >
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-x-3 gap-y-2"
                style={{
                  gridTemplateColumns: `repeat(${board.columns.length}, minmax(240px, 1fr))`,
                }}
              >
                {board.columns.map((column) => {
                  const count = issues.filter((issue) =>
                    column.statusIds.includes(issue.status.id),
                  ).length;
                  const over = column.wipMax !== null && count > column.wipMax;
                  const under = column.wipMin !== null && count < column.wipMin;
                  return (
                    <div
                      key={column.id}
                      data-limit={over ? 'over' : under ? 'under' : 'ok'}
                      className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-2)] px-2.5 py-2 data-[limit=over]:bg-[var(--danger-soft)] data-[limit=under]:bg-[var(--warning-soft)]"
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor(column) }}
                      />
                      <h2 className="m-0 truncate text-[13px] font-semibold">{column.name}</h2>
                      <span className="text-[12px] text-[var(--ink-muted)]">{count}</span>
                      {column.wipMax !== null && !(over || under) && (
                        <span className="ml-auto font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--ink-muted)]">
                          WIP {count}/{column.wipMax}
                        </span>
                      )}
                      {(over || under) && (
                        <span className="ml-auto flex items-center gap-1 text-xs font-semibold">
                          <Warning size={14} aria-hidden />
                          {over ? t('boards.overLimit') : t('boards.underLimit')}
                        </span>
                      )}
                    </div>
                  );
                })}
                {lanes.map((lane) => {
                  const laneIssues = issues.filter((issue) => laneOf(board, issue) === lane.id);
                  if (lane.title !== null && lane.id === 'none' && laneIssues.length === 0)
                    return null;
                  return [
                    lane.title !== null && (
                      <h3
                        key={`${lane.id}:title`}
                        className="m-0 mt-2 text-[12.5px] font-semibold text-[var(--ink-muted)]"
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {lane.title} · {laneIssues.length}
                      </h3>
                    ),
                    ...board.columns.map((column) => {
                      const id = cellId(lane.id, column.id);
                      const keys = keysIn(id);
                      const state = !allowed
                        ? 'idle'
                        : allowed.has(column.id)
                          ? 'allowed'
                          : 'blocked';
                      return (
                        <Cell key={id} id={id} keys={keys} state={state}>
                          {keys.map((key) => {
                            const issue = issues.find((entry) => entry.key === key) as IssueSummary;
                            return (
                              <SortableCard
                                key={key}
                                issue={issue}
                                columns={board.columns}
                                allowed={allowedFor(issue)}
                                selected={key === selected}
                                onOpen={wide ? select : undefined}
                                onMove={(columnId) => moveTo(issue, columnId)}
                              />
                            );
                          })}
                        </Cell>
                      );
                    }),
                  ];
                })}
              </div>
            </div>
            <DragOverlay>
              {active && (
                <CardView
                  issue={active}
                  columns={board.columns}
                  allowed={new Set()}
                  selected={false}
                  floating
                />
              )}
            </DragOverlay>
          </DndContext>
        </IssueSplit>
      </div>

      {board.canConfigure && (
        <BoardSettingsDialog board={board} open={configuring} onOpenChange={setConfiguring} />
      )}
      {project.data && (
        <CreateIssueDialog
          project={project.data}
          open={creating}
          onOpenChange={setCreating}
          myId={me.id}
        />
      )}
      {completing && data.data?.sprint && (
        <CompleteSprintDialog
          sprint={data.data.sprint}
          issues={issues}
          planned={planned.data ?? []}
          doneStatusIds={doneStatusIds}
          open
          onOpenChange={setCompleting}
        />
      )}
    </main>
  );
}
