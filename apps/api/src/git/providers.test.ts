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

describe('Bitbucket Cloud (TL-52)', () => {
  it('checks the signature and reads pushes, pull requests and commit statuses', () => {
    const body = Buffer.from('{"a":1}');
    const hmac = createHmac('sha256', 'geheim').update(body).digest('hex');
    expect(verify('bitbucket', 'geheim', { 'x-hub-signature': `sha256=${hmac}` }, body)).toBe(true);
    expect(verify('bitbucket', 'geheim', { 'x-hub-signature': hmac }, body)).toBe(false);

    const repository = { full_name: 'acme/web' };
    const push = changesOf('bitbucket', 'repo:push', {
      repository,
      actor: { display_name: 'Lena' },
      push: {
        changes: [
          {
            created: true,
            new: {
              type: 'branch',
              name: 'web-12-login',
              links: { html: { href: 'https://bitbucket.org/acme/web/branch/web-12-login' } },
            },
            commits: [
              {
                hash: 'abc',
                message: 'WEB-12 Login\n',
                date: '2026-11-03T10:00:00+00:00',
                author: { raw: 'Lena Vogt <lena@example.org>' },
                links: { html: { href: 'https://bitbucket.org/acme/web/commits/abc' } },
              },
            ],
          },
        ],
      },
    });
    expect(push).toMatchObject([
      { kind: 'branch', name: 'web-12-login', created: true, author: 'Lena' },
      {
        kind: 'commit',
        sha: 'abc',
        authorName: 'Lena Vogt',
        authorEmail: 'lena@example.org',
        branch: 'web-12-login',
      },
    ]);

    const merged = changesOf('bitbucket', 'pullrequest:fulfilled', {
      repository,
      pullrequest: {
        id: 7,
        title: 'WEB-12 Login',
        state: 'MERGED',
        source: { branch: { name: 'web-12-login' } },
        links: { html: { href: 'https://bitbucket.org/acme/web/pull-requests/7' } },
        author: { display_name: 'Lena' },
      },
    });
    expect(merged).toMatchObject([{ kind: 'pull_request', number: '7', state: 'merged' }]);

    const build = changesOf('bitbucket', 'repo:commit_status_updated', {
      repository,
      commit_status: {
        key: 'ci',
        name: 'Pipeline',
        state: 'FAILED',
        refname: 'web-12-login',
        url: 'https://ci',
        commit: { hash: 'abc' },
      },
    });
    expect(build).toMatchObject([{ kind: 'build', state: 'failure', sha: 'abc' }]);
  });
});
