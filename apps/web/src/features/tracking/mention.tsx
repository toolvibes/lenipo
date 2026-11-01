import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import type { UserRef } from '@toolvibes/shared';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Avatar } from './UserPicker';

interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/** The suggestion list below the caret while typing @name. */
const MentionList = forwardRef<MentionListHandle, SuggestionProps<UserRef>>(function MentionList(
  { items, command },
  ref,
) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [itemsSeen, setItemsSeen] = useState(items);
  if (itemsSeen !== items) {
    setItemsSeen(items);
    setActive(0);
  }

  const pick = (index: number) => {
    const user = items[index];
    if (user) command({ id: user.id, label: user.displayName });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(active);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label={t('issues.mentionPeople')}
      className="w-64 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-[var(--ink-muted)]">{t('issues.mentionNone')}</div>
      ) : (
        items.map((user, index) => (
          <div
            key={user.id}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            // Keep the focus in the editor.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(index)}
            onKeyDown={() => {}}
            className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 ${
              index === active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''
            }`}
          >
            <Avatar user={user} size={20} />
            <span className="truncate">{user.displayName}</span>
          </div>
        ))
      )}
    </div>
  );
});

function place(element: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  element.style.position = 'fixed';
  element.style.zIndex = '50';
  element.style.top = `${rect.bottom + 4}px`;
  element.style.left = `${Math.min(rect.left, window.innerWidth - 272)}px`;
}

/** Whose people typing @ suggests: of a project (E-39) or of a wiki space (E-63). */
export type MentionSource = { project: string } | { space: string };

/**
 * @-mentions as nodes with user id and label (E-38). With a source, typing @ suggests the
 * people who can see it; without one, mentions only render.
 */
export function mentionExtension(source?: MentionSource) {
  const base = Mention.configure({
    HTMLAttributes: { class: 'tl-mention' },
    renderText: ({ node }) => `@${node.attrs.label ?? ''}`,
    renderHTML: ({ options, node }) => [
      'span',
      options.HTMLAttributes,
      `@${node.attrs.label ?? node.attrs.id}`,
    ],
  });
  if (!source) return base;
  return base.configure({
    suggestion: {
      items: async ({ query }) =>
        unwrap(
          'project' in source
            ? client.GET('/api/v1/projects/{key}/users', {
                params: { path: { key: source.project }, query: { query, limit: 8 } },
              })
            : client.GET('/api/v1/spaces/{key}/users', {
                params: { path: { key: source.space }, query: { query, limit: 8 } },
              }),
        ).catch(() => []),
      render: () => {
        let renderer: ReactRenderer<MentionListHandle, SuggestionProps<UserRef>> | null = null;
        return {
          onStart: (props) => {
            renderer = new ReactRenderer(MentionList, { props, editor: props.editor });
            document.body.appendChild(renderer.element);
            place(renderer.element as HTMLElement, props.clientRect?.());
          },
          onUpdate: (props) => {
            renderer?.updateProps(props);
            if (renderer) place(renderer.element as HTMLElement, props.clientRect?.());
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              renderer?.destroy();
              renderer?.element.remove();
              renderer = null;
              return true;
            }
            return renderer?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            renderer?.destroy();
            renderer?.element.remove();
            renderer = null;
          },
        };
      },
    },
  });
}
