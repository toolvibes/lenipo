import { Lightbulb } from '@phosphor-icons/react';
import * as Popover from '@radix-ui/react-popover';
import { QUERY_TEMPLATES } from '@toolvibes/tql';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../../ui/Button';

/** Building blocks of the quick help; "|" marks where the cursor goes after inserting. */
const SNIPPETS = [
  {
    group: 'combine',
    items: [
      { id: 'and', code: 'AND' },
      { id: 'or', code: 'OR' },
      { id: 'not', code: 'NOT' },
      { id: 'group', code: '(|)' },
    ],
  },
  {
    group: 'compare',
    items: [
      { id: 'eq', code: '=' },
      { id: 'ne', code: '!=' },
      { id: 'in', code: 'IN (|)' },
      { id: 'contains', code: '~ "|"' },
      { id: 'empty', code: 'IS EMPTY' },
      { id: 'gte', code: '>=' },
    ],
  },
  {
    group: 'functions',
    items: [
      { id: 'me', code: 'currentUser()' },
      { id: 'sprint', code: 'openSprints()' },
      { id: 'today', code: 'startOfDay()' },
      { id: 'week', code: 'startOfWeek()' },
    ],
  },
  {
    group: 'dates',
    items: [
      { id: 'days', code: '-7d' },
      { id: 'weeks', code: '-2w' },
      { id: 'month', code: 'startOfMonth()' },
    ],
  },
  { group: 'sort', items: [{ id: 'order', code: 'ORDER BY updated DESC' }] },
] as const;

const ROW =
  'flex w-full min-w-0 items-baseline gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-left hover:bg-[var(--selected)] focus-visible:bg-[var(--selected)]';

/**
 * Templates and a cheat sheet of TQL in one popover: a template searches at once, a building
 * block goes into the query at the cursor.
 */
export function TqlHelp({
  onTemplate,
  onInsert,
}: {
  onTemplate: (query: string) => void;
  onInsert: (snippet: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /** After a pick the focus belongs to the query field, not back to this button. */
  const picked = useRef(false);

  function pick(action: () => void) {
    picked.current = true;
    setOpen(false);
    action();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={buttonClass('ghost', 'sm')}>
        <Lightbulb size={16} aria-hidden />
        {t('search.help.button')}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          aria-label={t('search.help.title')}
          onCloseAutoFocus={(event) => {
            if (picked.current) event.preventDefault();
            picked.current = false;
          }}
          className="z-50 flex [font-variant-ligatures:none] max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(34rem,calc(100vw-32px))] flex-col gap-4 overflow-y-auto rounded-[16px] bg-[var(--surface-1)] p-4 text-[13px] shadow-[var(--shadow-float)]"
        >
          <section className="flex flex-col gap-1">
            <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('search.help.templates')}</h2>
            <p className="m-0 text-xs text-[var(--ink-muted)]">{t('search.help.templatesHint')}</p>
            <ul className="m-0 flex list-none flex-col p-0">
              {QUERY_TEMPLATES.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={ROW}
                    onClick={() => pick(() => onTemplate(template.query))}
                  >
                    <span className="shrink-0 font-semibold text-[var(--ink)]">
                      {t(`search.presets.${template.id}`)}
                    </span>
                    <code className="min-w-0 truncate text-xs text-[var(--ink-muted)]">
                      {template.query}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('search.help.snippets')}</h2>
              <p className="m-0 text-xs text-[var(--ink-muted)]">{t('search.help.snippetsHint')}</p>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {SNIPPETS.map((group) => (
                <div key={group.group} className="flex min-w-0 flex-col">
                  <h3 className="m-0 px-2 pb-0.5 text-xs font-semibold text-[var(--ink-soft)]">
                    {t(`search.help.groups.${group.group}`)}
                  </h3>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={ROW}
                          onClick={() => pick(() => onInsert(item.code))}
                        >
                          <code className="shrink-0 font-semibold text-[var(--accent-hover)]">
                            {item.code.replace('|', '…')}
                          </code>
                          <span className="min-w-0 truncate text-[var(--ink-muted)]">
                            {t(`search.help.snippet.${item.id}`)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
