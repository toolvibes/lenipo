import type { Server as HttpServer } from 'node:http';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationShutdown,
} from '@nestjs/common';
import postgres from 'postgres';
import { Server, type Socket } from 'socket.io';
import { BoardService } from '../boards/board.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { countConnections } from '../core/metrics.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { readSessionCookie } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { PageService } from '../wiki/page.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { CHANGES_CHANNEL, type Signal } from './signals.js';

/** Socket.IO under the API prefix, so the dev proxy and Caddy pass it like the API. */
export const REALTIME_PATH = '/api/v1/realtime';
const RECHECK_MS = 5 * 60_000;

interface SocketData {
  principal: Principal;
  /** Rooms joined after a permission check, re-checked regularly. */
  rooms: Set<string>;
}

/**
 * Realtime signals for boards, issues and the bell (T-BRD-09, P-NTF-01, E-58): every API
 * instance listens to PostgreSQL NOTIFY on its own connection and tells its sockets.
 */
@Injectable()
export class RealtimeService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private io?: Server;
  private listener?: postgres.Sql;
  private recheck?: NodeJS.Timeout;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  async attach(server: HttpServer): Promise<void> {
    const io = new Server(server, {
      path: REALTIME_PATH,
      serveClient: false,
      // A cookie-authenticated socket must not be opened by another site.
      // An unparseable origin ("null") is refused, never thrown: it would end the process.
      allowRequest: (request, done) => {
        const origin = request.headers.origin;
        let allowed = !origin;
        try {
          allowed ||= new URL(origin as string).host === request.headers.host;
        } catch {
          allowed = false;
        }
        done(null, allowed);
      },
    });
    io.use(async (socket, next) => {
      const secret = readSessionCookie(socket.handshake.headers.cookie);
      const session = secret ? await this.sessions.authenticate(secret) : null;
      // A sign-in still waiting for its second factor gets no signals (TL-44).
      if (session?.stage !== 'full') return next(new Error('Authentication required'));
      socket.data = {
        principal: { userId: session.userId, via: 'session', sessionId: session.sessionId },
        rooms: new Set<string>(),
      } satisfies SocketData;
      await socket.join(`user:${session.userId}`);
      next();
    });
    io.on('connection', (socket) => this.connected(socket));
    countConnections('realtime', () => io.engine.clientsCount);
    this.io = io;

    // A dedicated connection: LISTEN must not share a pooled one (E-58).
    this.listener = postgres(this.config.DATABASE_URL, { max: 1, onnotice: () => {} });
    await this.listener.listen(CHANGES_CHANNEL, (payload) => this.dispatch(payload));
    this.recheck = setInterval(() => void this.recheckRooms(), RECHECK_MS);
  }

  private connected(socket: Socket): void {
    socket.on('subscribe', async (rooms: unknown, ack?: (result: unknown) => void) => {
      const wanted = Array.isArray(rooms) ? rooms.filter((room) => typeof room === 'string') : [];
      const joined: string[] = [];
      for (const room of wanted.slice(0, 200)) {
        if (await this.allowed(socket.data as SocketData, room)) {
          await socket.join(room);
          (socket.data as SocketData).rooms.add(room);
          joined.push(room);
        }
      }
      ack?.({ joined });
    });
    socket.on('unsubscribe', async (rooms: unknown) => {
      for (const room of Array.isArray(rooms) ? rooms : []) {
        if (typeof room !== 'string') continue;
        await socket.leave(room);
        (socket.data as SocketData).rooms.delete(room);
      }
    });
  }

  /** May this socket's person see what the room is about? */
  private async allowed(data: SocketData, room: string): Promise<boolean> {
    const [kind, id] = room.split(':', 2);
    if (!id) return false;
    try {
      if (kind === 'project') await this.projects.findBrowsable(data.principal, id);
      else if (kind === 'board') await this.boards.get(data.principal, id);
      else if (kind === 'issue') await this.issues.authorize(data.principal, id, 'browse');
      else if (kind === 'space') await this.spaces.find(data.principal, id);
      else if (kind === 'page') await this.pages.authorize(data.principal, id, 'view');
      else return false;
      return true;
    } catch {
      return false;
    }
  }

  /** Rights change: rooms are checked again regularly, and left when no longer allowed. */
  private async recheckRooms(): Promise<void> {
    for (const socket of this.io?.sockets.sockets.values() ?? []) {
      const data = socket.data as SocketData;
      for (const room of [...data.rooms]) {
        if (!(await this.allowed(data, room))) {
          await socket.leave(room);
          data.rooms.delete(room);
        }
      }
    }
  }

  private dispatch(payload: string): void {
    let parsed: Signal;
    try {
      parsed = JSON.parse(payload) as Signal;
    } catch {
      this.logger.warn({ payload }, 'Unreadable realtime signal');
      return;
    }
    const io = this.io;
    if (!io) return;
    if (parsed.type === 'issue') {
      io.to([`project:${parsed.projectKey}`, `issue:${parsed.issueKey}`]).emit('change', parsed);
    } else if (parsed.type === 'board') {
      io.to(`board:${parsed.boardId}`).emit('change', parsed);
    } else if (parsed.type === 'notification') {
      io.to(`user:${parsed.userId}`).emit('change', parsed);
    } else if (parsed.type === 'space') {
      io.to(`space:${parsed.spaceKey}`).emit('change', parsed);
    } else if (parsed.type === 'page') {
      io.to([`space:${parsed.spaceKey}`, `page:${parsed.pageId}`]).emit('change', parsed);
    }
  }

  /**
   * Before the HTTP server closes: it waits for every open connection, and the sockets would
   * keep it open forever (TL-54).
   */
  async beforeApplicationShutdown(): Promise<void> {
    if (this.recheck) clearInterval(this.recheck);
    await this.io?.close();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.listener?.end({ timeout: 2 });
  }
}
