import { createHmac } from 'node:crypto';
import type { GitProvider } from '@tasklore/shared';
import { constantTimeEquals } from '../identity/secrets.js';

/** What a webhook reported, the same for every provider (E-116). */
export type GitChange =
  | {
      kind: 'branch';
      repository: string;
      name: string;
      url: string | null;
      created: boolean;
      author: string | null;
    }
  | {
      kind: 'commit';
      repository: string;
      sha: string;
      message: string;
      url: string | null;
      authorName: string | null;
      authorEmail: string | null;
      at: string;
      branch: string | null;
    }
  | {
      kind: 'pull_request';
      repository: string;
      number: string;
      title: string;
      url: string | null;
      state: 'open' | 'draft' | 'merged' | 'closed';
      review: 'approved' | 'changes_requested' | null;
      branch: string | null;
      author: string | null;
    }
  | {
      kind: 'build';
      repository: string;
      id: string;
      name: string;
      state: 'pending' | 'success' | 'failure';
      url: string | null;
      branch: string | null;
      sha: string | null;
    };

// biome-ignore lint/suspicious/noExplicitAny: webhook payloads are untyped JSON
type Json = any;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : typeof value === 'number' ? String(value) : null;

const branchOf = (ref: unknown) => {
  const text = str(ref);
  return text?.startsWith('refs/heads/') ? text.slice('refs/heads/'.length) : null;
};

const ZERO = /^0+$/;

/** Whether the request really comes from the hosting: HMAC for GitHub and Gitea, token for GitLab. */
export function verify(
  provider: GitProvider,
  secret: string,
  headers: Record<string, string | undefined>,
  body: Buffer,
): boolean {
  if (provider === 'gitlab') {
    const token = headers['x-gitlab-token'];
    return !!token && constantTimeEquals(token, secret);
  }
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  if (provider === 'github') {
    const signature = headers['x-hub-signature-256'];
    return !!signature && constantTimeEquals(signature, `sha256=${digest}`);
  }
  const signature = headers['x-gitea-signature'] ?? headers['x-forgejo-signature'];
  return !!signature && constantTimeEquals(signature, digest);
}

/** The event name the provider sent, e.g. "push" or "Merge Request Hook". */
export function eventOf(provider: GitProvider, headers: Record<string, string | undefined>) {
  if (provider === 'github') return headers['x-github-event'] ?? '';
  if (provider === 'gitlab') return headers['x-gitlab-event'] ?? '';
  return headers['x-gitea-event'] ?? headers['x-forgejo-event'] ?? '';
}

function commitsOf(repository: string, branch: string | null, commits: Json[]): GitChange[] {
  return (Array.isArray(commits) ? commits : []).flatMap((commit): GitChange[] => {
    const sha = str(commit?.id);
    if (!sha) return [];
    return [
      {
        kind: 'commit',
        repository,
        sha,
        message: String(commit.message ?? ''),
        url: str(commit.url),
        authorName: str(commit.author?.name),
        authorEmail: str(commit.author?.email),
        at: str(commit.timestamp) ?? new Date().toISOString(),
        branch,
      },
    ];
  });
}

/** GitHub and Gitea/Forgejo share most payloads. */
function githubLike(event: string, body: Json): GitChange[] {
  const repository = str(body?.repository?.full_name) ?? '';
  const repoUrl = str(body?.repository?.html_url);
  switch (event) {
    case 'push': {
      const branch = branchOf(body.ref);
      if (!branch || body.deleted) return [];
      const changes = commitsOf(repository, branch, body.commits);
      if (body.created || (str(body.before) && ZERO.test(String(body.before)))) {
        changes.unshift({
          kind: 'branch',
          repository,
          name: branch,
          url: repoUrl ? `${repoUrl}/tree/${branch}` : null,
          created: true,
          author: str(body.sender?.login),
        });
      }
      return changes;
    }
    case 'create': {
      if (body.ref_type !== 'branch') return [];
      const name = str(body.ref) ?? '';
      return [
        {
          kind: 'branch',
          repository,
          name,
          url: repoUrl ? `${repoUrl}/tree/${name}` : null,
          created: true,
          author: str(body.sender?.login),
        },
      ];
    }
    case 'pull_request':
    case 'pull_request_review':
    case 'pull_request_review_approved':
    case 'pull_request_review_rejected': {
      const pull = body.pull_request ?? {};
      const number = str(pull.number ?? body.number);
      if (!number) return [];
      const reviewState = String(body.review?.state ?? '').toLowerCase();
      const review =
        event === 'pull_request_review_approved' || reviewState === 'approved'
          ? 'approved'
          : event === 'pull_request_review_rejected' || reviewState === 'changes_requested'
            ? 'changes_requested'
            : null;
      return [
        {
          kind: 'pull_request',
          repository,
          number,
          title: String(pull.title ?? ''),
          url: str(pull.html_url),
          state: pull.merged
            ? 'merged'
            : pull.state === 'closed'
              ? 'closed'
              : pull.draft
                ? 'draft'
                : 'open',
          review,
          branch: str(pull.head?.ref),
          author: str(pull.user?.login),
        },
      ];
    }
    case 'workflow_run': {
      const run = body.workflow_run ?? {};
      return [
        {
          kind: 'build',
          repository,
          id: String(run.id ?? ''),
          name: String(run.name ?? 'CI'),
          state: buildState(run.status, run.conclusion),
          url: str(run.html_url),
          branch: str(run.head_branch),
          sha: str(run.head_sha),
        },
      ];
    }
    case 'check_run': {
      const check = body.check_run ?? {};
      return [
        {
          kind: 'build',
          repository,
          id: String(check.id ?? ''),
          name: String(check.name ?? 'Check'),
          state: buildState(check.status, check.conclusion),
          url: str(check.html_url),
          branch: str(check.check_suite?.head_branch),
          sha: str(check.head_sha),
        },
      ];
    }
    case 'status':
      return [
        {
          kind: 'build',
          repository,
          id: `${str(body.sha)}:${str(body.context) ?? 'status'}`,
          name: String(body.context ?? 'Status'),
          state: buildState(body.state === 'pending' ? 'in_progress' : 'completed', body.state),
          url: str(body.target_url),
          branch: str(body.branches?.[0]?.name),
          sha: str(body.sha),
        },
      ];
    default:
      return [];
  }
}

function buildState(status: unknown, conclusion: unknown): 'pending' | 'success' | 'failure' {
  const done = ['completed', 'success', 'failed', 'failure', 'error', 'canceled', 'cancelled'];
  if (!done.includes(String(status))) return 'pending';
  return ['success', 'neutral', 'skipped'].includes(String(conclusion ?? status))
    ? 'success'
    : 'failure';
}

function gitlab(event: string, body: Json): GitChange[] {
  const repository = str(body?.project?.path_with_namespace) ?? '';
  const repoUrl = str(body?.project?.web_url);
  switch (event) {
    case 'Push Hook': {
      const branch = branchOf(body.ref);
      if (!branch || (str(body.after) && ZERO.test(String(body.after)))) return [];
      const changes = commitsOf(repository, branch, body.commits);
      if (str(body.before) && ZERO.test(String(body.before))) {
        changes.unshift({
          kind: 'branch',
          repository,
          name: branch,
          url: repoUrl ? `${repoUrl}/-/tree/${branch}` : null,
          created: true,
          author: str(body.user_username),
        });
      }
      return changes;
    }
    case 'Merge Request Hook': {
      const mr = body.object_attributes ?? {};
      const number = str(mr.iid);
      if (!number) return [];
      const action = String(mr.action ?? '');
      return [
        {
          kind: 'pull_request',
          repository,
          number,
          title: String(mr.title ?? ''),
          url: str(mr.url),
          state:
            mr.state === 'merged'
              ? 'merged'
              : mr.state === 'closed'
                ? 'closed'
                : mr.draft || mr.work_in_progress
                  ? 'draft'
                  : 'open',
          review: action === 'approved' ? 'approved' : null,
          branch: str(mr.source_branch),
          author: str(body.user?.username),
        },
      ];
    }
    case 'Pipeline Hook': {
      const pipeline = body.object_attributes ?? {};
      const id = str(pipeline.id) ?? '';
      const status = String(pipeline.status ?? '');
      return [
        {
          kind: 'build',
          repository,
          id,
          name: 'Pipeline',
          state:
            status === 'success'
              ? 'success'
              : ['failed', 'canceled'].includes(status)
                ? 'failure'
                : 'pending',
          url: str(pipeline.url) ?? (repoUrl ? `${repoUrl}/-/pipelines/${id}` : null),
          branch: str(pipeline.ref),
          sha: str(pipeline.sha),
        },
      ];
    }
    default:
      return [];
  }
}

/** The changes a webhook delivery describes; unknown events describe none. */
export function changesOf(provider: GitProvider, event: string, body: Json): GitChange[] {
  return provider === 'gitlab' ? gitlab(event, body) : githubLike(event, body);
}

const KEY = /\b([A-Z][A-Z0-9]{1,9}-[1-9][0-9]*)\b/g;

/** Issue keys in a text, each once, e.g. from "feature/WEB-12-login" or a commit message. */
export function issueKeysIn(...texts: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    for (const match of (text ?? '').toUpperCase().matchAll(KEY)) keys.add(match[1] as string);
  }
  return [...keys];
}

export type SmartCommand =
  | { type: 'comment'; text: string }
  | { type: 'time'; duration: string; text: string }
  | { type: 'transition'; name: string };

/**
 * Smart commit commands (D-GIT-03): `#comment text`, `#time 2h 30m text` and `#<transition>`,
 * e.g. #done or #in-review; each runs up to the next command or the end of the line.
 */
export function smartCommands(message: string): SmartCommand[] {
  const commands: SmartCommand[] = [];
  for (const line of message.split('\n')) {
    const parts = line.split(/(?:^|\s)#(?=[a-z][\w-]*)/i).slice(1);
    for (const part of parts) {
      const [word = '', ...rest] = part.trim().split(/\s+/);
      const text = rest.join(' ').trim();
      const name = word.toLowerCase();
      if (name === 'comment') {
        if (text) commands.push({ type: 'comment', text });
      } else if (name === 'time') {
        const duration = /^((?:\d+(?:[.,]\d+)?[wdhm]\s*)+)(.*)$/i.exec(text);
        if (duration) {
          commands.push({
            type: 'time',
            duration: (duration[1] as string).trim(),
            text: (duration[2] ?? '').trim(),
          });
        }
      } else if (name) {
        commands.push({ type: 'transition', name });
      }
    }
  }
  return commands;
}
