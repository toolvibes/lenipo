import type { WebhookFormat } from '@tasklore/shared';

type Locale = 'de' | 'en';

type Sentence = (actor: string, issue: string) => string;

const TEXT = {
  de: {
    someone: 'Jemand',
    verbs: {
      'issue.created': (a, i) => `${a} hat ${i} angelegt`,
      'issue.updated': (a, i) => `${a} hat ${i} geändert`,
      'issue.transitioned': (a, i) => `${a} hat den Status von ${i} geändert`,
      'issue.deleted': (a, i) => `${a} hat ${i} gelöscht`,
      'comment.created': (a, i) => `${a} hat ${i} kommentiert`,
      'comment.updated': (a, i) => `${a} hat einen Kommentar zu ${i} geändert`,
      'comment.deleted': (a, i) => `${a} hat einen Kommentar zu ${i} gelöscht`,
      'worklog.created': (a, i) => `${a} hat Zeit auf ${i} erfasst`,
      'worklog.updated': (a, i) => `${a} hat eine Zeiterfassung zu ${i} geändert`,
      'worklog.deleted': (a, i) => `${a} hat eine Zeiterfassung zu ${i} gelöscht`,
      'page.published': (a, i) => `${a} hat ${i} veröffentlicht`,
      'page.commented': (a, i) => `${a} hat ${i} kommentiert`,
      'sprint.started': (a, i) => `${a} hat ${i} gestartet`,
      'sprint.completed': (a, i) => `${a} hat ${i} abgeschlossen`,
      'version.released': (a, i) => `${a} hat ${i} veröffentlicht`,
    } as Record<string, Sentence>,
    test: (name: string) => `Testnachricht von Tasklore für den Webhook „${name}“.`,
    open: 'In Tasklore öffnen',
    none: '–',
  },
  en: {
    someone: 'Someone',
    verbs: {
      'issue.created': (a, i) => `${a} created ${i}`,
      'issue.updated': (a, i) => `${a} changed ${i}`,
      'issue.transitioned': (a, i) => `${a} changed the status of ${i}`,
      'issue.deleted': (a, i) => `${a} deleted ${i}`,
      'comment.created': (a, i) => `${a} commented on ${i}`,
      'comment.updated': (a, i) => `${a} edited a comment on ${i}`,
      'comment.deleted': (a, i) => `${a} deleted a comment on ${i}`,
      'worklog.created': (a, i) => `${a} logged time on ${i}`,
      'worklog.updated': (a, i) => `${a} changed logged time on ${i}`,
      'worklog.deleted': (a, i) => `${a} deleted logged time on ${i}`,
      'page.published': (a, i) => `${a} published ${i}`,
      'page.commented': (a, i) => `${a} commented on ${i}`,
      'sprint.started': (a, i) => `${a} started ${i}`,
      'sprint.completed': (a, i) => `${a} completed ${i}`,
      'version.released': (a, i) => `${a} released ${i}`,
    } as Record<string, Sentence>,
    test: (name: string) => `Test message from Tasklore for the webhook “${name}”.`,
    open: 'Open in Tasklore',
    none: '–',
  },
};

interface Payload {
  type: string;
  data: {
    actor?: { displayName: string } | null;
    issue?: { key: string; summary: string; status?: { name: string } };
    changes?: Array<{ field: string; from: string | null; to: string | null }>;
    comment?: { text?: string };
    worklog?: { timeSpentSeconds?: number };
    webhook?: { name: string };
    page?: { id: string; title: string; spaceKey: string };
    sprint?: { name: string; boardId: string };
    version?: { name: string; projectKey: string };
  };
}

interface Message {
  /** The first line, with the issue as a link where the platform supports it. */
  title: (link: (text: string) => string) => string;
  /** Further lines of plain text. */
  lines: string[];
  url: string | null;
  /** Plain text of the whole message, for notifications on phones. */
  fallback: string;
}

function hours(seconds: number): string {
  return `${Math.round((seconds / 3600) * 100) / 100} h`;
}

function describe(payload: Payload, locale: Locale, publicUrl: string): Message {
  const t = TEXT[locale];
  const { data } = payload;
  if (payload.type === 'webhook.test') {
    const text = t.test(data.webhook?.name ?? '');
    return { title: () => text, lines: [], url: null, fallback: text };
  }
  // Names are chosen by people: no markup or mentions of their own (TL-44, E-125).
  const name = data.actor?.displayName ?? t.someone;
  const actor =
    name
      .replace(/[<>&[\]()*_`|@!#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || t.someone;
  const sentence = t.verbs[payload.type] ?? (t.verbs['issue.updated'] as Sentence);
  // The subject: an issue, or a page, sprint or version (TL-41).
  const issue = data.issue
    ? `${data.issue.key} ${data.issue.summary}`
    : data.page
      ? data.page.title
      : data.sprint
        ? data.sprint.name
        : data.version
          ? `${data.version.projectKey} ${data.version.name}`
          : '';
  const path = data.issue
    ? `/issues/${data.issue.key}`
    : data.page
      ? `/spaces/${data.page.spaceKey}/pages/${data.page.id}`
      : data.sprint
        ? `/boards/${data.sprint.boardId}`
        : data.version
          ? `/projects/${data.version.projectKey}/releases`
          : null;
  const url = path && publicUrl ? `${publicUrl}${path}` : null;
  const lines: string[] = [];
  if (payload.type === 'issue.transitioned' && data.issue?.status)
    lines.push(`→ ${data.issue.status.name}`);
  if (payload.type === 'issue.updated') {
    for (const change of (data.changes ?? []).slice(0, 5)) {
      lines.push(`${change.field}: ${change.from ?? t.none} → ${change.to ?? t.none}`);
    }
  }
  if (
    (payload.type.startsWith('comment.') || payload.type === 'page.commented') &&
    data.comment?.text
  ) {
    const text = data.comment.text.replace(/\s+/g, ' ').trim();
    lines.push(text.length > 300 ? `${text.slice(0, 299)}…` : text);
  }
  if (payload.type.startsWith('worklog.') && data.worklog?.timeSpentSeconds) {
    lines.push(hours(data.worklog.timeSpentSeconds));
  }
  return {
    title: (link) => sentence(actor, link(issue)),
    lines,
    url,
    fallback: [sentence(actor, issue), ...lines].join('\n'),
  };
}

/** Slack's mrkdwn treats &, < and > as markup. */
const slackEscape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markdown links in Mattermost, Rocket.Chat and Teams need brackets escaped in their text. */
const markdownText = (text: string) => text.replace(/([[\]\\*_`])/g, '\\$1');

/**
 * A readable chat message for an incoming webhook (P-NTF-05, E-112) instead of the signed
 * JSON payload: Slack blocks, a Teams adaptive card, or Markdown for Mattermost and Rocket.Chat.
 */
export function chatMessage(
  format: Exclude<WebhookFormat, 'standard'>,
  locale: Locale,
  payload: unknown,
  publicUrl: string,
): object {
  const message = describe(payload as Payload, locale, publicUrl.replace(/\/+$/, ''));
  const t = TEXT[locale];
  if (format === 'slack') {
    const title = message.title((text) =>
      message.url ? `<${message.url}|${slackEscape(text)}>` : `*${slackEscape(text)}*`,
    );
    const text = [title, ...message.lines.map((line) => `> ${slackEscape(line)}`)].join('\n');
    return {
      text: message.fallback,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
    };
  }
  const title = message.title((text) =>
    message.url ? `[${markdownText(text)}](${message.url})` : `**${markdownText(text)}**`,
  );
  if (format === 'teams') {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              { type: 'TextBlock', text: title, wrap: true },
              ...message.lines.map((line) => ({
                type: 'TextBlock',
                text: markdownText(line),
                wrap: true,
                isSubtle: true,
                spacing: 'Small',
              })),
            ],
            actions: message.url
              ? [{ type: 'Action.OpenUrl', title: t.open, url: message.url }]
              : [],
          },
        },
      ],
    };
  }
  // Mattermost and Rocket.Chat take Markdown in `text`.
  return { text: [title, ...message.lines.map((line) => `> ${markdownText(line)}`)].join('\n') };
}
