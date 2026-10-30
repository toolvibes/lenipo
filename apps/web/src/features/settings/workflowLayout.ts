import type { StatusCategory } from '@tasklore/shared';

/** Layered layout for the read-only workflow diagram (TL-74, E-85); small workflows, no library. */

export interface LayoutInput {
  key: string;
  name: string;
  category: StatusCategory;
}

export interface LayoutNode extends LayoutInput {
  x: number;
  y: number;
  layer: number;
  /** False when no chain of transitions leads here from the initial status. */
  reachable: boolean;
}

export interface LayoutEdge {
  from: string;
  to: string;
  /** SVG path from the source's edge to the target's edge. */
  path: string;
}

export interface WorkflowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  /** Statuses outside "done" with no way out. */
  deadEnds: string[];
}

export const NODE_W = 132;
export const NODE_H = 36;
const GAP_X = 52;
const GAP_Y = 16;
const PAD_X = 30;
const PAD_Y = 12;
const ARC = 16;
const CATEGORY_LAYER: Record<StatusCategory, number> = { todo: 0, in_progress: 1, done: 2 };

/** A polyline with rounded corners. */
function rounded(points: Array<[number, number]>, radius = 8): string {
  let path = `M${points[0]}`;
  for (let index = 1; index < points.length - 1; index++) {
    const [px, py] = points[index - 1] as [number, number];
    const [x, y] = points[index] as [number, number];
    const [nx, ny] = points[index + 1] as [number, number];
    const inner = Math.hypot(x - px, y - py) || 1;
    const outer = Math.hypot(nx - x, ny - y) || 1;
    const a = Math.min(radius, inner / 2);
    const b = Math.min(radius, outer / 2);
    path += ` L${x - ((x - px) / inner) * a},${y - ((y - py) / inner) * a}`;
    path += ` Q${x},${y} ${x + ((nx - x) / outer) * b},${y + ((ny - y) / outer) * b}`;
  }
  return `${path} L${points[points.length - 1]}`;
}

/**
 * Columns follow the longest way from the initial status without going back, so the usual path
 * reads left to right and shortcuts do not pull later statuses forward. Moves to the next column
 * are plain curves; longer jumps run above and moves back below, through the gaps between columns
 * so they never cross a status; moves within a column bulge to the right. Without defined
 * transitions (`pairs` null) the columns are the status categories.
 */
export function layoutWorkflow(
  rows: LayoutInput[],
  initial: string,
  pairs: Array<[string, string]> | null,
): WorkflowLayout {
  const order = new Map(rows.map((row, index) => [row.key, index]));
  const known = (pair: [string, string]) =>
    pair[0] !== pair[1] && order.has(pair[0]) && order.has(pair[1]);
  const moves = (pairs ?? [])
    .filter(known)
    .sort((x, y) => (order.get(x[1]) ?? 0) - (order.get(y[1]) ?? 0));
  const layer = new Map<string, number>();
  const reached = new Set<string>(pairs ? [] : order.keys());
  if (pairs) {
    const next = new Map<string, string[]>();
    for (const [from, to] of moves) next.set(from, [...(next.get(from) ?? []), to]);
    // Depth-first from the start: a move to a status still on the path leads back.
    const back = new Set<string>();
    const onPath = new Set<string>();
    const finished: string[] = [];
    const visit = (key: string) => {
      reached.add(key);
      onPath.add(key);
      for (const to of next.get(key) ?? []) {
        if (onPath.has(to)) back.add(`${key}>${to}`);
        else if (!reached.has(to)) visit(to);
      }
      onPath.delete(key);
      finished.push(key);
    };
    const start = order.has(initial) ? initial : rows[0]?.key;
    if (start !== undefined) visit(start);
    for (const key of finished.reverse()) {
      if (!layer.has(key)) layer.set(key, 0);
      for (const to of next.get(key) ?? []) {
        if (back.has(`${key}>${to}`)) continue;
        layer.set(to, Math.max(layer.get(to) ?? 0, (layer.get(key) ?? 0) + 1));
      }
    }
    // Unreachable statuses get a column of their own at the end.
    const last = Math.max(-1, ...layer.values()) + 1;
    for (const row of rows) if (!layer.has(row.key)) layer.set(row.key, last);
  } else {
    const used = [...new Set(rows.map((row) => CATEGORY_LAYER[row.category]))].sort();
    for (const row of rows) layer.set(row.key, used.indexOf(CATEGORY_LAYER[row.category]));
  }

  const columns: string[][] = [];
  for (const row of rows) {
    const index = layer.get(row.key) ?? 0;
    columns[index] = [...(columns[index] ?? []), row.key];
  }
  // One sweep: order each column by where its predecessors sit, to keep curves from crossing.
  const rank = new Map<string, number>();
  for (const column of columns) {
    if (!column) continue;
    const weight = (key: string) => {
      const from = moves
        .filter(([source, to]) => to === key && (layer.get(source) ?? 0) < (layer.get(key) ?? 0))
        .map(([source]) => rank.get(source) ?? 0);
      return from.length
        ? from.reduce((sum, value) => sum + value, 0) / from.length
        : Number.MAX_SAFE_INTEGER;
    };
    column.sort((a, b) => weight(a) - weight(b) || (order.get(a) ?? 0) - (order.get(b) ?? 0));
    for (const [index, key] of column.entries()) rank.set(key, index);
  }

  const tallest = Math.max(1, ...columns.map((column) => column?.length ?? 0));
  const jumps = moves.map(([from, to]) => (layer.get(to) ?? 0) - (layer.get(from) ?? 0));
  const longest = Math.max(0, ...jumps.filter((jump) => jump > 1).map((jump) => jump - 1));
  const furthest = Math.max(0, ...jumps.filter((jump) => jump < 0).map((jump) => -jump));
  const top = PAD_Y + (longest ? ARC + 8 * longest : 0);
  const bodyHeight = tallest * NODE_H + (tallest - 1) * GAP_Y;
  const nodes: LayoutNode[] = rows.map((row) => {
    const index = layer.get(row.key) ?? 0;
    const column = columns[index] ?? [];
    const offset = (bodyHeight - (column.length * NODE_H + (column.length - 1) * GAP_Y)) / 2;
    return {
      ...row,
      layer: index,
      x: PAD_X + index * (NODE_W + GAP_X),
      y: top + offset + (rank.get(row.key) ?? 0) * (NODE_H + GAP_Y),
      reachable: reached.has(row.key),
    };
  });
  const at = new Map(nodes.map((node) => [node.key, node]));
  const bottom = top + bodyHeight;

  const edges = moves.map(([from, to]): LayoutEdge => {
    const a = at.get(from) as LayoutNode;
    const b = at.get(to) as LayoutNode;
    const jump = b.layer - a.layer;
    let path: string;
    if (jump === 1) {
      const sx = a.x + NODE_W;
      const sy = a.y + NODE_H / 2;
      const tx = b.x;
      const ty = b.y + NODE_H / 2;
      const mid = (sx + tx) / 2;
      path = `M${sx},${sy} C${mid},${sy} ${mid},${ty} ${tx},${ty}`;
    } else if (jump > 1) {
      // Over the top: out to the right, along above every column, in from the left.
      const sy = a.y + NODE_H / 2 - 6;
      const ty = b.y + NODE_H / 2 - 6;
      const y = top - ARC - 8 * (jump - 2);
      const out = a.x + NODE_W + GAP_X / 2 + 4 * (jump - 2);
      const into = b.x - GAP_X / 2 - 4 * (jump - 2);
      path = rounded([
        [a.x + NODE_W, sy],
        [out, sy],
        [out, y],
        [into, y],
        [into, ty],
        [b.x, ty],
      ]);
    } else if (jump === 0) {
      // Within the column: bulge out to the right, downward moves closer than upward ones.
      const x = a.x + NODE_W;
      const bulge = x + (b.y > a.y ? 16 : 28);
      const sy = a.y + NODE_H / 2;
      const ty = b.y + NODE_H / 2;
      path = `M${x},${sy} C${bulge},${sy} ${bulge},${ty} ${x},${ty}`;
    } else {
      // Back underneath: out to the left, along below every column, in from the right.
      const sy = a.y + NODE_H / 2 + 6;
      const ty = b.y + NODE_H / 2 + 6;
      const y = bottom + ARC + 8 * (-jump - 1);
      // Apart in the gap, so a move back by one column makes a U rather than a line.
      const out = a.x - GAP_X / 2 + 6;
      const into = b.x + NODE_W + GAP_X / 2 - 6;
      path = rounded([
        [a.x, sy],
        [out, sy],
        [out, y],
        [into, y],
        [into, ty],
        [b.x + NODE_W, ty],
      ]);
    }
    return { from, to, path };
  });

  const layers = Math.max(1, columns.length);
  const outgoing = new Set(moves.map(([from]) => from));
  return {
    nodes,
    edges,
    width: PAD_X * 2 + layers * NODE_W + (layers - 1) * GAP_X,
    height: bottom + (furthest ? ARC + 8 * furthest : 0) + PAD_Y,
    deadEnds: pairs
      ? rows
          .filter((row) => row.category !== 'done' && !outgoing.has(row.key))
          .map((row) => row.key)
      : [],
  };
}
