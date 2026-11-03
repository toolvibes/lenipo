import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  AiSettings,
  AiTestResult,
  AutomationRun,
  Comment,
  EverythingResult,
  Issue,
  Page,
  SearchResult,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationEngine } from '../automation/automation.engine.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SemanticService } from './semantic.service.js';

let test: TestApp;
let admin: TestClient;
let model: Server;
let modelUrl: string;
const prompts: string[] = [];

/** Meanings as directions: words of one topic share a dimension, so synonyms are near. */
const TOPICS = [
  ['backup', 'sicherung', 'datensicherung', 'wiederherstellen'],
  ['login', 'anmeldung', 'passwort', 'anmelden'],
  ['drucker', 'drucken', 'druckt'],
];

function embedding(text: string): number[] {
  const words = text.toLowerCase().split(/[^a-zäöüß]+/);
  const vector = TOPICS.map(
    (topic) => words.filter((word) => topic.some((term) => word.includes(term))).length,
  );
  return [...vector, 0.1];
}

/** A small OpenAI-compatible model: embeddings by topic, chat answers with a summary. */
function startModel(): Promise<void> {
  model = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const input = JSON.parse(body) as {
        input?: string[];
        messages?: Array<{ content: string }>;
      };
      response.setHeader('content-type', 'application/json');
      if (request.headers.authorization !== 'Bearer geheim') {
        response.statusCode = 401;
        response.end('{"error":"unauthorized"}');
      } else if (request.url === '/v1/embeddings') {
        response.end(
          JSON.stringify({
            data: (input.input ?? []).map((text, index) => ({ index, embedding: embedding(text) })),
          }),
        );
      } else if (request.url === '/v1/chat/completions') {
        const prompt = input.messages?.at(-1)?.content ?? '';
        prompts.push(prompt);
        response.end(
          JSON.stringify({
            choices: [{ message: { content: `Kurz: ${prompt.split('\n')[0]?.slice(0, 40)}` } }],
          }),
        );
      } else {
        response.statusCode = 404;
        response.end('{}');
      }
    });
  });
  return new Promise((resolve) =>
    model.listen(0, '127.0.0.1', () => {
      modelUrl = `http://127.0.0.1:${(model.address() as AddressInfo).port}/v1`;
      resolve();
    }),
  );
}

async function drain(): Promise<void> {
  const processor = test.app.get(EventProcessor);
  await test.app.get(AutomationEngine).drain(() => processor.drain());
}

async function index(): Promise<void> {
  while ((await test.app.get(SemanticService).indexPending()) > 0);
}

beforeAll(async () => {
  await startModel();
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  for (const summary of [
    'Backup der Datenbank schlägt fehl',
    'Anmeldung mit Passwort geht nicht',
    'Drucker im Büro druckt nicht',
  ]) {
    await admin.request('POST', '/issues', { projectKey: 'OPS', issueType: 'task', summary });
  }
  await drain();
  await admin.request('POST', '/spaces', { key: 'HOW', name: 'Anleitungen' });
  const page = (
    await admin.request<Page>('POST', '/spaces/HOW/pages', { title: 'Wiederherstellen' })
  ).body;
  await admin.request('POST', `/pages/${page.id}/publish`, {
    title: 'Wiederherstellen',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Die Sicherung zurückspielen.' }] },
      ],
    },
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
  model?.close();
});

describe('AI extension (TL-49)', () => {
  it('stays off until a model is set up', async () => {
    expect(
      (await admin.request<{ available: boolean }>('GET', '/search/semantic-status')).body,
    ).toEqual({ available: false });
    const query = await admin.request<{ queryErrors: Array<{ code: string }> }>('POST', '/search', {
      query: 'similar ~ "Datensicherung"',
    });
    expect(query.status).toBe(400);
    expect(query.body.queryErrors[0]?.code).toBe('semantic-unavailable');
  });

  it('keeps the key to itself and tests both models', async () => {
    const saved = await admin.request<AiSettings>('PUT', '/admin/ai', {
      baseUrl: modelUrl,
      apiKey: 'geheim',
      chatModel: 'klein-chat',
      embeddingModel: 'klein-embed',
      dailyLimit: 2,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ hasApiKey: true, vectorAvailable: true });
    expect(JSON.stringify(saved.body)).not.toContain('geheim');
    const tried = (await admin.request<AiTestResult>('POST', '/admin/ai/test')).body;
    expect(tried.chat.ok).toBe(true);
    expect(tried.embeddings).toEqual({ ok: true, detail: '4 dimensions' });
  });

  it('finds issues and pages by meaning, also through TQL', async () => {
    await index();
    expect((await admin.request<AiSettings>('GET', '/admin/ai')).body.indexed).toEqual({
      issues: 3,
      pages: 1,
    });
    // No word in common with "Backup der Datenbank schlägt fehl", but the same meaning.
    const found = await admin.request<SearchResult>('POST', '/search', {
      query: 'project = OPS AND similar ~ "Datensicherung wiederherstellen"',
    });
    expect(found.status).toBe(200);
    expect(found.body.issues[0]?.summary).toBe('Backup der Datenbank schlägt fehl');

    const everything = (
      await admin.request<EverythingResult>(
        'GET',
        `/search/everything?q=${encodeURIComponent('Anmelden klappt nicht')}&semantic=true`,
      )
    ).body;
    expect(everything.issues[0]?.summary).toBe('Anmeldung mit Passwort geht nicht');
    const restore = (
      await admin.request<EverythingResult>(
        'GET',
        `/search/everything?q=${encodeURIComponent('Datensicherung')}&semantic=true&type=page`,
      )
    ).body;
    expect(restore.pages[0]?.title).toBe('Wiederherstellen');

    // A changed text gets a new embedding.
    await admin.request('PATCH', '/issues/OPS-3', { summary: 'Login am Drucker gesperrt' });
    expect(await test.app.get(SemanticService).indexPending()).toBe(1);
  });

  it('answers in automation rules within the daily limit', async () => {
    const rule = (
      await admin.request<{ id: string }>('POST', '/automation/rules', {
        projectKey: 'OPS',
        name: 'Zusammenfassen',
        trigger: { type: 'issue-created' },
        components: [
          { type: 'ai', prompt: 'Fasse zusammen: {{issue.summary}}\n{{issue.description}}' },
          { type: 'comment', body: '{{ai.response}}' },
        ],
      })
    ).body;
    // The test call above used one of the two calls of today.
    await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Server neu starten',
      description: { markdown: 'Nach dem **Update**.' },
    });
    await drain();
    expect(prompts.at(-1)).toBe('Fasse zusammen: Server neu starten\nNach dem **Update**.');
    const comments = (
      await admin.request<Comment[]>('GET', '/issues/OPS-4/comments?format=markdown')
    ).body;
    expect(comments.map((comment) => String(comment.body).trim())).toEqual([
      'Kurz: Fasse zusammen: Server neu starten',
    ]);

    await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Noch einer',
    });
    await drain();
    expect((await admin.request<Comment[]>('GET', '/issues/OPS-5/comments')).body).toEqual([]);
    const runs = (await admin.request<AutomationRun[]>('GET', `/automation/rules/${rule.id}/runs`))
      .body;
    expect(JSON.stringify(runs[0])).toContain('daily limit');
    expect((await admin.request<Issue>('GET', '/issues/OPS-5')).body.summary).toBe('Noch einer');
  });
});
