import { useQuery } from '@tanstack/react-query';
import type { UserRef } from '@tasklore/shared';
import { Command } from 'cmdk';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { initials, presenceColor } from '../../lib/presence';
import { Dialog } from '../../ui/Dialog';

interface UserPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (user: UserRef | null) => void;
  me: UserRef;
}

export function Avatar({ user, size = 24 }: { user: UserRef; size?: number }) {
  return (
    <span
      title={user.displayName}
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: presenceColor(user.id),
      }}
      aria-hidden
    >
      {initials(user.displayName)}
    </span>
  );
}

/** Searchable people picker (assignee); keyboard-first through cmdk. */
export function UserPicker({ open, onOpenChange, onPick, me }: UserPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const results = useQuery({
    queryKey: ['users', query],
    queryFn: () => unwrap(client.GET('/api/v1/users', { params: { query: { query, limit: 20 } } })),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  function pick(user: UserRef | null) {
    onPick(user);
    onOpenChange(false);
    setQuery('');
  }

  const item =
    'flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 data-[selected=true]:bg-[var(--accent-soft)] data-[selected=true]:text-[var(--accent)]';
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('issues.assignee')} width={420}>
      <Command shouldFilter={false} className="flex flex-col gap-2">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder={t('palette.placeholder')}
          className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
        />
        <Command.List className="max-h-72 overflow-y-auto">
          <Command.Item value="__me" onSelect={() => pick(me)} className={item}>
            <Avatar user={me} />
            {t('issues.assignToMe')}
          </Command.Item>
          <Command.Item value="__none" onSelect={() => pick(null)} className={item}>
            <span
              className="size-6 rounded-full border border-dashed border-[var(--border-strong)]"
              aria-hidden
            />
            {t('issues.unassigned')}
          </Command.Item>
          {results.data
            ?.filter((user) => user.id !== me.id)
            .map((user) => (
              <Command.Item
                key={user.id}
                value={user.id}
                onSelect={() => pick(user)}
                className={item}
              >
                <Avatar user={user} />
                <span className="min-w-0 flex-1 truncate">{user.displayName}</span>
                <span className="truncate text-xs text-[var(--ink-muted)]">{user.email}</span>
              </Command.Item>
            ))}
        </Command.List>
      </Command>
    </Dialog>
  );
}
