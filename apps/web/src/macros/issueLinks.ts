import { issueKeysIn } from '@tasklore/editor/refs';
import type { IssueLookup } from '@tasklore/shared';
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { STATUS_TONE } from '../features/tracking/icons';
import { client, unwrap } from '../lib/api';

/**
 * Issue keys in wiki text become live links with their status (W-INT-01, E-73). Nothing is
 * stored: keys are looked up with the reader's rights, in batches, and cached for the session.
 * Keys the reader may not see stay plain text, exactly like keys that do not exist.
 */
const known = new Map<string, IssueLookup | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  timer = undefined;
  const keys = [...waiting].slice(0, 200);
  for (const key of keys) waiting.delete(key);
  if (waiting.size > 0) timer = setTimeout(flush, 0);
  void unwrap(client.POST('/api/v1/issues/lookup', { body: { keys } }))
    .then((found) => {
      for (const key of keys) known.set(key, null);
      for (const issue of found) known.set(issue.key, issue);
    })
    .catch(() => {
      // Retried with the next page that shows these keys.
    })
    .finally(() => {
      for (const listener of listeners) listener();
    });
}

function request(keys: string[]) {
  let added = false;
  for (const key of keys) {
    if (!known.has(key) && !waiting.has(key)) {
      waiting.add(key);
      added = true;
    }
  }
  if (added && !timer) timer = setTimeout(flush, 30);
}

/** Text positions of issue keys, outside code. */
function keysOf(doc: PMNode): Array<{ key: string; from: number; to: number }> {
  const found: Array<{ key: string; from: number; to: number }> = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'codeBlock') return false;
    if (!node.isText || !node.text || parent?.type.name === 'codeBlock') return true;
    if (node.marks.some((mark) => mark.type.name === 'code' || mark.type.name === 'link'))
      return true;
    for (const { key, index } of issueKeysIn(node.text)) {
      found.push({ key, from: pos + index, to: pos + index + key.length });
    }
    return true;
  });
  return found;
}

function decorations(doc: PMNode): DecorationSet {
  const keys = keysOf(doc);
  request(keys.map((entry) => entry.key));
  return DecorationSet.create(
    doc,
    keys.flatMap(({ key, from, to }) => {
      const issue = known.get(key);
      if (!issue) return [];
      return [
        Decoration.inline(from, to, {
          nodeName: 'a',
          href: `/issues/${key}`,
          class: 'tl-issue-key',
          title: issue.summary,
        }),
        Decoration.widget(
          to,
          () => {
            const badge = document.createElement('span');
            badge.className = `tl-issue-key-status ${STATUS_TONE[issue.status.category]}`;
            badge.textContent = issue.status.name;
            badge.contentEditable = 'false';
            return badge;
          },
          { side: 1, ignoreSelection: true, key: `${key}:${issue.status.id}` },
        ),
      ];
    }),
  );
}

const pluginKey = new PluginKey<DecorationSet>('issueKeyLinks');

export const IssueKeyLinks = Extension.create({
  name: 'issueKeyLinks',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (tr, previous) =>
            tr.docChanged || tr.getMeta(pluginKey) ? decorations(tr.doc) : previous,
        },
        props: { decorations: (state) => pluginKey.getState(state) },
        view: (view) => {
          const refresh = () => {
            if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(pluginKey, true));
          };
          listeners.add(refresh);
          return { destroy: () => listeners.delete(refresh) };
        },
      }),
    ];
  },
});
