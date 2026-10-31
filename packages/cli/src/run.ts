import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { markdownToDoc } from '@tasklore/editor';
import {
  exportFolder,
  type FolderPage,
  importFolder,
  parseMarkdownFile,
  type WikiPort,
} from '@tasklore/editor/folder';
import { COMMANDS, completion } from './completion.js';
import { loadConfig, saveConfig } from './config.js';
import { bridge } from './mcp.js';
import { formatOf, render } from './output.js';
import {
  CliError,
  type Io,
  normalizeUrl,
  oauthLogin,
  openSession,
  resolveProfile,
  type Session,
  unwrap,
} from './session.js';

export type { Io } from './session.js';

const HELP = `tl – Tasklore auf der Kommandozeile (auch: tasklore)

Anmelden
  tl login <adresse> [--token <tl_pat_…>] [--profile <name>]
  tl logout | tl whoami | tl profile list | tl profile use <name>

Vorgänge
  tl issue list [-q <TQL>] [--project <KEY>] [--mine] [--limit <n>]
  tl issue view <KEY> [--comments]
  tl issue create --project <KEY> --summary <text> [--type story] [--description <md>] [--assignee me|<e-mail>]
  tl issue edit <KEY> [--summary <text>] [--description <md>] [--labels a,b]
  tl issue move <KEY> <status oder übergang>
  tl issue comment <KEY> <text…>
  tl issue assign <KEY> me|none|<e-mail>

Boards und Sprints
  tl board list [--project <KEY>] | tl board view <id> [--mine]
  tl sprint list --board <id>

Wiki-Seiten als Markdown
  tl page get <id>
  tl page push <datei> [--space <KEY>] [--parent <id>]
  tl page pull <BEREICH> <ordner>
  tl page push-dir <ordner> --space <KEY> [--name <name>] [--skip a.md,b.md]

Weiteres
  tl mcp                      lokaler MCP-Server (stdio) als Brücke zu <adresse>/mcp
  tl admin users              Personen der Instanz (Administration)
  tl completion bash|zsh|fish

Optionen überall: --profile <name>, --output table|json|md
In CI: TASKLORE_URL und TASKLORE_TOKEN statt eines Profils.`;

/** Runs one command; returns the exit code (D-CLI, E-117). */
export async function run(argv: string[], io: Io): Promise<number> {
  try {
    await dispatch(argv, io);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      io.err(error.message);
      return error.code;
    }
    if (
      error instanceof Error &&
      'code' in error &&
      String((error as { code: unknown }).code).startsWith('ERR_PARSE_ARGS')
    ) {
      io.err(error.message);
      return 2;
    }
    if (error instanceof Error && error.message) {
      io.err(error.message);
      return 1;
    }
    throw error;
  }
}

const COMMON = {
  profile: { type: 'string' },
  output: { type: 'string', short: 'o' },
} as const;

async function dispatch(argv: string[], io: Io): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    io.out(HELP);
    return;
  }
  if (!(command in COMMANDS))
    throw new CliError(`Unbekannter Befehl „${command}“. Hilfe: tl help`, 2);
  switch (command) {
    case 'login':
      return login(rest, io);
    case 'logout':
      return logout(rest, io);
    case 'profile':
      return profiles(rest, io);
    case 'whoami': {
      const { values } = parseArgs({ args: rest, options: COMMON });
      const session = await openSession(io, values.profile);
      const me = await unwrap(session.client.GET('/api/v1/me'));
      io.out(`${me?.displayName} <${me?.email}> · ${session.url}`);
      return;
    }
    case 'issue':
      return issue(rest, io);
    case 'board':
      return board(rest, io);
    case 'sprint':
      return sprint(rest, io);
    case 'page':
      return page(rest, io);
    case 'mcp': {
      const { values } = parseArgs({ args: rest, options: COMMON });
      return bridge(await openSession(io, values.profile), io);
    }
    case 'admin':
      return admin(rest, io);
    case 'completion':
      io.out(completion(rest[0] ?? ''));
      return;
  }
}

// ---------------------------------------------------------------- login and profiles

async function login(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { ...COMMON, token: { type: 'string' } },
  });
  const raw = positionals[0];
  if (!raw) throw new CliError('Adresse fehlt: tl login https://tasklore.example.org', 2);
  const url = normalizeUrl(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  const auth = values.token
    ? ({ type: 'token', token: values.token } as const)
    : await oauthLogin(io, url);
  const token = auth.type === 'token' ? auth.token : auth.accessToken;
  const response = await fetch(`${url}/api/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new CliError(`Anmeldung abgelehnt (${response.status})`);
  const me = (await response.json()) as { displayName: string; email: string };
  const name = values.profile ?? new URL(url).host;
  const config = await loadConfig(io.configFile);
  config.profiles[name] = { url, auth, user: `${me.displayName} <${me.email}>` };
  config.current = name;
  await saveConfig(io.configFile, config);
  io.out(`Angemeldet als ${me.displayName} bei ${url} (Profil „${name}“).`);
}

async function logout(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: COMMON });
  const { name, profile, config } = await resolveProfile(io, values.profile);
  if (!name) throw new CliError('Mit TASKLORE_TOKEN gibt es nichts abzumelden.', 2);
  if (profile.auth.type === 'oauth' && profile.auth.revocationEndpoint) {
    await fetch(profile.auth.revocationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: profile.auth.refreshToken }),
    }).catch(() => undefined);
  }
  delete config.profiles[name];
  if (config.current === name) config.current = Object.keys(config.profiles)[0] ?? null;
  await saveConfig(io.configFile, config);
  io.out(`Abgemeldet (Profil „${name}“).`);
}

async function profiles(args: string[], io: Io) {
  const [sub, target] = args;
  const config = await loadConfig(io.configFile);
  if (sub === 'use') {
    if (!target || !config.profiles[target]) throw new CliError(`Kein Profil „${target ?? ''}“`, 2);
    config.current = target;
    await saveConfig(io.configFile, config);
    io.out(`Profil „${target}“ ist aktiv.`);
    return;
  }
  const rows = Object.entries(config.profiles).map(([name, profile]) => [
    name === config.current ? `* ${name}` : `  ${name}`,
    profile.url,
    profile.auth.type === 'oauth' ? 'Browser' : 'Token',
    profile.user ?? '',
  ]);
  io.out(
    rows.length
      ? render('table', ['PROFIL', 'ADRESSE', 'ANMELDUNG', 'PERSON'], rows, null, io.columns)
      : 'Keine Profile. tl login <adresse>',
  );
}

// ---------------------------------------------------------------- issues

interface IssueRow {
  key: string;
  summary: string;
  issueType: { name: string };
  status: { name: string };
  assignee: { displayName: string } | null;
}

const issueRows = (issues: IssueRow[]) =>
  issues.map((issue) => [
    issue.key,
    issue.issueType.name,
    issue.status.name,
    issue.assignee?.displayName ?? '–',
    issue.summary,
  ]);

async function issue(args: string[], io: Io) {
  const [sub, ...rest] = args;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      ...COMMON,
      query: { type: 'string', short: 'q' },
      project: { type: 'string' },
      mine: { type: 'boolean' },
      limit: { type: 'string' },
      comments: { type: 'boolean' },
      summary: { type: 'string' },
      type: { type: 'string' },
      description: { type: 'string' },
      assignee: { type: 'string' },
      labels: { type: 'string' },
    },
  });
  const format = formatOf(values.output);
  const session = await openSession(io, values.profile);
  const { client } = session;
  const key = positionals[0]?.toUpperCase();
  const needKey = () => {
    if (!key) throw new CliError('Vorgangsschlüssel fehlt, z. B. WEB-12', 2);
    return key;
  };

  switch (sub) {
    case 'list': {
      const parts = [
        values.project ? `project = ${values.project.toUpperCase()}` : '',
        values.mine ? 'assignee = currentUser()' : '',
        values.query ? `(${values.query})` : '',
      ].filter(Boolean);
      const query =
        parts.length === 0
          ? 'assignee = currentUser() AND resolution is EMPTY ORDER BY updated DESC'
          : `${parts.join(' AND ')}${values.query && /order\s+by/i.test(values.query) ? '' : ' ORDER BY updated DESC'}`;
      const result = await unwrap(
        client.POST('/api/v1/search', {
          body: { query, limit: Math.min(100, Number(values.limit ?? 50)), offset: 0 },
        }),
      );
      const rows = issueRows(result.issues);
      io.out(
        render(
          format,
          ['SCHLÜSSEL', 'TYP', 'STATUS', 'BEARBEITUNG', 'ZUSAMMENFASSUNG'],
          rows,
          result,
          io.columns,
        ),
      );
      if (format === 'table' && result.total > result.issues.length) {
        io.err(
          `${result.issues.length} von ${result.total} gezeigt; --limit erhöhen oder enger suchen.`,
        );
      }
      return;
    }
    case 'view': {
      const found = await unwrap(
        client.GET('/api/v1/issues/{key}', {
          params: { path: { key: needKey() }, query: { format: 'markdown' } },
        }),
      );
      const comments = values.comments
        ? await unwrap(
            client.GET('/api/v1/issues/{key}/comments', {
              params: { path: { key: needKey() }, query: { format: 'markdown' } },
            }),
          )
        : [];
      if (format === 'json') {
        io.out(JSON.stringify(values.comments ? { ...found, comments } : found, null, 2));
        return;
      }
      const lines = [
        `# ${found.key} ${found.summary}`,
        '',
        `${found.issueType.name} · ${found.status.name} · Priorität ${found.priority.name} · ${found.assignee?.displayName ?? 'nicht zugewiesen'}`,
        ...(found.labels.length ? [`Stichwörter: ${found.labels.join(', ')}`] : []),
        `${session.url}/issues/${found.key}`,
        '',
        typeof found.description === 'string' ? found.description : '',
      ];
      for (const comment of comments) {
        lines.push(
          '',
          `## ${comment.author?.displayName ?? '?'} · ${comment.createdAt.slice(0, 16).replace('T', ' ')}`,
          '',
          typeof comment.body === 'string' ? comment.body : '',
        );
      }
      io.out(lines.join('\n').trimEnd());
      return;
    }
    case 'create': {
      if (!values.project || !values.summary) {
        throw new CliError('--project und --summary sind nötig', 2);
      }
      const assigneeId = values.assignee ? await personId(session, values.assignee) : undefined;
      const created = await unwrap(
        client.POST('/api/v1/issues', {
          body: {
            projectKey: values.project.toUpperCase(),
            issueType: values.type ?? 'story',
            summary: values.summary,
            ...(values.description ? { description: { markdown: values.description } } : {}),
            ...(assigneeId ? { assigneeId } : {}),
          } as never,
        }),
      );
      io.out(
        format === 'json'
          ? JSON.stringify(created, null, 2)
          : `${created.key} angelegt: ${session.url}/issues/${created.key}`,
      );
      return;
    }
    case 'edit': {
      const body: Record<string, unknown> = {};
      if (values.summary) body.summary = values.summary;
      if (values.description) body.description = { markdown: values.description };
      if (values.labels !== undefined)
        body.labels = values.labels
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean);
      if (Object.keys(body).length === 0)
        throw new CliError('Nichts zu ändern: --summary, --description oder --labels', 2);
      await unwrap(
        client.PATCH('/api/v1/issues/{key}', {
          params: { path: { key: needKey() } },
          body: body as never,
        }),
      );
      io.out(`${needKey()} geändert.`);
      return;
    }
    case 'move': {
      const target = positionals.slice(1).join(' ').trim().toLowerCase();
      if (!target) throw new CliError('Ziel fehlt, z. B. tl issue move WEB-12 "In Arbeit"', 2);
      const transitions = await unwrap(
        client.GET('/api/v1/issues/{key}/transitions', { params: { path: { key: needKey() } } }),
      );
      const slug = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^a-z0-9äöüß]+/g, '-')
          .replace(/^-|-$/g, '');
      const transition = transitions.find(
        (entry) =>
          entry.name.toLowerCase() === target ||
          entry.to.name.toLowerCase() === target ||
          slug(entry.name) === slug(target) ||
          slug(entry.to.name) === slug(target),
      );
      if (!transition) {
        throw new CliError(
          `Kein Übergang „${target}“. Möglich: ${transitions.map((entry) => entry.to.name).join(', ') || '–'}`,
        );
      }
      const moved = await unwrap(
        client.POST('/api/v1/issues/{key}/transitions', {
          params: { path: { key: needKey() } },
          body: {
            transitionId: transition.id,
            ...(transition.setsResolution ? { resolution: 'done' } : {}),
          },
        }),
      );
      io.out(`${moved.key} → ${moved.status.name}`);
      return;
    }
    case 'comment': {
      const text = positionals.slice(1).join(' ').trim();
      if (!text) throw new CliError('Text fehlt', 2);
      await unwrap(
        client.POST('/api/v1/issues/{key}/comments', {
          params: { path: { key: needKey() } },
          body: { body: { markdown: text } } as never,
        }),
      );
      io.out(`Kommentar an ${needKey()} geschrieben.`);
      return;
    }
    case 'assign': {
      const who = positionals[1];
      if (!who) throw new CliError('Wem? me, none oder eine E-Mail-Adresse', 2);
      const assigneeId = who === 'none' ? null : await personId(session, who);
      await unwrap(
        client.PATCH('/api/v1/issues/{key}', {
          params: { path: { key: needKey() } },
          body: { assigneeId } as never,
        }),
      );
      io.out(`${needKey()} ${assigneeId ? 'zugewiesen' : 'freigegeben'}.`);
      return;
    }
    default:
      throw new CliError(`tl issue ${COMMANDS.issue?.join('|')}`, 2);
  }
}

/** "me", an e-mail address or a name to a person's id. */
async function personId(session: Session, who: string): Promise<string> {
  if (who === 'me') {
    const me = await unwrap(session.client.GET('/api/v1/me'));
    return (me as { id: string }).id;
  }
  const found = await unwrap(
    session.client.GET('/api/v1/users', { params: { query: { query: who } } }),
  );
  const people = found as Array<{ id: string; displayName: string; email?: string }>;
  const exact =
    people.find((person) => person.email?.toLowerCase() === who.toLowerCase()) ??
    (people.length === 1 ? people[0] : undefined);
  if (!exact) throw new CliError(`Keine eindeutige Person „${who}“`);
  return exact.id;
}

// ---------------------------------------------------------------- boards and sprints

async function board(args: string[], io: Io) {
  const [sub, ...rest] = args;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { ...COMMON, project: { type: 'string' }, mine: { type: 'boolean' } },
  });
  const format = formatOf(values.output);
  const { client } = await openSession(io, values.profile);
  if (sub === 'list') {
    const boards = await unwrap(
      client.GET('/api/v1/boards', {
        params: { query: values.project ? { project: values.project.toUpperCase() } : {} },
      }),
    );
    const rows = boards.map((entry) => [entry.id, entry.type, entry.project.key, entry.name]);
    io.out(render(format, ['ID', 'ART', 'PROJEKT', 'NAME'], rows, boards, io.columns));
    return;
  }
  if (sub === 'view') {
    const id = positionals[0];
    if (!id) throw new CliError('Board-ID fehlt (tl board list)', 2);
    const data = await unwrap(
      client.GET('/api/v1/boards/{id}/issues', {
        params: { path: { id }, query: values.mine ? { filters: 'mine' } : {} },
      }),
    );
    if (format === 'json') {
      io.out(JSON.stringify(data, null, 2));
      return;
    }
    const lines = [`# ${data.board.name}${data.sprint ? ` · ${data.sprint.name}` : ''}`];
    for (const column of data.board.columns) {
      const cards = data.issues.filter((entry) => column.statusIds.includes(entry.status.id));
      lines.push('', `## ${column.name} (${cards.length})`);
      for (const card of cards)
        lines.push(
          `- ${card.key} ${card.summary}${card.assignee ? ` · ${card.assignee.displayName}` : ''}`,
        );
    }
    io.out(lines.join('\n'));
    return;
  }
  throw new CliError('tl board list|view', 2);
}

async function sprint(args: string[], io: Io) {
  const [sub, ...rest] = args;
  const { values } = parseArgs({ args: rest, options: { ...COMMON, board: { type: 'string' } } });
  if (sub !== 'list' || !values.board) throw new CliError('tl sprint list --board <id>', 2);
  const format = formatOf(values.output);
  const { client } = await openSession(io, values.profile);
  const backlog = await unwrap(
    client.GET('/api/v1/boards/{id}/backlog', { params: { path: { id: values.board } } }),
  );
  const rows = backlog.sprints.map(({ sprint: entry, issues }) => [
    entry.id,
    entry.state,
    entry.startDate && entry.endDate ? `${entry.startDate} – ${entry.endDate}` : '',
    String(issues.length),
    entry.name,
  ]);
  io.out(
    render(
      format,
      ['ID', 'ZUSTAND', 'ZEITRAUM', 'VORGÄNGE', 'NAME'],
      rows,
      backlog.sprints,
      io.columns,
    ),
  );
}

// ---------------------------------------------------------------- wiki pages

/** The REST API as the folder sync's view of the wiki (D-CLI-03, E-117). */
function wikiPort(session: Session): WikiPort {
  const { client } = session;
  const orNull = async <T>(call: Promise<{ data?: T; error?: unknown; response: Response }>) => {
    const result = await call;
    if (result.response.status === 404) return null;
    return unwrap(Promise.resolve(result));
  };
  return {
    space: (key) => orNull(client.GET('/api/v1/spaces/{key}', { params: { path: { key } } })),
    createSpace: (input) => unwrap(client.POST('/api/v1/spaces', { body: input as never })),
    tree: (key) => unwrap(client.GET('/api/v1/spaces/{key}/pages', { params: { path: { key } } })),
    page: (id) =>
      orNull(
        client.GET('/api/v1/pages/{id}', { params: { path: { id } } }),
      ) as Promise<FolderPage | null>,
    createPage: (key, input) =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/pages', {
          params: { path: { key } },
          body: input as never,
        }),
      ) as Promise<FolderPage>,
    publish: (id, input) =>
      unwrap(
        client.POST('/api/v1/pages/{id}/publish', {
          params: { path: { id } },
          body: input as never,
        }),
      ) as Promise<FolderPage>,
  };
}

const MARKER_LINE = (page: FolderPage) =>
  `<!-- tasklore page=${page.id} version=${page.version} · Schnappschuss aus dem Wiki, Änderungen bitte dort -->\n`;

async function page(args: string[], io: Io) {
  const [sub, ...rest] = args;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      ...COMMON,
      space: { type: 'string' },
      parent: { type: 'string' },
      name: { type: 'string' },
      skip: { type: 'string' },
    },
  });
  const session = await openSession(io, values.profile);
  const wiki = wikiPort(session);
  switch (sub) {
    case 'get': {
      const id = positionals[0];
      if (!id) throw new CliError('Seiten-ID fehlt', 2);
      const found = await unwrap(
        session.client.GET('/api/v1/pages/{id}', {
          params: { path: { id }, query: { format: 'markdown' } },
        }),
      );
      io.out(
        `${MARKER_LINE(found as FolderPage)}# ${found.title}\n\n${typeof found.content === 'string' ? found.content : ''}`.trimEnd(),
      );
      return;
    }
    case 'push': {
      const path = positionals[0];
      if (!path) throw new CliError('Datei fehlt', 2);
      const file = parseMarkdownFile(path, await readFile(path, 'utf8'));
      let target: FolderPage | null;
      if (file.page) {
        target = await wiki.page(file.page.id);
        if (!target) throw new CliError(`Seite ${file.page.id} gibt es nicht (mehr)`);
        if (target.version !== file.page.version) {
          throw new CliError(
            `Die Seite hat sich seit Version ${file.page.version} geändert (jetzt ${target.version}); erst tl page get ${target.id}`,
          );
        }
      } else {
        if (!values.space)
          throw new CliError('Neue Seite: --space <KEY> angeben (und optional --parent <id>)', 2);
        const space = await wiki.space(values.space.toUpperCase());
        if (!space) throw new CliError(`Den Bereich ${values.space.toUpperCase()} gibt es nicht`);
        // Like in the web app, new pages go below the space's home page.
        target = await wiki.createPage(space.key, {
          title: file.title,
          parentId: values.parent ?? space.homePageId,
        });
      }
      const published = await wiki.publish(target.id, {
        title: file.title,
        content: markdownToDoc(file.body),
        comment: 'Aus der Kommandozeile',
      });
      await writeFile(path, MARKER_LINE(published) + file.text);
      io.out(
        `„${published.title}“ veröffentlicht, Version ${published.version}: ${session.url}/spaces/${published.space.key}/pages/${published.id}`,
      );
      return;
    }
    case 'pull': {
      const [space, folder] = positionals;
      if (!space || !folder) throw new CliError('tl page pull <BEREICH> <ordner>', 2);
      const result = await exportFolder(wiki, folder, { spaceKey: space });
      io.out(
        `${result.written.length} geschrieben, ${result.removed.length} entfernt${result.drafts.length ? `, ${result.drafts.length} Entwürfe übersprungen` : ''}.`,
      );
      return;
    }
    case 'push-dir': {
      const folder = positionals[0];
      if (!folder || !values.space)
        throw new CliError('tl page push-dir <ordner> --space <KEY>', 2);
      const result = await importFolder(wiki, folder, {
        spaceKey: values.space,
        ...(values.name ? { spaceName: values.name } : {}),
        skip: values.skip ? values.skip.split(',').map((entry) => entry.trim()) : [],
      });
      io.out(
        `${result.created.length} angelegt, ${result.updated.length} aktualisiert, ${result.unchanged.length} unverändert.`,
      );
      for (const link of result.unresolved) io.err(`Link ohne Ziel: ${link}`);
      return;
    }
    default:
      throw new CliError('tl page get|push|pull|push-dir', 2);
  }
}

// ---------------------------------------------------------------- administration

async function admin(args: string[], io: Io) {
  const [sub, ...rest] = args;
  if (sub === 'backup' || sub === 'restore' || sub === 'import' || sub === 'reindex') {
    // The server features follow in TL-39 (backup, restore) and TL-35 (import).
    throw new CliError(
      `tl admin ${sub} gibt es noch nicht; es kommt mit ${sub === 'import' ? 'TL-35' : 'TL-39'}.`,
      2,
    );
  }
  if (sub !== 'users') throw new CliError('tl admin users', 2);
  const { values } = parseArgs({ args: rest, options: COMMON });
  const format = formatOf(values.output);
  const { client } = await openSession(io, values.profile);
  const users = await unwrap(client.GET('/api/v1/admin/users'));
  const list = users as Array<{
    email: string;
    displayName: string;
    status: string;
    groups: string[];
  }>;
  const rows = list.map((user) => [
    user.email,
    user.status,
    user.groups.join(', '),
    user.displayName,
  ]);
  io.out(render(format, ['E-MAIL', 'ZUSTAND', 'GRUPPEN', 'NAME'], rows, users, io.columns));
}
