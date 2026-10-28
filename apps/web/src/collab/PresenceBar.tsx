import type { Peer } from './useCollabDocument';

export function PresenceBar({ peers }: { peers: Peer[] }) {
  const others = peers.filter((peer) => !peer.isSelf).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {peers.map((peer) => (
          <span
            key={peer.clientId}
            title={peer.isSelf ? `${peer.name} (du)` : peer.name}
            className="grid size-8 place-items-center rounded-full border-2 border-[var(--surface)] text-xs font-semibold text-white"
            style={{ backgroundColor: peer.color }}
          >
            {peer.name.replace(/^Gast /, '').slice(0, 3)}
          </span>
        ))}
      </div>
      <span className="text-sm text-[var(--muted)]">
        {others === 0 ? 'Nur du' : `${others} weitere ${others === 1 ? 'Person' : 'Personen'}`}
      </span>
    </div>
  );
}
