import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { recentQuery } from '../../lib/personal';
import {
  type Shortcut,
  useCurrentProjectKey,
  useRegisteredShortcuts,
  useShortcuts,
} from '../../lib/shortcuts';
import { projectQuery, projectsQuery } from '../../lib/tracking';
import { Dialog } from '../../ui/Dialog';
import { CreateIssueDialog } from '../tracking/CreateIssueDialog';

const GROUPS: Shortcut['group'][] = ['navigation', 'actions', 'issue'];

/** Keys as shown in the help: "g b" becomes two key caps with "then". */
function Keys({ keys }: { keys: string }) {
  const { t } = useTranslation();
  const parts = keys.split(' ');
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-1">
          {index > 0 && (
            <span className="text-xs text-[var(--ink-muted)]">{t('shortcuts.followedBy')}</span>
          )}
          <kbd className="min-w-6 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 text-center font-[family-name:var(--font-mono)] text-xs">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const shortcuts = useRegisteredShortcuts();
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('shortcuts.title')} width={560}>
      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => {
          const entries = shortcuts.filter((shortcut) => shortcut.group === group);
          if (entries.length === 0) return null;
          return (
            <section key={group} className="flex flex-col gap-1">
              <h3 className="tl-label m-0 text-[var(--ink-muted)]">
                {t(`shortcuts.groups.${group}`)}
              </h3>
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
                {entries.map((shortcut) => (
                  <div key={shortcut.keys} className="contents">
                    <dt>{t(shortcut.label as never)}</dt>
                    <dd className="m-0">
                      <Keys keys={shortcut.keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
        <section className="flex flex-col gap-1">
          <h3 className="tl-label m-0 text-[var(--ink-muted)]">
            {t('shortcuts.groups.everywhere')}
          </h3>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
            <dt>{t('shortcuts.palette')}</dt>
            <dd className="m-0">
              <Keys keys={isMac ? '⌘+K' : 'Strg+K'} />
            </dd>
            <dt>{t('shortcuts.listMove')}</dt>
            <dd className="m-0">
              <Keys keys="j/k" />
            </dd>
          </dl>
        </section>
      </div>
    </Dialog>
  );
}

/** "c" from anywhere: the project of the current page, else the last visited one. */
function QuickCreate({
  me,
  open,
  onOpenChange,
}: {
  me: Me;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const current = useCurrentProjectKey();
  const recent = useQuery({ ...recentQuery(8), enabled: open });
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const fallback =
    current ??
    recent.data?.find((item) => item.kind === 'project')?.ref ??
    recent.data?.find((item) => item.kind === 'issue')?.issue?.key.split('-')[0] ??
    projects.data?.[0]?.key ??
    null;
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    if (open) setChosen(null);
  }, [open]);
  const key = chosen ?? fallback;
  const project = useQuery({ ...projectQuery(key ?? ''), enabled: open && !!key });
  if (!open || !project.data) return null;
  return (
    <CreateIssueDialog
      project={project.data}
      open={open}
      onOpenChange={onOpenChange}
      myId={me.id}
      header={
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('boards.project')}</span>
          <select
            value={project.data.key}
            onChange={(event) => setChosen(event.target.value)}
            className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
          >
            {(projects.data ?? []).map((entry) => (
              <option key={entry.id} value={entry.key}>
                {entry.name} ({entry.key})
              </option>
            ))}
          </select>
        </label>
      }
    />
  );
}

/** The app-wide shortcuts and their dialogs (T-VIEW-04). */
export function GlobalShortcuts({ me, onPalette }: { me: Me; onPalette: () => void }) {
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const [creating, setCreating] = useState(false);
  useShortcuts([
    { keys: '/', label: 'shortcuts.search', group: 'actions', run: onPalette },
    { keys: 'c', label: 'shortcuts.create', group: 'actions', run: () => setCreating(true) },
    { keys: '?', label: 'shortcuts.help', group: 'actions', run: () => setHelp(true) },
    {
      keys: 'g h',
      label: 'shortcuts.goHome',
      group: 'navigation',
      run: () => void navigate({ to: '/' }),
    },
    {
      keys: 'g p',
      label: 'shortcuts.goProjects',
      group: 'navigation',
      run: () => void navigate({ to: '/projects' }),
    },
    {
      keys: 'g i',
      label: 'shortcuts.goIssues',
      group: 'navigation',
      run: () => void navigate({ to: '/issues', search: {} }),
    },
    {
      keys: 'g b',
      label: 'shortcuts.goBoards',
      group: 'navigation',
      run: () => void navigate({ to: '/boards' }),
    },
    {
      keys: 'g w',
      label: 'shortcuts.goWiki',
      group: 'navigation',
      run: () => void navigate({ to: '/spaces' }),
    },
    {
      keys: 'g a',
      label: 'shortcuts.goActivity',
      group: 'navigation',
      run: () => void navigate({ to: '/activity', search: {} }),
    },
  ]);
  return (
    <>
      <HelpDialog open={help} onOpenChange={setHelp} />
      <QuickCreate me={me} open={creating} onOpenChange={setCreating} />
    </>
  );
}
