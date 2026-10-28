import type { Peer } from './useCollabDocument';

function initials(name: string): string {
  return name.replace(/^Gast /, '').slice(0, 3);
}

export function PresenceBar({ peers }: { peers: Peer[] }) {
  const sorted = [...peers].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
  const shown = sorted.length > 5 ? sorted.slice(0, 4) : sorted;
  const hidden = sorted.length - shown.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {shown.map((peer, index) => (
          <span
            key={peer.clientId}
            title={peer.isSelf ? `${peer.name} (Sie)` : peer.name}
            className="grid size-7 place-items-center rounded-full border-2 border-[var(--surface-1)] text-[11px] font-semibold text-white"
            style={{ backgroundColor: peer.color, marginLeft: index === 0 ? 0 : -8 }}
          >
            {initials(peer.name)}
          </span>
        ))}
        {hidden > 0 && (
          <span className="-ml-2 grid size-7 place-items-center rounded-full border-2 border-[var(--surface-1)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--ink)]">
            +{hidden}
          </span>
        )}
      </div>
      <span className="text-xs text-[var(--ink-muted)]">
        {peers.length <= 1 ? 'Keine weiteren Personen' : `${peers.length} Personen bearbeiten`}
      </span>
    </div>
  );
}
