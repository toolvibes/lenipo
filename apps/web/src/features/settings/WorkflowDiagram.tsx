import type { StatusCategory } from '@tasklore/shared';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutInput, layoutWorkflow, NODE_H, NODE_W } from './workflowLayout';

const STROKE: Record<StatusCategory, string> = {
  todo: 'var(--border-strong)',
  in_progress: 'var(--accent)',
  done: 'var(--success)',
};

/** Longest name that fits a box; the full one is in the tooltip. */
function fit(name: string): string {
  return name.length > 17 ? `${name.slice(0, 16)}…` : name;
}

/**
 * The draft workflow as a picture: statuses left to right along the usual way, arrows for the
 * allowed moves. Read-only; the matrix stays where moves are edited (TL-74, E-85).
 */
export function WorkflowDiagram({
  rows,
  initial,
  pairs,
  ruleCounts,
}: {
  rows: LayoutInput[];
  initial: string;
  /** Allowed moves, or null when every status may move to every other. */
  pairs: Array<[string, string]> | null;
  /** Rules set for moving into a status, by row key. */
  ruleCounts: Record<string, number>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [focus, setFocus] = useState<string | null>(null);
  const layout = useMemo(() => layoutWorkflow(rows, initial, pairs), [rows, initial, pairs]);
  const name = new Map(rows.map((row) => [row.key, row.name]));
  const start = layout.nodes.find((node) => node.key === initial);
  const touches = (from: string, to: string) => focus === from || focus === to;
  const unreachable = layout.nodes.filter((node) => !node.reachable);
  const arrow = (variant: string) => `${id}-${variant}`;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
        <svg
          role="img"
          aria-label={t('workflow.diagramLabel')}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          // Shrinks a little on narrow screens, then scrolls rather than getting unreadable.
          style={{ width: '100%', maxWidth: layout.width, minWidth: layout.width * 0.75 }}
          className="block h-auto"
        >
          <defs>
            {(['plain', 'lit'] as const).map((variant) => (
              <marker
                key={variant}
                id={arrow(variant)}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M0,0 L10,5 L0,10 z"
                  fill={variant === 'lit' ? 'var(--accent)' : 'var(--ink-muted)'}
                />
              </marker>
            ))}
          </defs>
          {layout.edges.map((edge) => {
            const lit = touches(edge.from, edge.to);
            return (
              <path
                key={`${edge.from}>${edge.to}`}
                d={edge.path}
                fill="none"
                stroke={lit ? 'var(--accent)' : 'var(--ink-muted)'}
                strokeWidth={lit ? 1.75 : 1.1}
                strokeOpacity={focus && !lit ? 0.18 : lit ? 1 : 0.55}
                markerEnd={`url(#${arrow(lit ? 'lit' : 'plain')})`}
              >
                <title>
                  {t('workflow.fromTo', {
                    from: name.get(edge.from) ?? '',
                    to: name.get(edge.to) ?? '',
                  })}
                </title>
              </path>
            );
          })}
          {start && (
            <g aria-hidden>
              <circle cx={start.x - 20} cy={start.y + NODE_H / 2} r={4} fill="var(--ink)" />
              <path
                d={`M${start.x - 16},${start.y + NODE_H / 2} L${start.x - 1},${start.y + NODE_H / 2}`}
                stroke="var(--ink)"
                strokeWidth={1.25}
                markerEnd={`url(#${arrow('plain')})`}
              />
            </g>
          )}
          {layout.nodes.map((node) => {
            const rules = ruleCounts[node.key] ?? 0;
            const dim = focus !== null && focus !== node.key;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover only highlights; the matrix is the accessible view
              <g
                key={node.key}
                onMouseEnter={() => setFocus(node.key)}
                onMouseLeave={() => setFocus(null)}
                opacity={dim ? 0.7 : 1}
                className="cursor-default"
              >
                <title>
                  {[
                    node.name,
                    node.key === initial ? t('workflow.initial') : null,
                    rules > 0 ? t('workflow.ruleCount', { count: rules }) : null,
                    node.reachable ? null : t('workflow.unreachableOne'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </title>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={7}
                  fill="var(--surface-1)"
                  stroke={STROKE[node.category]}
                  strokeWidth={focus === node.key ? 2 : 1.25}
                  strokeDasharray={node.reachable ? undefined : '4 3'}
                />
                <rect
                  x={node.x}
                  y={node.y + 8}
                  width={3}
                  height={NODE_H - 16}
                  rx={1.5}
                  fill={STROKE[node.category]}
                />
                <text
                  x={node.x + 12}
                  y={node.y + NODE_H / 2}
                  dominantBaseline="central"
                  fontSize={12.5}
                  fill="var(--ink)"
                  fontWeight={node.key === initial ? 600 : 400}
                >
                  {fit(node.name)}
                </text>
                {rules > 0 && (
                  <g aria-hidden>
                    <circle
                      cx={node.x + NODE_W - 2}
                      cy={node.y + 2}
                      r={8}
                      fill="var(--accent)"
                      stroke="var(--surface-2)"
                      strokeWidth={2}
                    />
                    <text
                      x={node.x + NODE_W - 2}
                      y={node.y + 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fontWeight={600}
                      fill="var(--surface-1)"
                    >
                      {rules}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-col gap-1 text-[12.5px] text-[var(--ink-muted)]">
        <span>{t(pairs ? 'workflow.diagramHint' : 'workflow.diagramFree')}</span>
        {unreachable.length > 0 && (
          <span className="text-[var(--warning)]">
            {t('workflow.unreachable', {
              names: unreachable.map((node) => node.name).join(', '),
            })}
          </span>
        )}
        {layout.deadEnds.length > 0 && (
          <span className="text-[var(--warning)]">
            {t('workflow.deadEnds', {
              names: layout.deadEnds.map((key) => name.get(key)).join(', '),
            })}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
