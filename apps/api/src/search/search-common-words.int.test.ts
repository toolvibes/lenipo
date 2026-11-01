import { type Issue, SEARCH_TOTAL_CAP, type SearchResult } from '@tasklore/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let commented: Issue;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'BIG', name: 'Groß', template: 'basic' });
  const first = (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'BIG',
      issueType: 'task',
      summary: 'Vorlage',
    })
  ).body;
  // More issues with the word than the count goes, copied from the first one in one statement.
  await test.database.db.execute(sql`
    insert into issues (id, project_id, number, key, issue_type_id, status_id,
      workflow_version_id, priority_id, summary, description_text, rank, created_at,
      updated_at, reporter_id)
    select gen_random_uuid(), i.project_id, n + 1, 'BIG-' || (n + 1), i.issue_type_id,
      i.status_id, i.workflow_version_id, i.priority_id, 'Zeitüberschreitung ' || n, '',
      lpad(n::text, 9, '0'), now() - (n || ' minutes')::interval,
      now() - (n || ' minutes')::interval, i.reporter_id
    from issues i, generate_series(1, ${SEARCH_TOTAL_CAP + 10}) as n
    where i.id = ${first.id}`);
  await test.database.db.execute(
    sql`update projects set issue_counter = ${SEARCH_TOTAL_CAP + 12} where key = 'BIG'`,
  );
  await test.database.db.execute(sql`analyze issues`);
  // The newest issue has the word only in a comment.
  commented = (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'BIG',
      issueType: 'task',
      summary: 'Ohne das Wort',
    })
  ).body;
  await admin.request('POST', `/issues/${commented.key}/comments`, {
    body: { markdown: 'Wieder eine Zeitüberschreitung' },
  });
}, 120_000);

afterAll(async () => {
  await test?.close();
});

describe('full text search for common words (TL-90)', () => {
  it('walks the sort order when a word matches more than the count goes', async () => {
    const result = await admin.request<SearchResult>('POST', '/search', {
      query: 'project = BIG AND text ~ Zeitüberschreitung ORDER BY updated DESC',
      limit: 3,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: SEARCH_TOTAL_CAP, totalCapped: true });
    expect(result.body.issues.map((issue) => issue.key)).toEqual([commented.key, 'BIG-2', 'BIG-3']);

    const oldest = await admin.request<SearchResult>('POST', '/search', {
      query: 'project = BIG AND text ~ Zeitüberschreitung ORDER BY created ASC',
      limit: 1,
    });
    expect(oldest.body.issues.map((issue) => issue.key)).toEqual([`BIG-${SEARCH_TOTAL_CAP + 11}`]);
  });

  it('collects rare words through the index, also with common ones around', async () => {
    const rare = await admin.request<SearchResult>('POST', '/search', {
      query: 'project = BIG AND text ~ Zeitüberschreitung AND summary ~ 4711',
    });
    expect(rare.body).toMatchObject({ total: 1, totalCapped: false });
    expect(rare.body.issues.map((issue) => issue.key)).toEqual(['BIG-4712']);
    const comment = await admin.request<SearchResult>('POST', '/search', {
      query: 'project = BIG AND comment ~ Zeitüberschreitung',
    });
    expect(comment.body.issues.map((issue) => issue.key)).toEqual([commented.key]);
  });
});
