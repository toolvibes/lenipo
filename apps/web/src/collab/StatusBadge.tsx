import { WebSocketStatus } from '@hocuspocus/provider';
import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: WebSocketStatus;
  synced: boolean;
  unsyncedChanges: number;
}

export function StatusBadge({ status, synced, unsyncedChanges }: StatusBadgeProps) {
  const { t } = useTranslation();
  let label: string = t('collab.connecting');
  let color = 'var(--warning)';
  if (status === WebSocketStatus.Disconnected) {
    label = t('collab.offline');
    color = 'var(--danger)';
  } else if (status === WebSocketStatus.Connected && synced) {
    label = unsyncedChanges > 0 ? t('collab.saving') : t('collab.saved');
    color = unsyncedChanges > 0 ? 'var(--warning)' : 'var(--success)';
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]"
      role="status"
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
