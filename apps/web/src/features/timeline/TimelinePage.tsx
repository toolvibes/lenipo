import { CaretDown, CaretRight, DotsThree, LinkSimple, Warning } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type {
  TimelineConflict,
  TimelineDependency,
  TimelineEpic,
  TimelineMilestone,
  TimelineRow,
  TimelineSpan,
} from '@toolvibes/shared';
import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useRealtimeRooms } from '../../lib/realtime';
import { useCurrentProject } from '../../lib/shortcuts';
import { projectQuery, timelineQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { PageHeading, TopBar } from '../../ui/TopBar';
import { IssueTypeIcon, STATUS_TONE } from '../tracking/icons';
import {
  columns,
  DAY_WIDTH,
  fromDay,
  toDay,
  today as todayDay,
  visibleRange,
  type Zoom,
} from './scale';

const ZOOMS: Zoom[] = ['weeks', 'months', 'quarters'];
const EPIC_ROW = 'h-14';
const CHILD_ROW = 'h-10';
const HEADER = 'h-14';
/** Pixel heights of the classes above, for drawing dependency arrows between rows. */
const EPIC_HEIGHT = 56;
const CHILD_HEIGHT = 40;
const HEADER_HEIGHT = 56;

type DragMode = 'move' | 'start' | 'end';
interface Drag {
  key: string;
  mode: DragMode;
  x: number;
  span: TimelineSpan;
  days: number;
}

/** The span a drag would leave behind. */
function dragged(drag: Drag): { start: string; end: string } {
  const start = toDay(drag.span.start);
  const end = toDay(drag.span.end);
  if (drag.mode === 'move')
    return { start: fromDay(start + drag.days), end: fromDay(end + drag.days) };
  if (drag.mode === 'start')
    return { start: fromDay(Math.min(start + drag.days, end)), end: drag.span.end };
  return { start: drag.span.start, end: fromDay(Math.max(end + drag.days, start)) };
}

function DatesDialog({
  row,
  onClose,
  onSave,
  busy,
  error,
}: {
  row: TimelineRow | null;
  onClose: () => void;
  onSave: (startDate: string | null, dueDate: string | null) => void;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState('');
  const [due, setDue] = useState('');
  const [order, setOrder] = useState(false);
  useEffect(() => {
    setStart(row?.issue.startDate ?? row?.span?.start ?? '');
    setDue(row?.issue.dueDate ?? row?.span?.end ?? '');
    setOrder(false);
  }, [row]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (start && due && start > due) return setOrder(true);
    onSave(start || null, due || null);
  };
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('timeline.setDatesTitle', { key: row?.issue.key ?? '' })}
      description={t('timeline.setDatesHelp')}
      width={420}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {(order || error) && (
          <FormError message={order ? t('timeline.orderError') : (error ?? '')} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('issues.startDate')}
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <TextField
            label={t('issues.dueDate')}
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Adds and removes "blocks" links of one issue without dragging (TL-23, E-104). */
function DependencyDialog({
  row,
  rows,
  dependencies,
  onClose,
  onAdd,
  onRemove,
  busy,
  error,
}: {
  row: TimelineRow | null;
  rows: TimelineRow[];
  dependencies: TimelineDependency[];
  onClose: () => void;
  onAdd: (from: string, to: string) => void;
  onRemove: (dependency: TimelineDependency) => void;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [other, setOther] = useState('');
  const [direction, setDirection] = useState<'blocks' | 'blocked'>('blocks');
  // A fresh form for each issue.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the row changes
  useEffect(() => {
    setOther('');
    setDirection('blocks');
  }, [row]);
  const key = row?.issue.key ?? '';
  const own = dependencies.filter((entry) => entry.from === key || entry.to === key);
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('timeline.dependenciesTitle', { key })}
      description={t('timeline.dependenciesHelp')}
      width={480}
    >
      <div className="flex flex-col gap-4">
        {error && <FormError message={error} />}
        {own.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
            {own.map((entry) => (
              <li
                key={entry.linkId}
                className="flex items-center gap-2 border-b border-[var(--border)] py-1.5"
              >
                <span className="min-w-0 flex-1">
                  {entry.from === key
                    ? t('timeline.blocksOther', { key: entry.to })
                    : t('timeline.blockedBy', { key: entry.from })}
                  {entry.conflict && (
                    <span className="ml-2 text-[var(--danger)]">{t('timeline.conflict')}</span>
                  )}
                </span>
                <Button size="sm" disabled={busy} onClick={() => onRemove(entry)}>
                  {t('timeline.removeDependency')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={t('timeline.direction')}
            value={direction}
            options={[
              { value: 'blocks', label: t('timeline.thisBlocks') },
              { value: 'blocked', label: t('timeline.thisIsBlocked') },
            ]}
            onChange={(event) => setDirection(event.target.value as 'blocks' | 'blocked')}
          />
          <Select
            label={t('timeline.otherIssue')}
            value={other}
            options={[
              { value: '', label: t('timeline.chooseIssue') },
              ...rows
                .filter((entry) => entry.issue.key !== key)
                .map((entry) => ({
                  value: entry.issue.key,
                  label: `${entry.issue.key} ${entry.issue.summary}`,
                })),
            ]}
            onChange={(event) => setOther(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!other || busy}
            onClick={() => (direction === 'blocks' ? onAdd(key, other) : onAdd(other, key))}
          >
            {t('timeline.addDependency')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** A milestone's issues and conflicts; administrators move its release date here too. */
function MilestoneDialog({
  milestone,
  conflicts,
  editable,
  onClose,
  onSave,
  busy,
  error,
}: {
  milestone: TimelineMilestone | null;
  conflicts: TimelineConflict[];
  editable: boolean;
  onClose: () => void;
  onSave: (date: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  useEffect(() => setDate(milestone?.date ?? ''), [milestone]);
  const late = new Map(
    conflicts.flatMap((conflict) =>
      conflict.kind === 'milestone' && conflict.version === milestone?.name
        ? [[conflict.issueKey, conflict.days] as const]
        : [],
    ),
  );
  return (
    <Dialog
      open={milestone !== null}
      onOpenChange={(open) => !open && onClose()}
      title={milestone?.name ?? ''}
      description={t('timeline.milestoneHelp')}
      width={440}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (date) onSave(date);
        }}
      >
        {error && <FormError message={error} />}
        <TextField
          label={t('timeline.releaseDate')}
          type="date"
          value={date}
          disabled={!editable || milestone?.released}
          onChange={(event) => setDate(event.target.value)}
        />
        <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
          {(milestone?.issueKeys ?? []).map((key) => (
            <li key={key} className="flex gap-2 border-b border-[var(--border)] py-1">
              <Link to="/issues/$key" params={{ key }} className="tl-key">
                {key}
              </Link>
              {late.has(key) && (
                <span className="text-[var(--danger)]">
                  {t('timeline.lateBy', { count: late.get(key) ?? 0 })}
                </span>
              )}
            </li>
          ))}
          {milestone?.issueKeys.length === 0 && (
            <li className="text-[var(--ink-muted)]">{t('timeline.noMilestoneIssues')}</li>
          )}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {editable && !milestone?.released && (
            <Button type="submit" variant="primary" disabled={busy || !date}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

let measure: CanvasRenderingContext2D | null = null;

/** The width of `text` in the interface font at `font` (weight and size), for bar labels. */
function textWidth(text: string, font: string): number {
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure) return text.length * 7;
  measure.font = `${font} ${getComputedStyle(document.body).fontFamily}`;
  return measure.measureText(text).width;
}

/**
 * Epics and their issues as bars over time, with milestones (T-RDM-01, -05, E-68), and
 * "blocks" dependencies with conflicts (T-RDM-02, TL-23, E-104).
 */
export function TimelinePage({ projectKey }: { projectKey: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const project = useQuery(projectQuery(projectKey));
  const timeline = useQuery(timelineQuery(projectKey));
  useCurrentProject(projectKey);
  useRealtimeRooms([`project:${projectKey}`]);
  const [zoom, setZoom] = useState<Zoom>('months');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TimelineRow | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can come faster than renders; handlers read the ref.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const scroller = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const [linkingRow, setLinkingRow] = useState<TimelineRow | null>(null);
  const [milestoneOpen, setMilestoneOpen] = useState<TimelineMilestone | null>(null);
  // Drawing a new dependency from a bar's handle: start and pointer in chart coordinates.
  const [linkDrag, setLinkDragState] = useState<{
    from: string;
    x0: number;
    y0: number;
    x: number;
    y: number;
  } | null>(null);
  const linkDragRef = useRef<typeof linkDrag>(null);
  const setLinkDrag = (next: typeof linkDrag) => {
    linkDragRef.current = next;
    setLinkDragState(next);
  };
  const [milestoneDrag, setMilestoneDragState] = useState<{
    milestone: TimelineMilestone;
    x: number;
    days: number;
  } | null>(null);
  const milestoneDragRef = useRef<typeof milestoneDrag>(null);
  // A drag ends with a click; that click must not open the dialog.
  const draggedMilestone = useRef(false);
  const setMilestoneDrag = (next: typeof milestoneDrag) => {
    milestoneDragRef.current = next;
    setMilestoneDragState(next);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timeline', projectKey] });
  const addLink = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      unwrap(
        client.POST('/api/v1/issues/{key}/links', {
          params: { path: { key: from } },
          body: { type: 'blocks', direction: 'outward', issueKey: to },
        }),
      ),
    onSuccess: () => setLinkingRow(null),
    onSettled: refresh,
  });
  const removeLink = useMutation({
    mutationFn: (dependency: TimelineDependency) =>
      unwrap(
        client.DELETE('/api/v1/issues/{key}/links/{linkId}', {
          params: { path: { key: dependency.from, linkId: dependency.linkId } },
        }),
      ),
    onSettled: refresh,
  });
  const moveMilestone = useMutation({
    mutationFn: ({ id, releaseDate }: { id: string; releaseDate: string }) =>
      unwrap(
        client.PATCH('/api/v1/projects/{key}/versions/{id}', {
          params: { path: { key: projectKey, id } },
          body: { releaseDate },
        }),
      ),
    onSuccess: () => setMilestoneOpen(null),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({
      key,
      startDate,
      dueDate,
    }: {
      key: string;
      startDate: string | null;
      dueDate: string | null;
    }) =>
      unwrap(
        client.PATCH('/api/v1/issues/{key}', {
          params: { path: { key } },
          body: { startDate, dueDate },
        }),
      ),
    onSuccess: () => setEditing(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['timeline', projectKey] }),
  });

  const epics = timeline.data?.epics ?? [];
  const milestones = timeline.data?.milestones ?? [];
  const dependencies = timeline.data?.dependencies ?? [];
  const conflicts = timeline.data?.conflicts ?? [];
  const conflicted = new Set(conflicts.map((conflict) => conflict.issueKey));
  const allRows = epics.flatMap((epic) => [epic as TimelineRow, ...epic.children]);
  const now = todayDay();
  const range = useMemo(() => {
    const days = [now];
    for (const epic of epics) {
      for (const row of [epic, ...epic.children]) {
        if (row.span) days.push(toDay(row.span.start), toDay(row.span.end));
      }
    }
    for (const milestone of milestones) days.push(toDay(milestone.date));
    return visibleRange(days, zoom);
  }, [epics, milestones, now, zoom]);
  const width = DAY_WIDTH[zoom];
  const x = (day: number) => (day - range.start) * width;
  const total = x(range.end);
  const header = columns(range.start, range.end, zoom, i18n.language, (week) =>
    t('timeline.week', { week }),
  );

  const shortDate = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit' });

  const scrollToToday = () => {
    const element = scroller.current;
    if (element) element.scrollLeft = x(now) - element.clientWidth / 4;
  };
  // Today in view on load and after zooming.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the scale changes
  useLayoutEffect(scrollToToday, [zoom, range.start, timeline.isSuccess]);

  const startDrag = (event: ReactPointerEvent, row: TimelineRow, mode: DragMode) => {
    if (event.button !== 0 || !row.span || !row.issue.canEdit) return;
    event.stopPropagation();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already released pointers cannot be captured; the drag still works.
    }
    setDrag({ key: row.issue.key, mode, x: event.clientX, span: row.span, days: 0 });
  };
  const moveDrag = (event: ReactPointerEvent) => {
    const current = dragRef.current;
    if (!current) return;
    const days = Math.round((event.clientX - current.x) / width);
    if (days !== current.days) setDrag({ ...current, days });
  };
  const endDrag = (row: TimelineRow) => {
    const drag = dragRef.current;
    if (!drag) return;
    setDrag(null);
    if (drag.days === 0) {
      void navigate({ to: '/issues/$key', params: { key: row.issue.key } });
      return;
    }
    const next = dragged(drag);
    update.mutate({ key: row.issue.key, startDate: next.start, dueDate: next.end });
  };

  const shown = (row: TimelineRow): TimelineSpan | null => {
    if (drag && drag.key === row.issue.key) return { ...dragged(drag), derived: false };
    if (update.isPending && update.variables?.key === row.issue.key) {
      const { startDate, dueDate } = update.variables;
      if (startDate && dueDate) return { start: startDate, end: dueDate, derived: false };
    }
    return row.span;
  };

  const point = (event: ReactPointerEvent) => {
    const box = chart.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };
  const startLink = (event: ReactPointerEvent, row: TimelineRow, right: number) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // See startDrag.
    }
    const at = point(event);
    setLinkDrag({ from: row.issue.key, x0: right, y0: at.y, ...at });
  };
  const moveLink = (event: ReactPointerEvent) => {
    const current = linkDragRef.current;
    if (current) setLinkDrag({ ...current, ...point(event) });
  };
  const endLink = (event: ReactPointerEvent) => {
    const current = linkDragRef.current;
    setLinkDrag(null);
    if (!current) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-issue-key]')?.dataset.issueKey;
    if (target && target !== current.from) addLink.mutate({ from: current.from, to: target });
  };

  const bar = (row: TimelineRow, epic?: TimelineEpic) => {
    const span = shown(row);
    if (!span) {
      return (
        <span className="sticky left-3 inline-block pt-2 pl-3 text-xs text-[var(--ink-muted)]">
          {t('timeline.unscheduled')}
        </span>
      );
    }
    const left = x(toDay(span.start));
    const barWidth = Math.max((toDay(span.end) - toDay(span.start) + 1) * width, 6);
    const done = row.issue.status.category === 'done';
    const percent =
      epic && epic.progress.total > 0
        ? Math.round((epic.progress.done / epic.progress.total) * 100)
        : null;
    const tone = epic
      ? done
        ? 'bg-[var(--success-soft)] text-[var(--ink)]'
        : 'bg-[var(--accent-soft)] text-[var(--ink)]'
      : STATUS_TONE[row.issue.status.category];
    const editable = row.issue.canEdit;
    const text = `${epic ? row.issue.summary : row.issue.key}${percent !== null ? ` · ${percent} %` : ''}`;
    // A bar too short for its text gets it beside the bar instead of an ellipsis (TL-5).
    const outside = barWidth < textWidth(text, epic ? '500 12.5px' : '11.5px') + 18;
    const label = t('timeline.bar', {
      key: row.issue.key,
      summary: row.issue.summary,
      start: formatDate(span.start),
      end: formatDate(span.end),
    });
    return (
      <>
        <button
          type="button"
          data-issue-key={row.issue.key}
          aria-label={
            conflicted.has(row.issue.key) ? `${label} · ${t('timeline.conflict')}` : label
          }
          title={span.derived ? `${label} · ${t('timeline.derived')}` : label}
          onPointerDown={(event) => startDrag(event, row, 'move')}
          onPointerMove={moveDrag}
          onPointerUp={() => endDrag(row)}
          onPointerCancel={() => setDrag(null)}
          onClick={(event) => {
            // Pointer clicks are handled on pointer up; this is the keyboard path.
            if (event.detail === 0)
              void navigate({ to: '/issues/$key', params: { key: row.issue.key } });
          }}
          style={{ left, width: barWidth }}
          className={`group absolute flex touch-none items-center overflow-hidden border text-left select-none ${
            epic
              ? 'top-3.5 h-7 rounded-[5px] text-[12.5px] font-medium'
              : 'top-2.5 h-5 rounded-[4px] text-[11.5px]'
          } ${tone} ${
            span.derived
              ? 'border-dashed border-[var(--border-strong)] !bg-transparent'
              : 'border-transparent'
          } ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
            drag?.key === row.issue.key ? 'shadow-[var(--shadow-drag)]' : ''
          } ${conflicted.has(row.issue.key) ? 'outline-2 outline-[var(--danger)] outline-offset-1' : ''}`}
        >
          {epic && percent !== null && !span.derived && (
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 opacity-30 ${done ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`}
              style={{ width: `${percent}%` }}
            />
          )}
          {!outside && <span className="relative truncate px-2">{text}</span>}
          {editable && (
            <>
              <span
                aria-hidden
                onPointerDown={(event) => startDrag(event, row, 'start')}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize group-hover:bg-[var(--border-strong)]/40"
              />
              <span
                aria-hidden
                onPointerDown={(event) => startDrag(event, row, 'end')}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize group-hover:bg-[var(--border-strong)]/40"
              />
            </>
          )}
        </button>
        {editable && (
          <span
            aria-hidden
            title={t('timeline.drawDependency')}
            onPointerDown={(event) => startLink(event, row, left + barWidth)}
            onPointerMove={moveLink}
            onPointerUp={endLink}
            onPointerCancel={() => setLinkDrag(null)}
            style={{ left: left + barWidth + 1 }}
            className={`absolute z-10 size-3 cursor-crosshair touch-none rounded-full border-2 border-[var(--accent)] bg-[var(--surface-1)] opacity-0 group-hover/bar:opacity-100 ${
              epic ? 'top-[22px]' : 'top-[14px]'
            }`}
          />
        )}
        {outside && (
          <span
            aria-hidden
            style={{ left: left + barWidth + 6 }}
            className={`pointer-events-none absolute whitespace-nowrap text-[var(--ink-muted)] ${
              epic
                ? 'top-3.5 text-[12.5px] leading-7 font-medium'
                : 'top-2.5 text-[11.5px] leading-5'
            }`}
          >
            {text}
          </span>
        )}
      </>
    );
  };

  const rowMenu = (row: TimelineRow) =>
    row.issue.canEdit && (
      <>
        <button
          type="button"
          aria-label={t('timeline.dependenciesTitle', { key: row.issue.key })}
          title={t('timeline.dependencies')}
          onClick={() => setLinkingRow(row)}
          className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--ink-muted)] opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:opacity-100"
        >
          <LinkSimple size={15} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`${t('timeline.setDates')} ${row.issue.key}`}
          title={t('timeline.setDates')}
          onClick={() => setEditing(row)}
          className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--ink-muted)] opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:opacity-100"
        >
          <DotsThree size={16} weight="bold" aria-hidden />
        </button>
      </>
    );

  const rows = epics.flatMap((epic) => [
    { row: epic, epic, child: false },
    ...(open.has(epic.issue.key)
      ? epic.children.map((child) => ({ row: child, epic: undefined, child: true }))
      : []),
  ]);
  // Where each visible row's bar sits vertically, for the dependency arrows.
  const centers = new Map<string, number>();
  let top = HEADER_HEIGHT;
  for (const { row, child } of rows) {
    centers.set(row.issue.key, top + (child ? 20 : 28));
    top += child ? CHILD_HEIGHT : EPIC_HEIGHT;
  }
  const byKey = new Map(allRows.map((row) => [row.issue.key, row]));
  const arrows = dependencies.flatMap((dependency) => {
    const from = byKey.get(dependency.from);
    const to = byKey.get(dependency.to);
    const y1 = centers.get(dependency.from);
    const y2 = centers.get(dependency.to);
    const a = from && shown(from);
    const b = to && shown(to);
    if (!a || !b || y1 === undefined || y2 === undefined) return [];
    const x1 = x(toDay(a.end)) + width;
    const x2 = x(toDay(b.start));
    const bend = Math.max(24, Math.abs(x2 - x1) / 2);
    return [
      {
        dependency,
        path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 2} ${y2}`,
      },
    ];
  });

  return (
    <main className="flex min-h-full flex-col">
      <TopBar
        crumbs={[
          <Link key="projects" to="/projects">
            {t('projects.title')}
          </Link>,
          <Link key="project" to="/projects/$key" params={{ key: projectKey }}>
            {project.data?.name ?? projectKey}
          </Link>,
          t('timeline.title'),
        ]}
      />
      <PageHeading
        title={t('timeline.title')}
        actions={
          <>
            <fieldset
              aria-label={t('timeline.zoom')}
              className="m-0 flex min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-control)] p-0 text-[13px]"
            >
              {ZOOMS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={zoom === value}
                  onClick={() => setZoom(value)}
                  className="cursor-pointer border-0 bg-[var(--surface-1)] px-3 py-1.5 text-[var(--ink)] hover:bg-[var(--surface-2)] aria-pressed:bg-[var(--ink)] aria-pressed:font-medium aria-pressed:text-[var(--surface-1)]"
                >
                  {t(`timeline.${value}`)}
                </button>
              ))}
            </fieldset>
            <Button onClick={scrollToToday}>{t('timeline.today')}</Button>
          </>
        }
      />
      {(addLink.error ?? removeLink.error ?? (milestoneOpen ? null : moveMilestone.error)) && (
        <div className="px-6 pb-3">
          <FormError
            message={(addLink.error ?? removeLink.error ?? moveMilestone.error)?.message ?? ''}
          />
        </div>
      )}
      {update.error && !editing && (
        <div className="px-6 pb-3">
          <FormError message={update.error.message} />
        </div>
      )}
      {timeline.data && epics.length === 0 && (
        <p className="m-0 max-w-xl px-6 text-[var(--ink-muted)]">{t('timeline.empty')}</p>
      )}

      {epics.length > 0 && (
        <div className="mx-6 mb-6 flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
          <div className="w-[260px] shrink-0 border-r border-[var(--border)]">
            <div
              className={`${HEADER} tl-label flex items-end border-b border-[var(--border)] px-4 pb-2.5 text-[var(--ink-muted)]`}
            >
              {t('timeline.epic')}
            </div>
            {rows.map(({ row, epic, child }) => (
              <div
                key={row.issue.id}
                className={`group/row flex items-center gap-1.5 border-b border-[var(--border)] pr-2 ${
                  child ? `${CHILD_ROW} pl-9` : `${EPIC_ROW} pl-2`
                }`}
              >
                {epic && (
                  <button
                    type="button"
                    disabled={epic.children.length === 0}
                    aria-expanded={open.has(epic.issue.key)}
                    aria-label={t(
                      open.has(epic.issue.key) ? 'timeline.collapse' : 'timeline.expand',
                      {
                        key: epic.issue.key,
                      },
                    )}
                    onClick={() =>
                      setOpen((current) => {
                        const next = new Set(current);
                        if (next.has(epic.issue.key)) next.delete(epic.issue.key);
                        else next.add(epic.issue.key);
                        return next;
                      })
                    }
                    className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-2)] disabled:invisible"
                  >
                    {open.has(epic.issue.key) ? (
                      <CaretDown size={14} aria-hidden />
                    ) : (
                      <CaretRight size={14} aria-hidden />
                    )}
                  </button>
                )}
                {child && <IssueTypeIcon type={row.issue.issueType} />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    to="/issues/$key"
                    params={{ key: row.issue.key }}
                    className={`truncate text-[var(--ink)] no-underline hover:underline ${
                      child ? 'text-[13px]' : 'text-[13.5px] font-semibold'
                    }`}
                  >
                    {row.issue.summary}
                  </Link>
                  {epic && (
                    <span className="truncate text-xs text-[var(--ink-muted)]">
                      <span className="font-[family-name:var(--font-mono)]">{epic.issue.key}</span>{' '}
                      ·{' '}
                      {epic.children.length === 0
                        ? t('timeline.noChildren')
                        : t(
                            epic.progress.unit === 'points' ? 'timeline.points' : 'timeline.issues',
                            {
                              done: epic.progress.done,
                              total: epic.progress.total,
                            },
                          )}
                    </span>
                  )}
                </div>
                {rowMenu(row)}
              </div>
            ))}
            {milestones.length > 0 && (
              <div className="tl-label flex h-12 items-center px-4 text-[var(--ink-muted)]">
                {t('timeline.milestones')}
              </div>
            )}
          </div>

          <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto">
            <div ref={chart} className="relative" style={{ width: total }}>
              <div className={`${HEADER} relative border-b border-[var(--border)]`}>
                {header.map((column) => (
                  <div
                    key={column.start}
                    className="absolute inset-y-0 flex flex-col justify-end gap-0.5 border-l border-[var(--border)] px-3 pb-2"
                    style={{ left: x(column.start), width: x(column.end) - x(column.start) }}
                  >
                    <span className="truncate text-[13px] font-semibold">{column.label}</span>
                    <span className="truncate text-[11.5px] text-[var(--ink-muted)]">
                      {column.detail}
                    </span>
                  </div>
                ))}
              </div>
              {/* Column lines through the rows. */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-14 bottom-0">
                {header.map((column) => (
                  <span
                    key={column.start}
                    className="absolute inset-y-0 border-l border-[var(--border)] opacity-60"
                    style={{ left: x(column.start) }}
                  />
                ))}
              </div>
              {rows.map(({ row, epic, child }) => (
                <div
                  key={row.issue.id}
                  className={`group/bar relative border-b border-[var(--border)] ${child ? CHILD_ROW : EPIC_ROW}`}
                >
                  {bar(row, epic)}
                </div>
              ))}
              {milestones.length > 0 && (
                <div className="relative h-12">
                  {milestones.map((milestone) => (
                    <button
                      type="button"
                      key={milestone.id}
                      title={t('timeline.milestoneTitle', {
                        name: milestone.name,
                        count: milestone.issueKeys.length,
                      })}
                      onPointerDown={(event) => {
                        if (
                          event.button !== 0 ||
                          !timeline.data?.canEditVersions ||
                          milestone.released
                        )
                          return;
                        try {
                          event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                          // See startDrag.
                        }
                        setMilestoneDrag({ milestone, x: event.clientX, days: 0 });
                      }}
                      onPointerMove={(event) => {
                        const current = milestoneDragRef.current;
                        if (!current) return;
                        const days = Math.round((event.clientX - current.x) / width);
                        if (days !== current.days) setMilestoneDrag({ ...current, days });
                      }}
                      onPointerUp={() => {
                        const current = milestoneDragRef.current;
                        setMilestoneDrag(null);
                        draggedMilestone.current = !!current && current.days !== 0;
                        if (current && current.days !== 0) {
                          moveMilestone.mutate({
                            id: milestone.id,
                            releaseDate: fromDay(toDay(milestone.date) + current.days),
                          });
                        }
                      }}
                      onClick={() => {
                        if (draggedMilestone.current) draggedMilestone.current = false;
                        else setMilestoneOpen(milestone);
                      }}
                      className="absolute top-1/2 flex -translate-y-1/2 cursor-pointer touch-none items-center gap-1.5 border-0 bg-transparent p-0 text-xs whitespace-nowrap text-[var(--ink)]"
                      style={{
                        left:
                          x(
                            toDay(milestone.date) +
                              (milestoneDrag?.milestone.id === milestone.id
                                ? milestoneDrag.days
                                : 0),
                          ) - 5,
                      }}
                    >
                      <span
                        aria-hidden
                        className={`size-2.5 rotate-45 ${milestone.released ? 'bg-[var(--success)]' : 'bg-[var(--ink)]'}`}
                      />
                      <span className="font-medium">{milestone.name}</span>
                      <span className="text-[var(--ink-muted)]">
                        {formatDate(milestone.date)}
                        {milestone.released && ` · ${t('timeline.released')}`}
                      </span>
                      {conflicts.some(
                        (conflict) =>
                          conflict.kind === 'milestone' && conflict.version === milestone.name,
                      ) && <Warning size={14} className="text-[var(--danger)]" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={total}
                height={top + (milestones.length > 0 ? 48 : 0)}
              >
                <defs>
                  {(['ok', 'conflict'] as const).map((kind) => (
                    <marker
                      key={kind}
                      id={`tl-arrow-${kind}`}
                      viewBox="0 0 8 8"
                      refX="7"
                      refY="4"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto"
                    >
                      <path
                        d="M0 0 L8 4 L0 8 z"
                        fill={kind === 'conflict' ? 'var(--danger)' : 'var(--ink-muted)'}
                      />
                    </marker>
                  ))}
                </defs>
                {arrows.map(({ dependency, path }) => (
                  <g key={dependency.linkId}>
                    <path
                      d={path}
                      fill="none"
                      stroke={dependency.conflict ? 'var(--danger)' : 'var(--ink-muted)'}
                      strokeWidth={dependency.conflict ? 2 : 1.5}
                      markerEnd={`url(#tl-arrow-${dependency.conflict ? 'conflict' : 'ok'})`}
                    />
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: the row menu removes dependencies by keyboard */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={10}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => {
                        if (
                          window.confirm(
                            t('timeline.removeConfirm', {
                              from: dependency.from,
                              to: dependency.to,
                            }),
                          )
                        )
                          removeLink.mutate(dependency);
                      }}
                    >
                      <title>
                        {t('timeline.dependencyTitle', {
                          from: dependency.from,
                          to: dependency.to,
                        })}
                      </title>
                    </path>
                  </g>
                ))}
                {linkDrag && (
                  <line
                    x1={linkDrag.x0}
                    y1={linkDrag.y0}
                    x2={linkDrag.x}
                    y2={linkDrag.y}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    markerEnd="url(#tl-arrow-ok)"
                  />
                )}
              </svg>
              {now >= range.start && now < range.end && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-11 bottom-0 w-0.5 bg-[var(--accent)]"
                  style={{ left: x(now) + width / 2 - 1 }}
                >
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-[3px] bg-[var(--accent)] px-1.5 font-[family-name:var(--font-mono)] text-[10.5px] font-semibold whitespace-nowrap text-[var(--on-accent)]">
                    {shortDate.format(new Date(`${fromDay(now)}T00:00:00`))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <section
          aria-label={t('timeline.conflicts', { count: conflicts.length })}
          className="mx-6 mb-6 flex flex-col gap-2 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3"
        >
          <h2 className="m-0 flex items-center gap-2 text-[14px] font-semibold">
            <Warning size={16} className="text-[var(--danger)]" aria-hidden />
            {t('timeline.conflicts', { count: conflicts.length })}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {conflicts.map((conflict) => (
              <li
                key={`${conflict.kind}:${conflict.issueKey}:${conflict.kind === 'dependency' ? conflict.blockerKey : conflict.version}`}
              >
                <Link to="/issues/$key" params={{ key: conflict.issueKey }} className="tl-key">
                  {conflict.issueKey}
                </Link>{' '}
                {conflict.kind === 'dependency'
                  ? t('timeline.dependencyConflict', {
                      count: conflict.days,
                      blocker: conflict.blockerKey,
                    })
                  : t('timeline.milestoneConflict', {
                      count: conflict.days,
                      version: conflict.version,
                    })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DependencyDialog
        row={linkingRow}
        rows={allRows}
        dependencies={dependencies}
        onClose={() => setLinkingRow(null)}
        onAdd={(from, to) => addLink.mutate({ from, to })}
        onRemove={(dependency) => removeLink.mutate(dependency)}
        busy={addLink.isPending || removeLink.isPending}
        error={linkingRow ? ((addLink.error ?? removeLink.error)?.message ?? null) : null}
      />
      <MilestoneDialog
        milestone={milestoneOpen}
        conflicts={conflicts}
        editable={timeline.data?.canEditVersions ?? false}
        onClose={() => setMilestoneOpen(null)}
        onSave={(releaseDate) =>
          milestoneOpen && moveMilestone.mutate({ id: milestoneOpen.id, releaseDate })
        }
        busy={moveMilestone.isPending}
        error={milestoneOpen && moveMilestone.error ? moveMilestone.error.message : null}
      />
      <DatesDialog
        row={editing}
        onClose={() => setEditing(null)}
        busy={update.isPending}
        error={editing && update.error ? update.error.message : null}
        onSave={(startDate, dueDate) =>
          editing && update.mutate({ key: editing.issue.key, startDate, dueDate })
        }
      />
    </main>
  );
}
