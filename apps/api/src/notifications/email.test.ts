import { describe, expect, it } from 'vitest';
import { notificationEmail } from './email.js';

describe('notificationEmail', () => {
  const issue = { key: 'WEB-1', summary: 'Login <schlägt> fehl' };

  it('bundles several notifications into one email in the recipient’s language', () => {
    const mail = notificationEmail({
      to: 'jonas@example.org',
      locale: 'de',
      issue,
      publicUrl: 'https://lenipo.example.org/',
      entries: [
        { actor: 'Lena Vogt', category: 'assigned', details: { kind: 'created', items: [] } },
        {
          actor: 'Lena Vogt',
          category: 'status',
          details: {
            kind: 'updated',
            items: [
              { field: 'status', from: 'Offen', to: 'In Arbeit' },
              { field: 'description', from: 'alt', to: 'neu' },
            ],
          },
        },
        {
          actor: null,
          category: 'mention',
          details: { kind: 'commented', items: [], excerpt: 'Bitte @Jonas ansehen\nDanke' },
        },
      ],
    });
    expect(mail.subject).toBe('[WEB-1] Login <schlägt> fehl');
    expect(mail.text).toContain('Lena Vogt hat Ihnen den Vorgang zugewiesen.');
    expect(mail.text).toContain('- Status: Offen → In Arbeit');
    expect(mail.text).toContain('- Beschreibung geändert');
    expect(mail.text).toContain('Jemand hat Sie erwähnt:\n> Bitte @Jonas ansehen\n> Danke');
    expect(mail.text).toContain('Vorgang öffnen: https://lenipo.example.org/issues/WEB-1');
    // Everything from users is escaped in the HTML part.
    expect(mail.html).toContain('Login &#60;schlägt&#62; fehl');
    expect(mail.html).not.toContain('<schlägt>');
  });

  it('writes English for English-speaking people and omits the link without a public URL', () => {
    const mail = notificationEmail({
      to: 'mira@example.org',
      locale: 'en',
      issue,
      entries: [
        {
          actor: 'Jonas',
          category: 'comment',
          details: { kind: 'commented', items: [], excerpt: 'Done' },
        },
      ],
    });
    expect(mail.text).toContain('Jonas commented:\n> Done');
    expect(mail.text).not.toContain('Open issue');
  });
});
