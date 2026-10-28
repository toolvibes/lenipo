import { WebSocketStatus } from '@hocuspocus/provider';

interface StatusBadgeProps {
  status: WebSocketStatus;
  synced: boolean;
  unsyncedChanges: number;
}

export function StatusBadge({ status, synced, unsyncedChanges }: StatusBadgeProps) {
  let label = 'Verbinde …';
  let color = 'var(--warning)';
  if (status === WebSocketStatus.Disconnected) {
    label = 'Offline – Änderungen werden nachgereicht';
    color = 'var(--danger)';
  } else if (status === WebSocketStatus.Connected && synced) {
    label = unsyncedChanges > 0 ? 'Speichert …' : 'Gespeichert';
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
