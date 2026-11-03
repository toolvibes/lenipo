import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CliError, type Io, openSession, type Session, unwrap } from './session.js';

/**
 * The sprint agent (TL-88, E-132): a coding agent such as Claude Code works through the active
 * sprint of one project. `lenipo agent init` writes the setup into the repository, `next` says
 * which issue to take, `ask` puts a question and waits for a human answer. `status` sends a
 * heartbeat and `team` shows who works in the project (TL-93). `claim` and `release` take and give
 * back an issue, with branch and paths as the work area (TL-94).
 */

/** What `.lenipo/agent.json` holds; the instance comes from the profile or LENIPO_URL. */
export interface AgentConfig {
  project: string;
  board: string;
  /** Issues with this label are the agent's, besides those assigned to its account. */
  label: string;
  /** Set while the agent waits for an answer. */
  questionLabel: string;
}

export interface AgentTask {
  key: string;
  summary: string;
  status: string;
  url: string;
  /** A human answered the agent's question; the agent takes the label off and goes on. */
  answered: boolean;
}

const CONFIG = join('.lenipo', 'agent.json');
const PROMPT = join('.lenipo', 'agent-prompt.md');

const COMMON = {
  profile: { type: 'string' },
  dir: { type: 'string' },
} as const;

async function readAgentConfig(dir: string): Promise<AgentConfig> {
  try {
    return JSON.parse(await readFile(join(dir, CONFIG), 'utf8')) as AgentConfig;
  } catch {
    throw new CliError(`Keine ${CONFIG} gefunden. Erst „lenipo agent init --project <KEY>“.`, 2);
  }
}

export async function agent(args: string[], io: Io): Promise<void> {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'init':
      return init(rest, io);
    case 'next':
      return next(rest, io);
    case 'ask':
      return ask(rest, io);
    case 'status':
      return status(rest, io);
    case 'team':
      return team(rest, io);
    case 'claim':
      return claim(rest, io);
    case 'release':
      return release(rest, io);
    default:
      throw new CliError('lenipo agent init|next|ask|status|team|claim|release', 2);
  }
}

async function init(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: {
      ...COMMON,
      project: { type: 'string' },
      board: { type: 'string' },
      label: { type: 'string', default: 'agent' },
      'question-label': { type: 'string', default: 'agent-question' },
    },
  });
  if (!values.project) throw new CliError('lenipo agent init --project <KEY> [--board <id>]', 2);
  const session = await openSession(io, values.profile);
  const project = values.project.toUpperCase();
  let board = values.board;
  if (!board) {
    const boards = await unwrap(
      session.client.GET('/api/v1/boards', { params: { query: { project } } }),
    );
    // A Scrum board, as sprints live there; otherwise the first one.
    const chosen = boards.find((entry) => entry.type === 'scrum') ?? boards[0];
    if (!chosen) throw new CliError(`Das Projekt ${project} hat kein Board.`, 1);
    board = chosen.id;
  }
  const config: AgentConfig = {
    project,
    board,
    label: values.label ?? 'agent',
    questionLabel: values['question-label'] ?? 'agent-question',
  };
  const dir = values.dir ?? process.cwd();
  await mkdir(join(dir, '.lenipo'), { recursive: true });
  await writeFile(join(dir, CONFIG), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(join(dir, PROMPT), prompt(config));
  io.out(
    `Geschrieben: ${CONFIG} und ${PROMPT} (Projekt ${project}, Board ${board}).\n` +
      `Starten, z. B. in Claude Code: /loop 15m mit dem Inhalt von ${PROMPT}`,
  );
}

/** The loop's instructions for the coding agent (E-132): rules, guard rails, how to finish. */
function prompt(config: AgentConfig): string {
  return `# Sprint-Agent für ${config.project}

Du arbeitest selbstständig Aufgaben aus dem aktiven Sprint des Lenipo-Projekts ${config.project} ab. Lenipo erreichst du über die Kommandozeile \`lenipo\` und die MCP-Werkzeuge von Lenipo.

## Ablauf je Durchgang

1. \`lenipo agent next --output json\` ausführen. Ist \`task\` leer, ist nichts zu tun: \`lenipo agent status offline\` und Durchgang beenden.
2. Den Vorgang vollständig lesen: \`lenipo issue view <KEY> --comments\` (Beschreibung, Kommentare, Entscheidungen).
3. Ist \`answered\` wahr, das Label \`${config.questionLabel}\` entfernen (\`lenipo issue edit <KEY> --labels …\` ohne das Label) und die Antwort beachten.
4. Ist etwas unklar oder fehlt eine Entscheidung: \`lenipo agent ask <KEY> "<Frage>"\` (meldet dich als wartend) und Durchgang beenden. Nicht raten.
5. Sonst umsetzen:
   - eigener Branch \`agent/<KEY>-<kurzer-name>\`, nie direkt auf main
   - den Vorgang beanspruchen: \`lenipo agent claim <KEY> --branch <Branch> --path <Ordner> …\` mit den Ordnern oder Dateien, die du ändern wirst. Scheitert das (jemand anderes arbeitet daran oder in denselben Dateien), den Vorgang nicht anfassen und den Durchgang beenden
   - \`lenipo agent status active --issue <KEY> --branch <Branch>\` melden und bei längerer Arbeit alle 15 Minuten wiederholen; das hält auch den Anspruch
   - kommst du nicht weiter: \`lenipo agent status blocked --issue <KEY> --note "<Grund>"\`
   - Tests und Prüfungen des Repositorys laufen lassen; erst bei Erfolg pushen
   - Pull Request öffnen
   - Kommentar am Vorgang mit Zusammenfassung, getroffenen Entscheidungen und Link zum Pull Request
   - Vorgang in den Status für Review verschieben (\`lenipo issue move <KEY> Review\`)
   - \`lenipo agent release <KEY>\` und \`lenipo agent status offline\`

## Leitplanken

- Nur Vorgänge, die \`lenipo agent next\` nennt (Label \`${config.label}\` oder dem Agenten-Konto zugewiesen, im aktiven Sprint).
- Höchstens drei Versuche je Vorgang; danach mit \`lenipo agent ask\` um Hilfe bitten.
- Keine Geheimnisse in Kommentare, Commits oder Pull Requests.
- Entscheidungen immer im Kommentar festhalten.
`;
}

async function next(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: { ...COMMON, output: { type: 'string', short: 'o' } },
  });
  const config = await readAgentConfig(values.dir ?? process.cwd());
  const session = await openSession(io, values.profile);
  const task = await nextTask(session, config);
  if (values.output === 'json') {
    io.out(JSON.stringify({ task }, null, 2));
    return;
  }
  io.out(
    task
      ? `${task.key} · ${task.status} · ${task.summary}${task.answered ? ' (Rückfrage beantwortet)' : ''}\n${task.url}`
      : 'Nichts zu tun: kein offener Vorgang für den Agenten im aktiven Sprint.',
  );
}

/**
 * The first open issue of the active sprint, in rank order, that is the agent's: labelled or
 * assigned to it. One waiting for an answer counts once a human commented after the question.
 */
export async function nextTask(session: Session, config: AgentConfig): Promise<AgentTask | null> {
  const { client } = session;
  const me = await unwrap(client.GET('/api/v1/me'));
  const backlog = await unwrap(
    client.GET('/api/v1/boards/{id}/backlog', { params: { path: { id: config.board } } }),
  );
  const active = backlog.sprints.find((entry) => entry.sprint.state === 'active');
  if (!active) return null;
  for (const issue of active.issues) {
    if (issue.status.category === 'done') continue;
    const mine = issue.labels.includes(config.label) || issue.assignee?.id === me.id;
    // Taken by someone else, e.g. another agent's claim (TL-94).
    if (!mine || (issue.assignee && issue.assignee.id !== me.id)) continue;
    let answered = false;
    if (issue.labels.includes(config.questionLabel)) {
      const comments = await unwrap(
        client.GET('/api/v1/issues/{key}/comments', { params: { path: { key: issue.key } } }),
      );
      const lastOwn = comments.findLastIndex((comment) => comment.author?.id === me.id);
      answered = comments.slice(lastOwn + 1).some((comment) => comment.author?.id !== me.id);
      if (!answered) continue;
    }
    return {
      key: issue.key,
      summary: issue.summary,
      status: issue.status.name,
      url: `${session.url}/issues/${issue.key}`,
      answered,
    };
  }
  return null;
}

async function ask(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, options: COMMON, allowPositionals: true });
  const [key, ...words] = positionals;
  const text = words.join(' ').trim();
  if (!key || !text) throw new CliError('lenipo agent ask <KEY> <Frage>', 2);
  const config = await readAgentConfig(values.dir ?? process.cwd());
  const { client } = await openSession(io, values.profile);
  const upper = key.toUpperCase();
  await unwrap(
    client.POST('/api/v1/issues/{key}/comments', {
      params: { path: { key: upper } },
      body: { body: { markdown: `**Rückfrage des Agenten:** ${text}` } },
    }),
  );
  const issue = await unwrap(
    client.GET('/api/v1/issues/{key}', { params: { path: { key: upper } } }),
  );
  if (!issue.labels.includes(config.questionLabel)) {
    await unwrap(
      client.PATCH('/api/v1/issues/{key}', {
        params: { path: { key: upper } },
        body: { labels: [...issue.labels, config.questionLabel] },
      }),
    );
  }
  await unwrap(
    client.PUT('/api/v1/me/presence', {
      body: { state: 'waiting', issueKey: upper, note: 'Rückfrage gestellt' },
    }),
  );
  io.out(`${upper}: Rückfrage gestellt; der Agent wartet auf eine Antwort.`);
}

const STATES = ['active', 'waiting', 'blocked', 'offline'] as const;
type State = (typeof STATES)[number];

/** A heartbeat: state, and issue, branch and note if given (TL-93). */
async function status(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ...COMMON,
      issue: { type: 'string' },
      branch: { type: 'string' },
      note: { type: 'string' },
    },
    allowPositionals: true,
  });
  const state = positionals[0] as State | undefined;
  if (!state || !STATES.includes(state)) {
    throw new CliError(
      'lenipo agent status active|waiting|blocked|offline [--issue <KEY>] [--branch <Name>] [--note <Text>]',
      2,
    );
  }
  const { client } = await openSession(io, values.profile);
  // Going offline ends the work on the issue.
  const offline = state === 'offline';
  const now = await unwrap(
    client.PUT('/api/v1/me/presence', {
      body: {
        state,
        ...(values.issue
          ? { issueKey: values.issue.toUpperCase() }
          : offline
            ? { issueKey: null }
            : {}),
        ...(values.branch ? { branch: values.branch } : offline ? { branch: null } : {}),
        ...(values.note !== undefined ? { note: values.note } : offline ? { note: '' } : {}),
      },
    }),
  );
  io.out(
    `Status: ${now.state}${now.issue ? ` · ${now.issue.key}` : ''}${now.branch ? ` · ${now.branch}` : ''}`,
  );
}

const STATE_LABELS: Record<State, string> = {
  active: 'aktiv',
  waiting: 'wartet',
  blocked: 'blockiert',
  offline: 'offline',
};

/** Who works in the agent's project (TL-93), so two agents do not take the same issue. */
async function team(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: { ...COMMON, project: { type: 'string' }, output: { type: 'string', short: 'o' } },
  });
  const project =
    values.project?.toUpperCase() ?? (await readAgentConfig(values.dir ?? process.cwd())).project;
  const { client } = await openSession(io, values.profile);
  const members = await unwrap(
    client.GET('/api/v1/projects/{key}/team', { params: { path: { key: project } } }),
  );
  if (values.output === 'json') {
    io.out(JSON.stringify({ team: members }, null, 2));
    return;
  }
  io.out(
    members
      .map((member) => {
        const work = [member.issue?.key, member.branch, member.note].filter(Boolean).join(' · ');
        return `${member.user.displayName}${member.agent ? ' (Agent)' : ''}: ${STATE_LABELS[member.state]}${work ? ` – ${work}` : ''}`;
      })
      .join('\n') || 'Niemand hat zuletzt in diesem Projekt gearbeitet.',
  );
}

/** Claims an issue, or with no key the next fitting one of the project (TL-94). */
async function claim(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ...COMMON,
      branch: { type: 'string' },
      path: { type: 'string', multiple: true },
      force: { type: 'boolean' },
      filter: { type: 'string' },
      project: { type: 'string' },
      output: { type: 'string', short: 'o' },
    },
    allowPositionals: true,
  });
  const { client } = await openSession(io, values.profile);
  const body = {
    ...(values.branch ? { branch: values.branch } : {}),
    paths: values.path ?? [],
    force: values.force ?? false,
  };
  const key = positionals[0]?.toUpperCase();
  const claimed = key
    ? await unwrap(client.POST('/api/v1/issues/{key}/claim', { params: { path: { key } }, body }))
    : (
        await unwrap(
          client.POST('/api/v1/projects/{key}/claim-next', {
            params: {
              path: {
                key:
                  values.project?.toUpperCase() ??
                  (
                    await readAgentConfig(values.dir ?? process.cwd())
                  ).project,
              },
            },
            body: { ...body, ...(values.filter ? { filter: values.filter } : {}) },
          }),
        )
      ).claim;
  if (values.output === 'json') {
    io.out(JSON.stringify({ claim: claimed }, null, 2));
    return;
  }
  io.out(
    claimed
      ? `${claimed.issue.key} · ${claimed.issue.summary} – beansprucht bis ${new Date(claimed.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${claimed.forced ? ' (trotz Überschneidung)' : ''}`
      : 'Kein passender Vorgang frei.',
  );
}

async function release(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, options: COMMON, allowPositionals: true });
  const key = positionals[0]?.toUpperCase();
  if (!key) throw new CliError('lenipo agent release <KEY>', 2);
  const { client } = await openSession(io, values.profile);
  await unwrap(client.DELETE('/api/v1/issues/{key}/claim', { params: { path: { key } } }));
  io.out(`${key}: freigegeben.`);
}
