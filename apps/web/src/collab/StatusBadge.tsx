import { WebSocketStatus } from '@hocuspocus/provider';

interface StatusBadgeProps {
  status: WebSocketStatus;
  synced: boolean;
  unsyncedChanges: number;
}

export function StatusBadge({ status, synced, unsyncedChanges }: StatusBadgeProps) {
  let label = 'Verbinde …';
  let color = 'var(--warn)';
  if (status === WebSocketStatus.Disconnected) {
    label = 'Offline – Änderungen werden nachgereicht';
    color = 'var(--danger)';
  } else if (status === WebSocketStatus.Connected && synced) {
    label = unsyncedChanges > 0 ? 'Speichert …' : 'Gespeichert';
    color = unsyncedChanges > 0 ? 'var(--warn)' : 'var(--ok)';
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
