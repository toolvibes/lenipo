import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

/** Realtime signals (T-BRD-09, P-NTF-01, E-58): ids only; the caches refetch via the API. */
type Signal =
  | { type: 'issue'; issueKey: string; projectKey: string }
  | { type: 'board'; boardId: string }
  | { type: 'notification'; userId: string }
  | { type: 'space'; spaceKey: string }
  | { type: 'page'; pageId: string; spaceKey: string };

let socket: Socket | null = null;
/** Rooms wanted by the pages on screen, counted, so a room is left only when nobody needs it. */
const rooms = new Map<string, number>();

function connection(): Socket {
  socket ??= io({ path: '/api/v1/realtime', withCredentials: true, autoConnect: true });
  return socket;
}

/** Keeps the given rooms subscribed while the calling component is shown. */
export function useRealtimeRooms(wanted: string[]): void {
  const key = [...new Set(wanted)].sort().join('|');
  useEffect(() => {
    const list = key ? key.split('|') : [];
    const fresh = list.filter((room) => {
      const count = rooms.get(room) ?? 0;
      rooms.set(room, count + 1);
      return count === 0;
    });
    if (fresh.length > 0) connection().emit('subscribe', fresh);
    return () => {
      const gone = list.filter((room) => {
        const count = (rooms.get(room) ?? 1) - 1;
        if (count <= 0) rooms.delete(room);
        else rooms.set(room, count);
        return count <= 0;
      });
      if (gone.length > 0) connection().emit('unsubscribe', gone);
    };
  }, [key]);
}

function keysFor(signal: Signal): QueryKey[] {
  if (signal.type === 'issue') {
    return [['issue', signal.issueKey], ['search'], ['project-issues'], ['board'], ['activity']];
  }
  if (signal.type === 'board') return [['board', signal.boardId], ['boards']];
  if (signal.type === 'space') return [['space', signal.spaceKey], ['spaces']];
  if (signal.type === 'page')
    return [
      ['page', signal.pageId],
      ['space', signal.spaceKey],
    ];
  return [['notifications']];
}

/**
 * Connects once for the signed-in app and turns signals into cache invalidations, gathered
 * for a moment so a burst of changes refetches once. After a reconnect everything shown is
 * refetched, since signals may have been missed meanwhile.
 */
export function startRealtime(queryClient: QueryClient): () => void {
  const client = connection();
  const pending = new Map<string, QueryKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connectedBefore = false;

  const flush = () => {
    timer = undefined;
    for (const queryKey of pending.values()) void queryClient.invalidateQueries({ queryKey });
    pending.clear();
  };
  const onChange = (signal: Signal) => {
    for (const queryKey of keysFor(signal)) pending.set(JSON.stringify(queryKey), queryKey);
    timer ??= setTimeout(flush, 250);
  };
  const onConnect = () => {
    if (rooms.size > 0) client.emit('subscribe', [...rooms.keys()]);
    if (connectedBefore) void queryClient.invalidateQueries();
    connectedBefore = true;
  };

  client.on('change', onChange);
  client.on('connect', onConnect);
  if (client.connected) onConnect();
  return () => {
    client.off('change', onChange);
    client.off('connect', onConnect);
    if (timer) clearTimeout(timer);
  };
}

/** Closes the connection, e.g. on sign-out. */
export function stopRealtime(): void {
  socket?.close();
  socket = null;
  rooms.clear();
}
