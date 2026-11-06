import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { type AgentConfig, nextTask, PROMPT, readAgentConfig, streamEvents } from './agent.js';
import { CliError, type Io, openSession, type Session, unwrap } from './session.js';

/**
 * The runner for several agents (TL-99, E-151): `lenipo agent run` starts coding agents such as
 * Claude Code, Codex CLI or Gemini CLI when there is work for them, each in its own git worktree.
 * It wakes up on a schedule, on the agents' event streams and, with `--listen`, on their
 * webhooks. Tokens never sit in the repository: they come from CLI profiles or the environment.
 */

const RUNNER = join('.lenipo', 'runner.json');
const ADAPTERS = ['claude-code', 'codex', 'gemini', 'command'] as const;
type Adapter = (typeof ADAPTERS)[number];
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export interface RunnerAgent {
  /** Short name: folder of its worktrees and runs, path of its webhook. */
  name: string;
  adapter: Adapter;
  /** The CLI profile holding the agent's token (`lenipo login --profile <name> --token …`). */
  profile?: string;
  /** Or an environment variable with the token; the address then comes from LENIPO_URL. */
  tokenEnv?: string;
  /** Worktrees, i.e. issues this agent works on at the same time. */
  slots?: number;
  /** Extra arguments for the presets, e.g. `["--permission-mode", "acceptEdits"]`. */
  args?: string[];
  /** For `command`: the program and its arguments, `{prompt}` stands for the prompt. */
  command?: string[];
  timeoutMinutes?: number;
  /** Environment variable with the secret of the agent's webhook, for `--listen`. */
  webhookSecretEnv?: string;
}

export interface RunnerConfig {
  /** The branch new worktrees start from. */
  base?: string;
  /** Minutes between scheduled checks. */
  every?: number;
  agents: RunnerAgent[];
}

const run = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

async function readRunnerConfig(root: string): Promise<RunnerConfig> {
  let parsed: RunnerConfig;
  try {
    parsed = JSON.parse(await readFile(join(root, RUNNER), 'utf8')) as RunnerConfig;
  } catch {
    throw new CliError(
      `Keine ${RUNNER} gefunden. Beispiel: {"agents": [{"name": "claude", "adapter": "claude-code", "profile": "claude"}]}`,
      2,
    );
  }
  const names = new Set<string>();
  for (const agent of parsed.agents ?? []) {
    if (!NAME.test(agent.name ?? '') || names.has(agent.name)) {
      throw new CliError(`${RUNNER}: Name „${agent.name}“ fehlt, ist doppelt oder ungültig`, 2);
    }
    names.add(agent.name);
    if (!ADAPTERS.includes(agent.adapter)) {
      throw new CliError(
        `${RUNNER}: Adapter von ${agent.name} ist einer von ${ADAPTERS.join(', ')}`,
        2,
      );
    }
    if (agent.adapter === 'command' && !agent.command?.length) {
      throw new CliError(`${RUNNER}: ${agent.name} braucht "command"`, 2);
    }
  }
  if (names.size === 0) throw new CliError(`${RUNNER}: keine Agenten eingetragen`, 2);
  return parsed;
}

/** The command line of one run; Claude Code answers in JSON with what the run cost. */
export function commandLine(agent: RunnerAgent, prompt: string): string[] {
  const extra = agent.args ?? [];
  switch (agent.adapter) {
    case 'claude-code':
      return ['claude', '-p', prompt, '--output-format', 'json', ...extra];
    case 'codex':
      return ['codex', 'exec', ...extra, prompt];
    case 'gemini':
      return ['gemini', ...extra, '-p', prompt];
    case 'command':
      return (agent.command ?? []).map((part) => part.replaceAll('{prompt}', prompt));
  }
}

/** `total_cost_usd` from the JSON of Claude Code; null for other output. */
export function costOf(output: string): number | null {
  const last = output.trim().split('\n').at(-1);
  if (!last?.startsWith('{')) return null;
  try {
    const cost = (JSON.parse(last) as { total_cost_usd?: unknown }).total_cost_usd;
    return typeof cost === 'number' && cost >= 0 ? cost : null;
  } catch {
    return null;
  }
}

/** Standard Webhooks: `v1,` + base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>")). */
export function verifySignature(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  body: string,
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface Running {
  child: ChildProcess;
  key: string | null;
}

class Runner {
  private readonly sessions = new Map<string, Session>();
  private readonly busy = new Map<string, Map<number, Running>>();
  private readonly pending = new Set<string>();
  /** Issue keys a slot works on, so no two slots start the same. */
  private readonly taken = new Set<string>();
  /** The newest notification each agent was started for. */
  private readonly seen = new Map<string, number>();
  private readonly runs = new Set<Promise<void>>();
  /** One fill per agent at a time, so two triggers never pick the same slot. */
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly io: Io,
    private readonly root: string,
    private readonly config: RunnerConfig,
    private readonly agentConfig: AgentConfig,
    private readonly prompt: string,
    private readonly dryRun: boolean,
  ) {}

  async session(agent: RunnerAgent): Promise<Session> {
    const known = this.sessions.get(agent.name);
    if (known) return known;
    let session: Session;
    if (agent.tokenEnv) {
      const token = this.io.env[agent.tokenEnv];
      const url = this.io.env.LENIPO_URL;
      if (!token || !url) {
        throw new CliError(
          `${agent.name}: ${agent.tokenEnv} und LENIPO_URL müssen gesetzt sein`,
          2,
        );
      }
      session = await openSession(
        { ...this.io, env: { LENIPO_URL: url, LENIPO_TOKEN: token } },
        undefined,
      );
    } else {
      // The runner's own LENIPO_URL/LENIPO_TOKEN must not stand in for the agent's profile.
      const env = Object.fromEntries(
        Object.entries(this.io.env).filter(([name]) => !/^LENIPO_(URL|TOKEN)$/.test(name)),
      );
      session = await openSession({ ...this.io, env }, agent.profile);
    }
    this.sessions.set(agent.name, session);
    return session;
  }

  /** Starts as many slots as there is work for; a trigger while all are busy is kept. */
  trigger(agent: RunnerAgent, reason: string): void {
    const previous = this.locks.get(agent.name) ?? Promise.resolve();
    const promise = previous
      .then(() => this.fill(agent, reason))
      .catch((error: unknown) =>
        this.log(agent, `Fehler: ${error instanceof Error ? error.message : String(error)}`),
      );
    this.locks.set(agent.name, promise);
    this.runs.add(promise);
    void promise.finally(() => this.runs.delete(promise));
  }

  async idle(): Promise<void> {
    while (this.runs.size > 0) await Promise.all([...this.runs]);
  }

  stop(): void {
    for (const slots of this.busy.values()) {
      for (const { child } of slots.values()) child.kill('SIGTERM');
    }
  }

  private log(agent: RunnerAgent, text: string) {
    this.io.err(`[${new Date().toISOString().slice(11, 19)}] ${agent.name}: ${text}`);
  }

  private async fill(agent: RunnerAgent, reason: string): Promise<void> {
    const slots = this.busy.get(agent.name) ?? new Map<number, Running>();
    this.busy.set(agent.name, slots);
    const total = Math.max(1, agent.slots ?? 1);
    if (slots.size >= total) {
      this.pending.add(agent.name);
      return;
    }
    const session = await this.session(agent);
    // A paused agent or a used-up budget starts nothing (TL-98).
    const { data: usage } = await session.client.GET('/api/v1/me/usage');
    if (usage?.paused) {
      this.log(agent, `angehalten${usage.paused.reason ? `: ${usage.paused.reason}` : ''}`);
      return;
    }
    const ownOnly = (usage?.exceeded.length ?? 0) > 0;
    // Started in this pass: a quick run may already have ended and freed its issue.
    const started = new Set<string>();
    for (let slot = 1; slot <= total; slot += 1) {
      if (slots.has(slot)) continue;
      const task = await nextTask(session, this.agentConfig, {
        ownOnly,
        exclude: new Set([...this.taken, ...started]),
      });
      if (task) started.add(task.key);
      let inbox = false;
      if (!task) {
        // Without an issue, new notifications are worth one run, once.
        const list = await unwrap(
          session.client.GET('/api/v1/me/notifications', {
            params: { query: { unread: 'true', limit: 1 } },
          }),
        );
        const newest = list.notifications[0]?.id ?? 0;
        inbox = newest > (this.seen.get(agent.name) ?? 0);
        if (inbox) this.seen.set(agent.name, newest);
        if (!inbox) {
          if (slot === 1 && slots.size === 0) this.log(agent, `nichts zu tun (${reason})`);
          return;
        }
      }
      await this.start(agent, slot, session, task?.key ?? null, reason);
      if (!task) return;
    }
  }

  private async start(
    agent: RunnerAgent,
    slot: number,
    session: Session,
    key: string | null,
    reason: string,
  ): Promise<void> {
    const slots = this.busy.get(agent.name) as Map<number, Running>;
    const focus = key
      ? `\n\n## Dieser Durchgang\n\nDein Vorgang: ${key}. Arbeite nur an ihm; \`lenipo agent next\` musst du nicht aufrufen.\n`
      : '\n\n## Dieser Durchgang\n\nKein Vorgang ist offen: Nur Schritt 6 (Inbox) erledigen.\n';
    const argv = commandLine(agent, `${this.prompt}${focus}`);
    const label = `${key ?? 'Inbox'} in Platz ${slot} (${reason})`;
    if (this.dryRun) {
      if (key) this.taken.add(key);
      this.io.out(`${agent.name}: ${label}: ${argv[0]} …`);
      return;
    }
    const cwd = await this.worktree(agent, slot);
    const runs = join(this.root, '.lenipo', 'runs', agent.name);
    await mkdir(runs, { recursive: true });
    const file = join(runs, `${new Date().toISOString().replace(/[:.]/g, '-')}-${slot}.log`);
    const output = createWriteStream(file);
    output.write(`# ${agent.name} · ${label}\n# ${argv[0]} (${agent.adapter})\n\n`);
    const token = await session.token();
    const [program, ...rest] = argv;
    if (!program) throw new CliError(`${agent.name}: leere Befehlszeile`, 2);
    const child = spawn(program, rest, {
      cwd,
      env: {
        ...this.io.env,
        LENIPO_URL: session.url,
        LENIPO_TOKEN: token,
        LENIPO_AGENT: agent.name,
        // The runner reports the cost of tools that state it (E-151).
        ...(agent.adapter === 'claude-code' ? { LENIPO_COST_REPORTED: '1' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (key) this.taken.add(key);
    slots.set(slot, { child, key });
    this.log(agent, `startet ${label}`);
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      output.write(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => output.write(chunk));
    const limit = setTimeout(
      () => {
        output.write('\n# Zeitgrenze erreicht, wird beendet\n');
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
      },
      (agent.timeoutMinutes ?? 60) * 60_000,
    );
    const done = new Promise<void>((resolve) => {
      const finish = async (code: number | null, error?: Error) => {
        clearTimeout(limit);
        output.end(`\n# Ende: ${error ? error.message : `Exit ${code}`}\n`);
        slots.delete(slot);
        if (key) this.taken.delete(key);
        this.log(agent, `fertig ${label}: ${error ? error.message : `Exit ${code}`}`);
        const cost = agent.adapter === 'claude-code' ? costOf(stdout) : null;
        if (cost !== null && cost > 0) {
          await session.client.POST('/api/v1/me/usage', { body: { cost } }).catch(() => undefined);
        }
        if (this.pending.delete(agent.name)) this.trigger(agent, 'vorgemerkt');
        resolve();
      };
      child.on('error', (error) => void finish(null, error));
      child.on('close', (code) => void finish(code));
    });
    this.runs.add(done);
    void done.finally(() => this.runs.delete(done));
  }

  /** One worktree per agent and slot; a clean one starts from the newest base each time. */
  private async worktree(agent: RunnerAgent, slot: number): Promise<string> {
    const base = this.config.base ?? 'main';
    const hasOrigin = (await git(this.root, ['remote'])).split('\n').includes('origin');
    if (hasOrigin) await git(this.root, ['fetch', '--quiet', 'origin', base]);
    const ref = hasOrigin ? `origin/${base}` : base;
    const path = join(this.root, '.lenipo', 'worktrees', `${agent.name}-${slot}`);
    if (!existsSync(path)) {
      await git(this.root, ['worktree', 'add', '--quiet', '--detach', path, ref]);
    } else if ((await git(path, ['status', '--porcelain'])) === '') {
      await git(path, ['checkout', '--quiet', '--detach', ref]);
    } else {
      this.log(agent, `Platz ${slot} hat offene Änderungen, der Agent setzt dort fort`);
    }
    return path;
  }
}

/** `lenipo agent run [--once] [--every <Minuten>] [--listen <Port>] [--dry-run]` */
export async function runAgents(
  values: {
    dir?: string;
    once?: boolean;
    every?: string;
    listen?: string;
    'dry-run'?: boolean;
  },
  io: Io,
): Promise<void> {
  const root = await git(values.dir ?? process.cwd(), ['rev-parse', '--show-toplevel']).catch(
    () => {
      throw new CliError('Kein Git-Repository: den Runner im Code-Repository starten.', 2);
    },
  );
  const config = await readRunnerConfig(root);
  const agentConfig = await readAgentConfig(root);
  const prompt = await readFile(join(root, PROMPT), 'utf8');
  // Worktrees and logs stay out of the repository.
  const ignore = join(root, '.lenipo', '.gitignore');
  if (!existsSync(ignore)) await writeFile(ignore, 'worktrees/\nruns/\n');
  const runner = new Runner(io, root, config, agentConfig, prompt, values['dry-run'] ?? false);
  for (const agent of config.agents) await runner.session(agent);

  for (const agent of config.agents) runner.trigger(agent, 'Start');
  if (values.once) {
    await runner.idle();
    return;
  }

  const controller = new AbortController();
  const minutes = Number(values.every ?? config.every ?? 15);
  if (!Number.isFinite(minutes) || minutes < 1)
    throw new CliError('--every in Minuten, mindestens 1', 2);
  const timer = setInterval(() => {
    for (const agent of config.agents) runner.trigger(agent, 'Zeitplan');
  }, minutes * 60_000);
  for (const agent of config.agents) {
    void streamEvents(
      await runner.session(agent),
      () => runner.trigger(agent, 'Ereignis'),
      controller.signal,
    ).catch((error: unknown) =>
      io.err(
        `${agent.name}: Ereignis-Strom: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
  let server: Server | null = null;
  if (values.listen) server = await listen(Number(values.listen), config, runner, io);
  io.err(
    `Runner läuft: ${config.agents.map((agent) => agent.name).join(', ')}; alle ${minutes} Minuten${server ? `, Webhooks auf Port ${values.listen}` : ''}. Beenden mit Strg+C.`,
  );
  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(timer);
      controller.abort();
      server?.close();
      runner.stop();
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  await runner.idle();
}

/** Receives the agents' webhooks at `/<name>` and starts a run for each valid one. */
async function listen(port: number, config: RunnerConfig, runner: Runner, io: Io): Promise<Server> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new CliError('--listen erwartet einen Port', 2);
  }
  const server = createServer((request, response) => {
    const name = (request.url ?? '').replace(/^\/+|\/+$/g, '');
    const agent = config.agents.find((entry) => entry.name === name);
    const secret = agent?.webhookSecretEnv ? io.env[agent.webhookSecretEnv] : undefined;
    if (request.method !== 'POST' || !agent) {
      response.writeHead(404).end();
      return;
    }
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on('end', () => {
      const header = (field: string) => {
        const value = request.headers[field];
        return Array.isArray(value) ? value[0] : value;
      };
      // Without a secret nobody may wake the agent up.
      if (
        !secret ||
        !verifySignature(
          secret,
          {
            id: header('webhook-id'),
            timestamp: header('webhook-timestamp'),
            signature: header('webhook-signature'),
          },
          body,
        )
      ) {
        response.writeHead(401).end();
        return;
      }
      response.writeHead(204).end();
      runner.trigger(agent, 'Webhook');
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  return server;
}
