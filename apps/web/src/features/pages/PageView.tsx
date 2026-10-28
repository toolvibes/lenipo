import type { Me } from '@tasklore/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CollabEditor } from '../../collab/CollabEditor';
import { PresenceBar } from '../../collab/PresenceBar';
import { StatusBadge } from '../../collab/StatusBadge';
import { useCollabDocument } from '../../collab/useCollabDocument';
import { presenceColor } from '../../lib/presence';

/** A collaboratively edited page. Real wiki pages (spaces, tree, versions) arrive in phase 3. */
export function PageView({ me, pageId }: { me: Me; pageId: string }) {
  const { t } = useTranslation();
  const identity = useMemo(() => ({ name: me.displayName, color: presenceColor(me.id) }), [me]);
  const documentName = `page:${pageId}`;
  const { session, status, synced, unsyncedChanges, peers, authError } = useCollabDocument(
    documentName,
    identity,
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-1)] px-6 py-3">
        <span className="tl-key text-[var(--ink-muted)]">{documentName}</span>
        <div className="flex flex-wrap items-center gap-4">
          <StatusBadge status={status} synced={synced} unsyncedChanges={unsyncedChanges} />
          <PresenceBar peers={peers} />
        </div>
      </div>
      <main className="px-4 py-6 sm:px-6">
        {authError ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">
            {t('collab.accessDenied', { reason: authError })}
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
            {session && <CollabEditor session={session} identity={identity} />}
          </div>
        )}
      </main>
    </div>
  );
}
