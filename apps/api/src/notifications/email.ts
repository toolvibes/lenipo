import type { NotificationCategory, NotificationDetails } from '@toolvibes/shared';
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
    openPage: 'Seite öffnen',
    commentedPage: (actor: string) => `${actor} hat auf der Seite kommentiert:`,
    published: (actor: string, version: number) =>
      version === 1
        ? `${actor} hat die Seite veröffentlicht.`
        : `${actor} hat Version ${version} veröffentlicht.`,
    onText: 'zu',
    footer:
      'Sie erhalten diese E-Mail, weil Sie den Vorgang beobachten oder erwähnt wurden. Welche E-Mails Sie bekommen, stellen Sie in Lenipo unter der Glocke ein.',
    footerPage:
      'Sie erhalten diese E-Mail, weil Sie die Seite beobachten, erwähnt wurden oder an der Diskussion beteiligt sind. Welche E-Mails Sie bekommen, stellen Sie in Lenipo unter der Glocke ein.',
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
      startDate: 'Start',
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
    openPage: 'Open page',
    commentedPage: (actor: string) => `${actor} commented on the page:`,
    published: (actor: string, version: number) =>
      version === 1 ? `${actor} published the page.` : `${actor} published version ${version}.`,
    onText: 'on',
    footer:
      'You receive this email because you watch the issue or were mentioned. Choose which emails you get under the bell in Lenipo.',
    footerPage:
      'You receive this email because you watch the page, were mentioned or took part in the discussion. Choose which emails you get under the bell in Lenipo.',
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
      startDate: 'Start date',
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
function block(
  locale: Locale,
  entry: EmailEntry,
  onPage: boolean,
): { text: string[]; html: string } {
  const t = TEXT[locale];
  const actor = entry.actor ?? t.someone;
  const { details } = entry;
  if (details.kind === 'commented') {
    const intro =
      entry.category === 'mention'
        ? t.mentioned(actor)
        : onPage
          ? t.commentedPage(actor)
          : t.commented(actor);
    const quote = details.excerpt ?? '';
    // Inline comments name the passage they are about (E-63).
    const passage = details.quote ? `${t.onText} „${details.quote}“` : null;
    return {
      text: [intro, ...(passage ? [passage] : []), ...quote.split('\n').map((line) => `> ${line}`)],
      html: `<p>${escapeHtml(intro)}</p>${passage ? `<p style="margin:0 0 8px;color:#55555e">${escapeHtml(passage)}</p>` : ''}<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #1f5fbf;color:#44444c">${escapeHtml(quote).replace(/\n/g, '<br>')}</blockquote>`,
    };
  }
  if (details.kind === 'published') {
    const intro = t.published(actor, details.version ?? 1);
    const comment = details.excerpt ? [`> ${details.excerpt}`] : [];
    return {
      text: [intro, ...comment],
      html: `<p>${escapeHtml(intro)}</p>${details.excerpt ? `<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #1f5fbf;color:#44444c">${escapeHtml(details.excerpt)}</blockquote>` : ''}`,
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

/** One bundled email about one issue or wiki page for one person (E-44, E-63), in their language. */
export function notificationEmail(
  options: {
    to: string;
    locale: string;
    entries: EmailEntry[];
    publicUrl?: string;
  } & (
    | { issue: { key: string; summary: string } }
    | { page: { id: string; title: string; spaceKey: string } }
  ),
): MailMessage {
  const locale: Locale = options.locale.startsWith('en') ? 'en' : 'de';
  const t = TEXT[locale];
  const onPage = 'page' in options;
  const blocks = options.entries.map((entry) => block(locale, entry, onPage));
  const base = options.publicUrl?.replace(/\/+$/, '');
  const link = !base
    ? null
    : 'page' in options
      ? `${base}/spaces/${encodeURIComponent(options.page.spaceKey)}/pages/${options.page.id}`
      : `${base}/issues/${encodeURIComponent(options.issue.key)}`;
  const title =
    'page' in options ? options.page.title : `${options.issue.key} ${options.issue.summary}`;
  const subject =
    'page' in options
      ? `[${options.page.spaceKey}] ${options.page.title}`
      : `[${options.issue.key}] ${options.issue.summary}`;
  const open = onPage ? t.openPage : t.open;
  const footer = onPage ? t.footerPage : t.footer;
  const text = [
    title,
    '',
    ...blocks.flatMap((entry) => [...entry.text, '']),
    ...(link ? [`${open}: ${link}`, ''] : []),
    '--',
    footer,
  ].join('\n');
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f5f5f6;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#18181b">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dcdce0;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;font-size:13px;color:#55555e">Lenipo</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:28px">${escapeHtml(title)}</h1>
${blocks.map((entry) => entry.html).join('\n')}
${link ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f5fbf;color:#ffffff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px">${escapeHtml(open)}</a></p>` : ''}
</div>
<p style="max-width:600px;margin:16px auto 0;font-size:12px;color:#55555e">${escapeHtml(footer)}</p>
</body></html>`;
  return { to: options.to, subject, text, html };
}

const MORE = {
  de: {
    digestSubject: (count: number) =>
      count === 1 ? 'Lenipo: 1 Neuigkeit' : `Lenipo: ${count} Neuigkeiten`,
    digestTitle: 'Ihre Zusammenfassung',
    footerDigest:
      'Sie erhalten diese Zusammenfassung statt einzelner E-Mails. Häufigkeit und Uhrzeit stellen Sie in Lenipo unter der Glocke ein.',
    filterTotal: (shown: number, total: number) =>
      shown < total
        ? `${shown} von ${total} Vorgängen`
        : total === 1
          ? '1 Vorgang'
          : `${total} Vorgänge`,
    filterEmpty: 'Der Filter hat zurzeit keine Treffer.',
    filterOpen: 'Filter öffnen',
    filterFooter:
      'Sie erhalten diese E-Mail, weil Sie oder eine Ihrer Gruppen den Filter abonniert haben. Abonnements verwalten Sie am Filter in Lenipo.',
    status: 'Status',
    assignee: 'Bearbeitung',
  },
  en: {
    digestSubject: (count: number) =>
      count === 1 ? 'Lenipo: 1 update' : `Lenipo: ${count} updates`,
    digestTitle: 'Your summary',
    footerDigest:
      'You receive this summary instead of single e-mails. Set how often and when in Lenipo under the bell.',
    filterTotal: (shown: number, total: number) =>
      shown < total ? `${shown} of ${total} issues` : total === 1 ? '1 issue' : `${total} issues`,
    filterEmpty: 'The filter has no results at the moment.',
    filterOpen: 'Open filter',
    filterFooter:
      'You receive this e-mail because you or one of your groups subscribed to the filter. Manage subscriptions at the filter in Lenipo.',
    status: 'Status',
    assignee: 'Assignee',
  },
};

function frame(locale: Locale, title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f5f5f6;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#18181b">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dcdce0;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;font-size:13px;color:#55555e">Lenipo</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:28px">${escapeHtml(title)}</h1>
${body}
</div>
<p style="max-width:640px;margin:16px auto 0;font-size:12px;color:#55555e">${escapeHtml(footer)}</p>
</body></html>`;
}

export type DigestGroup = { key: string; entries: EmailEntry[] } & (
  | { issue: { key: string; summary: string } }
  | { page: { id: string; title: string; spaceKey: string } }
);

/** Everything collected for one person since the last digest, grouped by issue and page (E-112). */
export function digestEmail(options: {
  to: string;
  locale: string;
  publicUrl?: string;
  groups: DigestGroup[];
}): MailMessage {
  const locale: Locale = options.locale.startsWith('en') ? 'en' : 'de';
  const more = MORE[locale];
  const base = options.publicUrl?.replace(/\/+$/, '');
  const count = options.groups.reduce((sum, group) => sum + group.entries.length, 0);
  const sections = options.groups.map((group) => {
    const onPage = 'page' in group;
    const title = 'page' in group ? group.page.title : `${group.issue.key} ${group.issue.summary}`;
    const link = !base
      ? null
      : 'page' in group
        ? `${base}/spaces/${encodeURIComponent(group.page.spaceKey)}/pages/${group.page.id}`
        : `${base}/issues/${encodeURIComponent(group.issue.key)}`;
    const blocks = group.entries.map((entry) => block(locale, entry, onPage));
    return {
      text: [title, ...(link ? [link] : []), '', ...blocks.flatMap((entry) => [...entry.text, ''])],
      html: `<h2 style="margin:24px 0 8px;font-size:16px;line-height:22px">${link ? `<a href="${escapeHtml(link)}" style="color:#1f5fbf;text-decoration:none">${escapeHtml(title)}</a>` : escapeHtml(title)}</h2>${blocks.map((entry) => entry.html).join('')}`,
    };
  });
  return {
    to: options.to,
    subject: more.digestSubject(count),
    text: [
      more.digestTitle,
      '',
      ...sections.flatMap((section) => section.text),
      '--',
      more.footerDigest,
    ].join('\n'),
    html: frame(
      locale,
      more.digestTitle,
      sections.map((section) => section.html).join('\n'),
      more.footerDigest,
    ),
  };
}

export interface FilterEmailIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
}

/** The results of a subscribed filter (T-QRY-07, E-112). */
export function filterEmail(options: {
  to: string;
  locale: string;
  publicUrl?: string;
  filter: { id: string; name: string };
  issues: FilterEmailIssue[];
  total: number;
}): MailMessage {
  const locale: Locale = options.locale.startsWith('en') ? 'en' : 'de';
  const t = TEXT[locale];
  const more = MORE[locale];
  const base = options.publicUrl?.replace(/\/+$/, '');
  const link = base ? `${base}/issues?filter=${options.filter.id}` : null;
  const summary =
    options.total === 0 ? more.filterEmpty : more.filterTotal(options.issues.length, options.total);
  const cell = 'padding:6px 8px;border-bottom:1px solid #e4e4e7;text-align:left;vertical-align:top';
  const rows = options.issues
    .map((issue) => {
      const key = base
        ? `<a href="${escapeHtml(`${base}/issues/${encodeURIComponent(issue.key)}`)}" style="color:#1f5fbf;text-decoration:none">${escapeHtml(issue.key)}</a>`
        : escapeHtml(issue.key);
      return `<tr><td style="${cell};white-space:nowrap">${key}</td><td style="${cell}">${escapeHtml(issue.summary)}</td><td style="${cell}">${escapeHtml(issue.status)}</td><td style="${cell}">${escapeHtml(issue.assignee ?? t.none)}</td></tr>`;
    })
    .join('');
  const table = options.issues.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="${cell}"></th><th style="${cell}"></th><th style="${cell}">${more.status}</th><th style="${cell}">${more.assignee}</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';
  const button = link
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f5fbf;color:#ffffff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px">${escapeHtml(more.filterOpen)}</a></p>`
    : '';
  return {
    to: options.to,
    subject: `[Lenipo] ${options.filter.name}: ${summary}`,
    text: [
      options.filter.name,
      summary,
      '',
      ...options.issues.map(
        (issue) => `${issue.key}  ${issue.summary}  (${issue.status}, ${issue.assignee ?? t.none})`,
      ),
      '',
      ...(link ? [`${more.filterOpen}: ${link}`, ''] : []),
      '--',
      more.filterFooter,
    ].join('\n'),
    html: frame(
      locale,
      options.filter.name,
      `<p style="margin:0 0 12px;color:#55555e">${escapeHtml(summary)}</p>${table}${button}`,
      more.filterFooter,
    ),
  };
}

/** An invitation or a self-registration link (P-USR-15, TL-67, E-119). */
export function invitationEmail(options: {
  to: string;
  instanceName: string;
  inviter: string | null;
  project: string | null;
  link: string;
  days: number;
  /** The person already had an account and was added to the project directly. */
  joined: boolean;
}): MailMessage {
  const intro = options.joined
    ? `${options.inviter ?? 'Jemand'} hat Sie zum Projekt „${options.project}“ in ${options.instanceName} hinzugefügt.`
    : options.inviter
      ? `${options.inviter} lädt Sie zu ${options.instanceName}${options.project ? ` in das Projekt „${options.project}“` : ''} ein.`
      : `Bitte bestätigen Sie Ihre Registrierung bei ${options.instanceName}.`;
  const action = options.joined
    ? 'Projekt öffnen'
    : options.inviter
      ? 'Einladung annehmen'
      : 'Registrierung abschließen';
  const note = options.joined
    ? ''
    : `Der Link gilt ${options.days} Tage und nur einmal. Wenn Sie damit nichts anfangen können, ignorieren Sie diese E-Mail.`;
  return {
    to: options.to,
    subject: options.joined
      ? `[${options.instanceName}] Neu im Projekt ${options.project}`
      : options.inviter
        ? `Einladung zu ${options.instanceName}`
        : `Registrierung bei ${options.instanceName}`,
    text: [intro, '', `${action}: ${options.link}`, '', note].join('\n').trim(),
    html: frame(
      'de',
      options.instanceName,
      `<p>${escapeHtml(intro)}</p><p style="margin:24px 0"><a href="${escapeHtml(options.link)}" style="display:inline-block;background:#1f5fbf;color:#ffffff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px">${escapeHtml(action)}</a></p>`,
      note,
    ),
  };
}
