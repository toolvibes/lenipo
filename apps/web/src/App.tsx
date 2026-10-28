import { useState } from 'react';
import { CollabEditor } from './collab/CollabEditor';
import { getDevIdentity } from './collab/identity';
import { PresenceBar } from './collab/PresenceBar';
import { StatusBadge } from './collab/StatusBadge';
import { useCollabDocument } from './collab/useCollabDocument';

const DEFAULT_DOCUMENT = 'page:spike';

function documentFromUrl(): string {
  const requested = new URLSearchParams(window.location.search).get('doc');
  return requested && /^(page|issue):[A-Za-z0-9_-]{1,64}$/.test(requested)
    ? requested
    : DEFAULT_DOCUMENT;
}

export function App() {
  const [identity] = useState(getDevIdentity);
  const [documentName] = useState(documentFromUrl);
  const { session, status, synced, unsyncedChanges, peers, authError } = useCollabDocument(
    documentName,
    identity,
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tight">Tasklore</span>
            <span className="font-mono text-sm text-[var(--muted)]">{documentName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={status} synced={synced} unsyncedChanges={unsyncedChanges} />
            <PresenceBar peers={peers} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {authError ? (
          <p className="rounded-lg border border-[var(--danger)] p-4 text-[var(--danger)]">
            Zugriff verweigert: {authError}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            {session && <CollabEditor session={session} identity={identity} />}
          </div>
        )}
        <p className="mt-4 text-sm text-[var(--muted)]">
          Du bist <strong style={{ color: identity.color }}>{identity.name}</strong>. Öffne diese
          Seite in einem zweiten Tab, um gemeinsames Bearbeiten zu testen.
        </p>
      </main>
    </div>
  );
}
