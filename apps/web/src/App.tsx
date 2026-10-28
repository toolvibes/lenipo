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
      <header className="border-b border-[var(--border)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-serif)] text-[22px] leading-7 font-semibold">
              Tasklore
            </span>
            <span className="tl-key text-[var(--ink-muted)]">{documentName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={status} synced={synced} unsyncedChanges={unsyncedChanges} />
            <PresenceBar peers={peers} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {authError ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">
            Zugriff verweigert: {authError}
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
            {session && <CollabEditor session={session} identity={identity} />}
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          Testidentität: <strong style={{ color: identity.color }}>{identity.name}</strong>. Zum
          Ausprobieren des gemeinsamen Bearbeitens diese Seite in einem zweiten Tab öffnen.
        </p>
      </main>
    </div>
  );
}
