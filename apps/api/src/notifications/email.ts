import type { NotificationCategory, NotificationDetails } from '@tasklore/shared';
import type { MailMessage } from './mailer.js';

type Locale = 'de' | 'en';

const TEXT = {
  de: {
    created: (actor: string) => `${actor} hat den Vorgang erstellt.`,
    updated: (actor: string) => `${actor} hat den Vorgang geändert:`,
    commented: (actor: string) => `${actor} hat kommentiert:`,
    mentioned: (actor: string) => `${actor} hat Sie erwähnt:`,
    assigned: (actor: string) => `${actor} hat Ihnen den Vorgang zugewiesen.`,
    descriptionChanged: 'Beschreibung geändert',
    none: '–',
    open: 'Vorgang öffnen',
    footer:
      'Sie erhalten diese E-Mail, weil Sie den Vorgang beobachten oder erwähnt wurden. Welche E-Mails Sie bekommen, stellen Sie in Tasklore unter der Glocke ein.',
    someone: 'Jemand',
    fields: {
      summary: 'Zusammenfassung',
      description: 'Beschreibung',
      issuetype: 'Typ',
      priority: 'Priorität',
      assignee: 'Bearbeiter',
      parent: 'Übergeordnet',
      labels: 'Labels',
      storyPoints: 'Story Points',
      dueDate: 'Fällig am',
      status: 'Status',
      resolution: 'Lösung',
      components: 'Komponenten',
      link: 'Verknüpfung',
      attachment: 'Anhang',
    } as Record<string, string>,
  },
  en: {
    created: (actor: string) => `${actor} created the issue.`,
    updated: (actor: string) => `${actor} changed the issue:`,
    commented: (actor: string) => `${actor} commented:`,
    mentioned: (actor: string) => `${actor} mentioned you:`,
    assigned: (actor: string) => `${actor} assigned the issue to you.`,
    descriptionChanged: 'Description changed',
    none: '–',
    open: 'Open issue',
    footer:
      'You receive this email because you watch the issue or were mentioned. Choose which emails you get under the bell in Tasklore.',
    someone: 'Someone',
    fields: {
      summary: 'Summary',
      description: 'Description',
      issuetype: 'Type',
      priority: 'Priority',
      assignee: 'Assignee',
      parent: 'Parent',
      labels: 'Labels',
      storyPoints: 'Story points',
      dueDate: 'Due date',
      status: 'Status',
      resolution: 'Resolution',
      components: 'Components',
      link: 'Link',
      attachment: 'Attachment',
    } as Record<string, string>,
  },
} as const;

export interface EmailEntry {
  actor: string | null;
  category: NotificationCategory;
  details: NotificationDetails;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** One block of the email per notification, as lines of plain text and HTML. */
function block(locale: Locale, entry: EmailEntry): { text: string[]; html: string } {
  const t = TEXT[locale];
  const actor = entry.actor ?? t.someone;
  const { details } = entry;
  if (details.kind === 'commented') {
    const intro = entry.category === 'mention' ? t.mentioned(actor) : t.commented(actor);
    const quote = details.excerpt ?? '';
    return {
      text: [intro, ...quote.split('\n').map((line) => `> ${line}`)],
      html: `<p>${escapeHtml(intro)}</p><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #2f6f73;color:#33403f">${escapeHtml(quote).replace(/\n/g, '<br>')}</blockquote>`,
    };
  }
  if (details.kind === 'created') {
    const intro = entry.category === 'assigned' ? t.assigned(actor) : t.created(actor);
    return { text: [intro], html: `<p>${escapeHtml(intro)}</p>` };
  }
  const intro =
    entry.category === 'mention'
      ? t.mentioned(actor)
      : entry.category === 'assigned'
        ? t.assigned(actor)
        : t.updated(actor);
  const lines = details.items.map((item) =>
    item.field === 'description'
      ? t.descriptionChanged
      : `${t.fields[item.field] ?? item.field}: ${item.from ?? t.none} → ${item.to ?? t.none}`,
  );
  return {
    text: [intro, ...lines.map((line) => `- ${line}`)],
    html: `<p>${escapeHtml(intro)}</p><ul style="margin:0 0 16px;padding-left:20px">${lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul>`,
  };
}

/** One bundled email about one issue for one person (E-44), in their language. */
export function notificationEmail(options: {
  to: string;
  locale: string;
  issue: { key: string; summary: string };
  entries: EmailEntry[];
  publicUrl?: string;
}): MailMessage {
  const locale: Locale = options.locale.startsWith('en') ? 'en' : 'de';
  const t = TEXT[locale];
  const blocks = options.entries.map((entry) => block(locale, entry));
  const link = options.publicUrl
    ? `${options.publicUrl.replace(/\/+$/, '')}/issues/${encodeURIComponent(options.issue.key)}`
    : null;
  const title = `${options.issue.key} ${options.issue.summary}`;
  const text = [
    title,
    '',
    ...blocks.flatMap((entry) => [...entry.text, '']),
    ...(link ? [`${t.open}: ${link}`, ''] : []),
    '--',
    t.footer,
  ].join('\n');
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f3f4f1;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#1d2524">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d9ddd6;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;font-size:13px;color:#5b6664">Tasklore</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:28px">${escapeHtml(title)}</h1>
${blocks.map((entry) => entry.html).join('\n')}
${link ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2f6f73;color:#ffffff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px">${escapeHtml(t.open)}</a></p>` : ''}
</div>
<p style="max-width:600px;margin:16px auto 0;font-size:12px;color:#5b6664">${escapeHtml(t.footer)}</p>
</body></html>`;
  return { to: options.to, subject: `[${options.issue.key}] ${options.issue.summary}`, text, html };
}
