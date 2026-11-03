import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runAgents } from './runner.js';
import { CliError, type Io, openSession, type Session, unwrap } from './session.js';

/**
 * The sprint agent (TL-88, E-132): a coding agent such as Claude Code works through the active
 * sprint of one project. `lenipo agent init` writes the setup into the repository, `next` says
 * which issue to take, `ask` puts a question and waits for a human answer. `status` sends a
 * heartbeat and `team` shows who works in the project (TL-93). `claim` and `release` take and give
 * back an issue, with branch and paths as the work area (TL-94). `handover`, `blocked`, `inbox` and
 * `watch` are the messages between people and agents (TL-95); `review-request`, `reviews` and
 * `review` the code review between them (TL-97).
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

export const CONFIG = join('.lenipo', 'agent.json');
export const PROMPT = join('.lenipo', 'agent-prompt.md');

const COMMON = {
  profile: { type: 'string' },
  dir: { type: 'string' },
} as const;

export async function readAgentConfig(dir: string): Promise<AgentConfig> {
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
    case 'handover':
      return handover(rest, io);
    case 'blocked':
      return blocked(rest, io);
    case 'inbox':
      return inbox(rest, io);
    case 'watch':
      return watch(rest, io);
    case 'review-request':
      return reviewRequest(rest, io);
    case 'reviews':
      return reviews(rest, io);
    case 'review':
      return review(rest, io);
    case 'usage':
      return usage(rest, io);
    case 'run': {
      const { values } = parseArgs({
        args: rest,
        options: {
          dir: { type: 'string' },
          once: { type: 'boolean' },
          every: { type: 'string' },
          listen: { type: 'string' },
          'dry-run': { type: 'boolean' },
        },
      });
      return runAgents(values, io);
    }
    default:
      throw new CliError(
        'lenipo agent init|next|ask|status|team|claim|release|handover|blocked|inbox|watch|review-request|reviews|review|usage|run',
        2,
      );
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
  // A starting point for `lenipo agent run` (TL-99); tokens stay in the CLI profiles.
  const runner = join(dir, '.lenipo', 'runner.json');
  if (!existsSync(runner)) {
    await writeFile(
      runner,
      `${JSON.stringify(
        {
          base: 'main',
          every: 15,
          agents: [{ name: 'claude', adapter: 'claude-code', profile: 'claude', slots: 1 }],
        },
        null,
        2,
      )}\n`,
    );
  }
  io.out(
    `Geschrieben: ${CONFIG}, ${PROMPT} und .lenipo/runner.json (Projekt ${project}, Board ${board}).\n` +
      `Starten: lenipo agent run (Agenten in .lenipo/runner.json, Tokens per lenipo login --profile <Name> --token …)`,
  );
}

/** The loop's instructions for the coding agent (E-132): rules, guard rails, how to finish. */
function prompt(config: AgentConfig): string {
  return `# Sprint-Agent für ${config.project}

Du arbeitest selbstständig Aufgaben aus dem aktiven Sprint des Lenipo-Projekts ${config.project} ab. Lenipo erreichst du über die Kommandozeile \`lenipo\` und die MCP-Werkzeuge von Lenipo.

## Ablauf je Durchgang

1. \`lenipo agent next --output json\` ausführen. Ist \`task\` leer, ist nichts zu tun: \`lenipo agent status offline\` und Durchgang beenden. Steht dort \`stop\` (\`paused\`: ein Mensch hat dich angehalten; \`budget\`: das Budget ist verbraucht), ebenso beenden und nichts Neues anfangen.
2. Den Vorgang vollständig lesen: \`lenipo issue view <KEY> --comments\` (Beschreibung, Kommentare, Entscheidungen).
3. Ist \`answered\` wahr, das Label \`${config.questionLabel}\` entfernen (\`lenipo issue edit <KEY> --labels …\` ohne das Label) und die Antwort beachten.
4. Ist etwas unklar oder fehlt eine Entscheidung: \`lenipo agent ask <KEY> "<Frage>"\` (meldet dich als wartend) und Durchgang beenden. Nicht raten.
5. Sonst umsetzen:
   - eigener Branch \`agent/<KEY>-<kurzer-name>\`, nie direkt auf main
   - den Vorgang beanspruchen: \`lenipo agent claim <KEY> --branch <Branch> --path <Ordner> …\` mit den Ordnern oder Dateien, die du ändern wirst. Scheitert das (jemand anderes arbeitet daran oder in denselben Dateien), den Vorgang nicht anfassen und den Durchgang beenden
   - \`lenipo agent status active --issue <KEY> --branch <Branch>\` melden und bei längerer Arbeit alle 15 Minuten wiederholen; das hält auch den Anspruch
   - kommst du nicht weiter: \`lenipo agent blocked <KEY> --note "<Grund>" [--by <blockierender Vorgang>]\` und Durchgang beenden
   - Tests und Prüfungen des Repositorys laufen lassen; erst bei Erfolg pushen
   - Pull Request öffnen (den Vorgangsschlüssel in Titel oder Branch, damit Lenipo ihn verknüpft)
   - Review anfordern: \`lenipo agent review-request <KEY>\` (Lenipo wählt einen Reviewer, bevorzugt eines anderen Herstellers)
   - Vorgang in den Status für Review verschieben (\`lenipo issue move <KEY> Review\`)
   - Übergabe schreiben: \`lenipo agent handover <KEY> --done "<Zusammenfassung, Entscheidungen, Link zum Pull Request>" --open "<was noch fehlt>"\`; das beendet auch deinen Anspruch. Soll jemand Bestimmtes weitermachen, mit \`--to <E-Mail>\`
   - ist die Umgebungsvariable \`LENIPO_COST_REPORTED\` nicht gesetzt und kennst du die Kosten des Laufs: \`lenipo agent usage --cost <Betrag>\`
   - \`lenipo agent status offline\`
6. Mit \`lenipo agent inbox\` nachsehen, ob dich jemand erwähnt hat, und antworten (\`lenipo issue comment\`); erledigte mit \`--read\` als gelesen markieren.

## Leitplanken

- Nur Vorgänge, die \`lenipo agent next\` nennt (Label \`${config.label}\` oder dem Agenten-Konto zugewiesen, im aktiven Sprint).
- Höchstens drei Versuche je Vorgang; danach mit \`lenipo agent ask\` um Hilfe bitten.
- Antwortet Lenipo mit 423 (angehalten), sofort aufhören. Antwortet ein Statuswechsel mit „wartet auf Freigabe“, entscheidet ein Mensch; nicht erneut versuchen.
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
  // A paused agent stops; with the budget used up it only finishes its own work (TL-98).
  const guard = await guardrails(session);
  if (guard?.paused) {
    const reason = guard.paused.reason;
    if (values.output === 'json') {
      io.out(JSON.stringify({ task: null, stop: 'paused', reason }, null, 2));
    } else {
      io.out(`Angehalten${reason ? `: ${reason}` : ''}. Nichts Neues anfangen.`);
    }
    return;
  }
  const exceeded = guard?.exceeded ?? [];
  const task = await nextTask(session, config, { ownOnly: exceeded.length > 0 });
  if (values.output === 'json') {
    io.out(
      JSON.stringify(
        task || exceeded.length === 0 ? { task } : { task: null, stop: 'budget', exceeded },
        null,
        2,
      ),
    );
    return;
  }
  if (!task && exceeded.length > 0) {
    io.out(`Budget verbraucht (${exceeded.join(', ')}). Nichts Neues anfangen.`);
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
export async function nextTask(
  session: Session,
  config: AgentConfig,
  options: { ownOnly?: boolean; exclude?: Set<string> } = {},
): Promise<AgentTask | null> {
  const { client } = session;
  const me = await unwrap(client.GET('/api/v1/me'));
  const backlog = await unwrap(
    client.GET('/api/v1/boards/{id}/backlog', { params: { path: { id: config.board } } }),
  );
  const active = backlog.sprints.find((entry) => entry.sprint.state === 'active');
  if (!active) return null;
  for (const issue of active.issues) {
    if (issue.status.category === 'done' || options.exclude?.has(issue.key)) continue;
    const mine = options.ownOnly
      ? issue.assignee?.id === me.id
      : issue.labels.includes(config.label) || issue.assignee?.id === me.id;
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

/** Pause and budget of an agent; null for people, who have neither. */
async function guardrails(session: Session) {
  const { data, response } = await session.client.GET('/api/v1/me/usage');
  if (response.status === 404) return null;
  return data ?? null;
}

/** Budget use, and with `--cost` the report of a run's cost (TL-98). */
async function usage(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: { ...COMMON, cost: { type: 'string' }, output: { type: 'string', short: 'o' } },
  });
  const { client } = await openSession(io, values.profile);
  let used: Awaited<ReturnType<typeof guardrails>>;
  if (values.cost !== undefined) {
    const cost = Number(values.cost.replace(',', '.'));
    if (!Number.isFinite(cost) || cost < 0) throw new CliError('--cost erwartet einen Betrag', 2);
    used = await unwrap(client.POST('/api/v1/me/usage', { body: { cost } }));
  } else {
    used = await unwrap(client.GET('/api/v1/me/usage'));
  }
  if (!used) return;
  if (values.output === 'json') {
    io.out(JSON.stringify({ usage: used }, null, 2));
    return;
  }
  const limit = (value: number | null) => (value === null ? '' : ` von ${value}`);
  const line = (label: string, period: 'day' | 'month') =>
    `${label}: ${used[period].issues}${limit(used.budget[period].issues)} Vorgänge, ${used[period].minutes}${limit(used.budget[period].minutes)} Minuten, Kosten ${used[period].cost}${limit(used.budget[period].cost)}`;
  io.out(
    [
      line('Heute', 'day'),
      line('Monat', 'month'),
      ...(used.exceeded.length > 0 ? [`Verbraucht: ${used.exceeded.join(', ')}`] : []),
      ...(used.paused ? [`Angehalten${used.paused.reason ? `: ${used.paused.reason}` : ''}`] : []),
    ].join('\n'),
  );
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

/** A handover: done, open and notes as one comment; `--to` takes over assignee and claim (TL-95). */
async function handover(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ...COMMON,
      done: { type: 'string' },
      open: { type: 'string' },
      notes: { type: 'string' },
      to: { type: 'string' },
    },
    allowPositionals: true,
  });
  const key = positionals[0]?.toUpperCase();
  if (!key || !values.done) {
    throw new CliError(
      'lenipo agent handover <KEY> --done <Text> [--open <Text>] [--notes <Text>] [--to <E-Mail|Id>]',
      2,
    );
  }
  const { client } = await openSession(io, values.profile);
  await unwrap(
    client.POST('/api/v1/issues/{key}/handover', {
      params: { path: { key } },
      body: {
        done: values.done,
        open: values.open ?? '',
        notes: values.notes ?? '',
        ...(values.to ? { to: values.to } : {}),
      },
    }),
  );
  io.out(`${key}: übergeben${values.to ? ` an ${values.to}` : ''}.`);
}

/** Reports a blocker: link, comment and the blocked state (TL-95). */
async function blocked(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: { ...COMMON, by: { type: 'string' }, note: { type: 'string' } },
    allowPositionals: true,
  });
  const key = positionals[0]?.toUpperCase();
  if (!key || !values.note) {
    throw new CliError('lenipo agent blocked <KEY> --note <Text> [--by <KEY>]', 2);
  }
  const { client } = await openSession(io, values.profile);
  await unwrap(
    client.POST('/api/v1/issues/{key}/blocker', {
      params: { path: { key } },
      body: { note: values.note, ...(values.by ? { blockedBy: values.by.toUpperCase() } : {}) },
    }),
  );
  io.out(
    `${key}: als blockiert gemeldet${values.by ? ` (durch ${values.by.toUpperCase()})` : ''}.`,
  );
}

/** Unread notifications: mentions, assignments, comments (TL-95). */
async function inbox(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: { ...COMMON, output: { type: 'string', short: 'o' }, read: { type: 'boolean' } },
  });
  const { client } = await openSession(io, values.profile);
  const list = await unwrap(
    client.GET('/api/v1/me/notifications', { params: { query: { unread: 'true', limit: 50 } } }),
  );
  if (values.read && list.notifications.length > 0) {
    await unwrap(
      client.POST('/api/v1/me/notifications/read', {
        body: { ids: list.notifications.map((entry) => entry.id) },
      }),
    );
  }
  if (values.output === 'json') {
    io.out(JSON.stringify({ notifications: list.notifications }, null, 2));
    return;
  }
  io.out(
    list.notifications
      .map(
        (entry) =>
          `${entry.issue?.key ?? entry.page?.title ?? ''} · ${entry.category} · ${entry.actor?.displayName ?? ''}`,
      )
      .join('\n') || 'Nichts Neues.',
  );
}

/**
 * Prints each new notification as one JSON line as soon as it comes, from the event stream
 * (Server-Sent Events); reconnects with the last id after a break (TL-95).
 */
async function watch(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: COMMON });
  const session = await openSession(io, values.profile);
  await streamEvents(session, (data) => io.out(data));
}

/**
 * Follows the event stream of the caller (TL-95), resuming after breaks where it stopped; runs
 * until the signal aborts it.
 */
export async function streamEvents(
  session: Session,
  onEvent: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let last: string | undefined;
  while (!signal?.aborted) {
    try {
      const response = await session.authorizedFetch(`${session.url}/api/v1/me/events`, {
        headers: { accept: 'text/event-stream', ...(last ? { 'last-event-id': last } : {}) },
        signal,
      });
      if (!response.ok || !response.body) {
        throw new CliError(`${response.status}: Ereignisse nicht verfügbar`);
      }
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let end = buffer.indexOf('\n\n');
        while (end >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const id = /^id: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (id) last = id;
          if (data) onEvent(data);
          end = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error instanceof CliError) throw error;
      if (signal?.aborted) return;
    }
    // The stream ended (restart, proxy): wait a moment and pick up where it broke.
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/** Asks for a review; without --reviewer Lenipo picks one (TL-97). */
async function reviewRequest(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: { ...COMMON, reviewer: { type: 'string' } },
    allowPositionals: true,
  });
  const key = positionals[0]?.toUpperCase();
  if (!key) throw new CliError('lenipo agent review-request <KEY> [--reviewer <E-Mail|Id>]', 2);
  const { client } = await openSession(io, values.profile);
  const asked = await unwrap(
    client.POST('/api/v1/issues/{key}/reviews', {
      params: { path: { key } },
      body: values.reviewer ? { reviewer: values.reviewer } : {},
    }),
  );
  io.out(`${key}: Review angefragt bei ${asked.reviewer.displayName}.`);
}

/** Reviews waiting for the caller, with their pull requests (TL-97). */
async function reviews(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    options: { ...COMMON, output: { type: 'string', short: 'o' } },
  });
  const { client } = await openSession(io, values.profile);
  const queue = await unwrap(client.GET('/api/v1/me/reviews'));
  if (values.output === 'json') {
    io.out(JSON.stringify({ reviews: queue }, null, 2));
    return;
  }
  io.out(
    queue
      .map(
        (entry) =>
          `${entry.issue.key} · ${entry.issue.summary} · von ${entry.requester.displayName}${entry.pullRequest?.url ? `\n  ${entry.pullRequest.url}` : ''}`,
      )
      .join('\n') || 'Keine Reviews offen.',
  );
}

/** The verdict on a waiting review, by issue key or review id (TL-97). */
async function review(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ...COMMON,
      approve: { type: 'boolean' },
      changes: { type: 'boolean' },
      body: { type: 'string' },
    },
    allowPositionals: true,
  });
  const target = positionals[0];
  if (!target || !values.body || values.approve === values.changes) {
    throw new CliError('lenipo agent review <KEY|Id> --approve|--changes --body <Text>', 2);
  }
  const { client } = await openSession(io, values.profile);
  let id = target;
  if (!/^[0-9a-f-]{36}$/i.test(target)) {
    const queue = await unwrap(client.GET('/api/v1/me/reviews'));
    const match = queue.find((entry) => entry.issue.key === target.toUpperCase());
    if (!match) throw new CliError(`Kein offenes Review für ${target.toUpperCase()}.`, 1);
    id = match.id;
  }
  const decided = await unwrap(
    client.POST('/api/v1/reviews/{id}/verdict', {
      params: { path: { id } },
      body: { verdict: values.approve ? 'approved' : 'changes_requested', body: values.body },
    }),
  );
  io.out(`${decided.issue.key}: ${values.approve ? 'freigegeben' : 'Änderungen nötig'}.`);
}
