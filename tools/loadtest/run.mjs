// Load test against the quality goals (docs/06-architektur.md, 6.10; TL-44, E-125).
// Starts the built app (apps/api/dist with the web app) on a fresh database, fills it, measures
// each goal and writes a Markdown report. `--smoke` uses small numbers, for CI.
//
//   DATABASE_URL=postgres://… pnpm --filter @tasklore/loadtest loadtest
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import autocannon from 'autocannon';
import postgres from 'postgres';
import WebSocket from 'ws';
import * as Y from 'yjs';

const SMOKE = process.argv.includes('--smoke');
const SIZE = {
  issues: SMOKE ? 5_000 : 1_000_000,
  boardCards: SMOKE ? 50 : 500,
  editors: SMOKE ? 5 : 30,
  seconds: SMOKE ? 3 : 15,
};
const PORT = 4280;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const API = `${ORIGIN}/api/v1`;
const ROOT = resolve(import.meta.dirname, '../..');
const WORDS =
  'login export board sprint wiki seite fehler timeout rechte suche filter bericht release version kommentar anhang import webhook passwort cache migration'.split(
    ' ',
  );

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

async function start() {
  const serverUrl = process.env.DATABASE_URL;
  if (!serverUrl) throw new Error('DATABASE_URL is needed');
  const name = `tasklore_load_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const { REDIS_URL: _, ...env } = process.env;
  const server = spawn(process.execPath, [join(ROOT, 'apps/api/dist/main.js')], {
    env: {
      ...env,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'false',
      DATABASE_URL: url.toString(),
      MODE: 'all',
      API_PORT: String(PORT),
      COLLAB_PORT: String(PORT + 1),
      WEB_DIST_DIR: join(ROOT, 'apps/web/dist'),
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: mkdtempSync(join(os.tmpdir(), 'tasklore-load-')),
      RATE_LIMITS: 'false',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const code = await new Promise((done, fail) => {
    let buffer = '';
    server.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = /"setupCode":"([^"]+)"/.exec(buffer);
      if (match) done(match[1]);
    });
    server.on('exit', (status) => fail(new Error(`API ended with ${status}`)));
  });
  return { server, database: url.toString(), name, code };
}

async function call(cookie, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response;
}

/** Many issues in one statement: copies of a real one, with numbers, words and dates. */
async function fill(database, projectKey, count) {
  const sql = postgres(database, { max: 1, onnotice: () => {} });
  const [template] = await sql`
    select i.* from issues i join projects p on p.id = i.project_id
    where p.key = ${projectKey} order by i.number limit 1`;
  const words = sql.array(WORDS);
  await sql`
    insert into issues (id, project_id, number, key, issue_type_id, status_id, workflow_version_id,
      priority_id, summary, description_text, rank, created_at, updated_at, reporter_id)
    select gen_random_uuid(), ${template.project_id}, n + 1, ${projectKey} || '-' || (n + 1),
      ${template.issue_type_id}, ${template.status_id}, ${template.workflow_version_id},
      ${template.priority_id},
      (${words})[1 + n % 20] || ' ' || (${words})[1 + (n / 20) % 20] || ' ' || n,
      'Beschreibung ' || (${words})[1 + (n / 7) % 20], lpad(n::text, 9, '0'),
      now() - (n || ' minutes')::interval, now() - (n || ' minutes')::interval,
      ${template.reporter_id}
    from generate_series(1, ${count}) as n`;
  await sql`update projects set issue_counter = ${count + 1} where key = ${projectKey}`;
  // As after any large import: fresh statistics, no autovacuum during the measurements.
  await sql`vacuum analyze issues`;
  await sql.end();
}

async function http(title, goalMs, cookie, paths, { method = 'GET', body } = {}) {
  let next = 0;
  const result = await autocannon({
    url: ORIGIN,
    connections: 10,
    duration: SIZE.seconds,
    headers: { cookie, 'content-type': 'application/json' },
    requests: [
      {
        method,
        body: body ? JSON.stringify(body) : undefined,
        setupRequest: (request) => {
          request.path = paths[next++ % paths.length];
          return request;
        },
      },
    ],
  });
  const failed = result.non2xx + result.errors;
  // autocannon reports p97.5, not p95; it is the stricter of the two.
  const p = result.latency.p97_5;
  return {
    title,
    goal: `p95 < ${goalMs} ms`,
    measured: `p97,5 ${p} ms · p50 ${result.latency.p50} ms · ${Math.round(result.requests.average)} req/s`,
    ok: p < goalMs && failed === 0,
    note: failed ? `${failed} Fehler` : '',
  };
}

async function coEditing(cookie, pageId, editors) {
  const docs = [];
  const providers = [];
  for (let n = 0; n < editors + 1; n += 1) {
    const doc = new Y.Doc();
    const Socket = class extends WebSocket {
      constructor(target, protocols) {
        super(target, protocols, { headers: { cookie } });
      }
    };
    const socket = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${PORT + 1}`,
      WebSocketPolyfill: Socket,
    });
    await new Promise((done, fail) => {
      const provider = new HocuspocusProvider({
        websocketProvider: socket,
        name: `page:${pageId}`,
        document: doc,
        token: 'session',
        onSynced: () => done(),
        onAuthenticationFailed: ({ reason }) => fail(new Error(reason)),
      });
      provider.attach();
      providers.push(provider);
    });
    docs.push(doc);
  }
  const observer = docs[0];
  const text = observer.getXmlFragment('default');
  const seen = new Map();
  text.observeDeep(() => {
    const now = performance.now();
    for (const node of text.toArray()) {
      const id = node.getAttribute?.('data-probe');
      if (id && !seen.has(id)) seen.set(id, now);
    }
  });
  const sent = new Map();
  const end = Date.now() + SIZE.seconds * 1000;
  let counter = 0;
  // Every editor adds a paragraph about every 200 ms; the observer notes when it arrives.
  await Promise.all(
    docs.slice(1).map(async (doc, editor) => {
      const fragment = doc.getXmlFragment('default');
      while (Date.now() < end) {
        const id = `${editor}-${counter++}`;
        const paragraph = new Y.XmlElement('paragraph');
        paragraph.setAttribute('data-probe', id);
        paragraph.insert(0, [new Y.XmlText(`Zeile ${id}`)]);
        sent.set(id, performance.now());
        fragment.insert(fragment.length, [paragraph]);
        await new Promise((resolveWait) => setTimeout(resolveWait, 150 + Math.random() * 100));
      }
    }),
  );
  await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
  const latencies = [...sent].flatMap(([id, at]) => (seen.has(id) ? [seen.get(id) - at] : []));
  const lost = sent.size - latencies.length;
  for (const provider of providers) provider.destroy();
  return { latencies, lost, edits: sent.size };
}

async function main() {
  const started = Date.now();
  const { server, database, name, code } = await start();
  const rows = [];
  try {
    const setup = await call(null, 'POST', '/setup', {
      token: code,
      instanceName: 'Last',
      admin: { email: 'last@example.org', displayName: 'Last', password: 'ein-langes-passwort' },
    });
    const cookie = setup.headers.getSetCookie()[0].split(';')[0];
    const project = await (
      await call(cookie, 'POST', '/me/onboarding', {
        start: { method: 'scrum', name: 'Viele Vorgänge', key: 'LAST' },
      })
    ).json();
    await call(cookie, 'POST', '/issues', { projectKey: 'LAST', issueType: 'task', summary: 'x' });
    await call(cookie, 'POST', '/projects', { key: 'BRD', name: 'Board', template: 'kanban' });
    await call(cookie, 'POST', '/issues', { projectKey: 'BRD', issueType: 'task', summary: 'x' });
    console.log(`Filling ${SIZE.issues} issues …`);
    const fillStarted = Date.now();
    await fill(database, 'LAST', SIZE.issues);
    await fill(database, 'BRD', SIZE.boardCards - 1);
    console.log(`Filled in ${Math.round((Date.now() - fillStarted) / 1000)} s`);
    const board = await (
      await call(cookie, 'POST', '/boards', {
        name: 'Viele Karten',
        projectKey: 'BRD',
        type: 'kanban',
      })
    ).json();
    const boardId = board.id;

    // For profiling: keep the filled instance running until Ctrl-C.
    if (process.env.LOADTEST_KEEP) {
      writeFileSync(
        join(import.meta.dirname, 'keep.json'),
        JSON.stringify({ cookie, database, boardId, origin: ORIGIN }),
      );
      console.log('Instance kept running; Ctrl-C ends it.');
      await new Promise((done) => process.once('SIGINT', done));
      return;
    }

    const keys = Array.from(
      { length: 500 },
      () => `/api/v1/issues/LAST-${1 + Math.floor(Math.random() * SIZE.issues)}`,
    );
    rows.push(await http('Vorgang öffnen (API)', 150, cookie, keys));
    rows.push(
      await http('Board mit 500 Karten laden (API)', 1000, cookie, [
        `/api/v1/boards/${boardId}/issues`,
      ]),
    );
    rows.push(
      await http(
        `TQL-Volltext, häufiger Begriff (jeder 10. Vorgang), ${SIZE.issues.toLocaleString('de-DE')} Vorgänge`,
        300,
        cookie,
        ['/api/v1/search'],
        {
          method: 'POST',
          body: {
            query: 'project = LAST AND text ~ "timeout" ORDER BY updated DESC',
            limit: 50,
          },
        },
      ),
    );
    rows.push(
      await http('TQL-Volltext, seltener Begriff', 300, cookie, ['/api/v1/search'], {
        method: 'POST',
        body: { query: 'project = LAST AND text ~ "4711" ORDER BY updated DESC', limit: 50 },
      }),
    );
    rows.push(
      await http('TQL-Suche nach Status, sortiert', 300, cookie, ['/api/v1/search'], {
        method: 'POST',
        body: {
          query: 'project = LAST AND statusCategory != done ORDER BY created DESC',
          limit: 50,
        },
      }),
    );

    const space = await (await call(cookie, 'GET', '/spaces')).json();
    const page = await (
      await call(cookie, 'POST', `/spaces/${space[0].key}/pages`, { title: 'Gemeinsam' })
    ).json();
    const pair = await coEditing(cookie, page.id, 1);
    rows.push({
      title: 'Co-Editing-Latenz (lokal)',
      goal: 'p95 < 100 ms',
      measured: `p95 ${Math.round(percentile(pair.latencies, 95))} ms · ${pair.edits} Änderungen`,
      ok: percentile(pair.latencies, 95) < 100 && pair.lost === 0,
      note: pair.lost ? `${pair.lost} nicht angekommen` : '',
    });
    const crowd = await coEditing(cookie, page.id, SIZE.editors);
    rows.push({
      title: `${SIZE.editors} gleichzeitige Bearbeiter einer Seite`,
      goal: 'ohne spürbare Verzögerung (p95 < 250 ms)',
      measured: `p95 ${Math.round(percentile(crowd.latencies, 95))} ms · ${crowd.edits} Änderungen`,
      ok: percentile(crowd.latencies, 95) < 250 && crowd.lost === 0,
      note: crowd.lost ? `${crowd.lost} nicht angekommen` : '',
    });
    void project;
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
    const admin = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  }

  const machine = `${os.cpus()[0]?.model ?? 'unbekannt'}, ${os.cpus().length} Kerne, ${Math.round(os.totalmem() / 1024 ** 3)} GB RAM, Node ${process.version}, PostgreSQL auf demselben Rechner`;
  const report = [
    `# Lasttest ${new Date().toISOString().slice(0, 10)}${SMOKE ? ' (Smoke)' : ''}`,
    '',
    `Rechner: ${machine}. Dauer ${Math.round((Date.now() - started) / 1000)} s. Alles in einem Prozess (MODE=all), 10 parallele Verbindungen je HTTP-Messung über ${SIZE.seconds} s.`,
    '',
    '| Ziel | Vorgabe | Gemessen | Erfüllt |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${row.title} | ${row.goal} | ${row.measured}${row.note ? ` (${row.note})` : ''} | ${row.ok ? 'ja' : 'nein'} |`,
    ),
    '',
  ].join('\n');
  const target = process.env.LOADTEST_REPORT ?? join(import.meta.dirname, 'report.md');
  writeFileSync(target, report);
  console.log(report);
  if (rows.some((row) => !row.ok)) process.exitCode = 1;
}

await main();
// Sockets of the measuring clients may linger; the report is written.
process.exit();
