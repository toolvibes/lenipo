import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { changesOf, issueKeysIn, smartCommands, verify } from './providers.js';

describe('git webhooks (D-GIT-01..03)', () => {
  it('checks signatures per provider', () => {
    const body = Buffer.from('{"a":1}');
    const hmac = createHmac('sha256', 'geheim').update(body).digest('hex');
    expect(verify('github', 'geheim', { 'x-hub-signature-256': `sha256=${hmac}` }, body)).toBe(
      true,
    );
    expect(verify('github', 'geheim', { 'x-hub-signature-256': 'sha256=00' }, body)).toBe(false);
    expect(verify('gitea', 'geheim', { 'x-gitea-signature': hmac }, body)).toBe(true);
    expect(verify('gitlab', 'geheim', { 'x-gitlab-token': 'geheim' }, body)).toBe(true);
    expect(verify('gitlab', 'geheim', {}, body)).toBe(false);
  });

  it('reads pushes with a new branch and pull requests', () => {
    const push = changesOf('github', 'push', {
      ref: 'refs/heads/feature/web-12-login',
      created: true,
      repository: { full_name: 'acme/web', html_url: 'https://github.com/acme/web' },
      commits: [
        {
          id: 'abc',
          message: 'WEB-12 Login',
          url: 'u',
          author: { name: 'Lena', email: 'l@x' },
          timestamp: '2026-10-31T10:00:00Z',
        },
      ],
    });
    expect(push.map((change) => change.kind)).toEqual(['branch', 'commit']);
    const merged = changesOf('gitlab', 'Merge Request Hook', {
      project: { path_with_namespace: 'acme/web' },
      object_attributes: {
        iid: 7,
        title: 'WEB-12: Login',
        state: 'merged',
        source_branch: 'web-12',
      },
    });
    expect(merged[0]).toMatchObject({ kind: 'pull_request', number: '7', state: 'merged' });
    const run = changesOf('github', 'workflow_run', {
      repository: { full_name: 'acme/web' },
      workflow_run: {
        id: 1,
        name: 'CI',
        status: 'completed',
        conclusion: 'failure',
        head_branch: 'WEB-12',
      },
    });
    expect(run[0]).toMatchObject({ kind: 'build', state: 'failure' });
  });

  it('finds issue keys and smart commit commands', () => {
    expect(issueKeysIn('feature/web-12-login', 'Fix WEB-12 and API-3, not ab-1x')).toEqual([
      'WEB-12',
      'API-3',
    ]);
    expect(
      smartCommands('WEB-12 #comment Fertig gebaut #time 1h 30m Tests #in-review\nsiehe PR #14'),
    ).toEqual([
      { type: 'comment', text: 'Fertig gebaut' },
      { type: 'time', duration: '1h 30m', text: 'Tests' },
      { type: 'transition', name: 'in-review' },
    ]);
  });
});
