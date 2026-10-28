import {
  BookOpenText,
  Desktop,
  House,
  type Icon,
  Moon,
  NotePencil,
  SignOut,
  Sun,
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme } from '../../lib/theme';

interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}

function Item({
  icon: IconComponent,
  label,
  onSelect,
}: {
  icon: Icon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2 text-[var(--ink)] data-[selected=true]:bg-[var(--accent-soft)] data-[selected=true]:text-[var(--accent)]"
    >
      <IconComponent size={18} aria-hidden />
      {label}
    </Command.Item>
  );
}

const GROUP_HEADING =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.04em] [&_[cmdk-group-heading]]:text-[var(--ink-muted)]';

/** Ctrl/Cmd+K: jump anywhere and run actions from the keyboard (decision E-29). */
export function CommandPalette({ open, onOpenChange, onSignOut }: PaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('palette.label')}
      overlayClassName="fixed inset-0 bg-[rgb(0_0_0/0.35)]"
      contentClassName="fixed top-[12vh] left-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-float)]"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder={t('palette.placeholder')}
        className="h-12 w-full border-b border-[var(--border)] bg-transparent px-4 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
      />
      <Command.List className={`max-h-[50vh] overflow-y-auto p-2 ${GROUP_HEADING}`}>
        <Command.Empty className="px-2 py-6 text-center text-[var(--ink-muted)]">
          {t('palette.empty')}
        </Command.Empty>
        <Command.Group heading={t('palette.navigation')}>
          <Item
            icon={House}
            label={t('shell.home')}
            onSelect={() => run(() => navigate({ to: '/' }))}
          />
          <Item
            icon={NotePencil}
            label={t('shell.testPage')}
            onSelect={() =>
              run(() => navigate({ to: '/pages/$pageId', params: { pageId: 'spike' } }))
            }
          />
          <Item
            icon={BookOpenText}
            label={t('palette.apiDocs')}
            onSelect={() => run(() => window.open('/api/docs/', '_blank', 'noopener'))}
          />
        </Command.Group>
        <Command.Group heading={t('palette.appearance')}>
          <Item
            icon={Sun}
            label={t('palette.themeLight')}
            onSelect={() => run(() => applyTheme('light'))}
          />
          <Item
            icon={Moon}
            label={t('palette.themeDark')}
            onSelect={() => run(() => applyTheme('dark'))}
          />
          <Item
            icon={Desktop}
            label={t('palette.themeSystem')}
            onSelect={() => run(() => applyTheme('system'))}
          />
        </Command.Group>
        <Command.Group heading={t('palette.account')}>
          <Item icon={SignOut} label={t('common.signOut')} onSelect={() => run(onSignOut)} />
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
