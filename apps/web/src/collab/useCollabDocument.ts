import { HocuspocusProvider, type StatesArray, WebSocketStatus } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

/** How the local user appears to others: caret label and color. */
export interface CollabIdentity {
  name: string;
  color: string;
}

export interface CollabSession {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}

export interface Peer {
  clientId: number;
  name: string;
  color: string;
  isSelf: boolean;
}

function collabUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/collab`;
}

function toPeers(states: StatesArray, selfId: number): Peer[] {
  return states
    .filter((state) => state.user)
    .map((state) => ({
      clientId: state.clientId,
      name: String(state.user.name),
      color: String(state.user.color),
      isSelf: state.clientId === selfId,
    }));
}

/** Connects to one collaborative document and reports connection, sync and presence state. */
export function useCollabDocument(name: string) {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Connecting);
  const [synced, setSynced] = useState(false);
  const [unsyncedChanges, setUnsyncedChanges] = useState(0);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabUrl(),
      name,
      document: doc,
      // The server authenticates with the session cookie; the provider only needs a non-empty token.
      token: 'session',
      onStatus: ({ status }) => setStatus(status),
      onSynced: ({ state }) => setSynced(state),
      onUnsyncedChanges: ({ number }) => setUnsyncedChanges(number),
      // Awareness can change synchronously while the editor renders (the caret extension sets
      // the local user on creation), so defer the state update out of the render phase.
      onAwarenessChange: ({ states }) =>
        queueMicrotask(() => setPeers(toPeers(states, doc.clientID))),
      onAuthenticationFailed: ({ reason }) => setAuthError(reason),
    });
    setSession({ doc, provider });

    return () => {
      provider.destroy();
      doc.destroy();
      setSession(null);
      setSynced(false);
      setPeers([]);
    };
  }, [name]);

  return { session, status, synced, unsyncedChanges, peers, authError };
}
