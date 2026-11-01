import { describe, expect, it } from 'vitest';
import { chatMessage } from './chat.js';

const transitioned = {
  type: 'issue.transitioned',
  data: {
    actor: { displayName: 'Lena Vogt' },
    issue: { key: 'WEB-1', summary: 'Login <bauen> [neu]', status: { name: 'Erledigt' } },
  },
};

describe('chat messages (P-NTF-05)', () => {
  it('writes Slack mrkdwn with an escaped link', () => {
    const message = chatMessage('slack', 'de', transitioned, 'https://lenipo.example.org/') as {
      text: string;
      blocks: Array<{ text: { text: string } }>;
    };
    expect(message.text).toBe(
      'Lena Vogt hat den Status von WEB-1 Login <bauen> [neu] geändert\n→ Erledigt',
    );
    expect(message.blocks[0]?.text.text).toBe(
      'Lena Vogt hat den Status von <https://lenipo.example.org/issues/WEB-1|WEB-1 Login &lt;bauen&gt; [neu]> geändert\n> → Erledigt',
    );
  });

  it('writes Markdown for Mattermost and Rocket.Chat', () => {
    const message = chatMessage('mattermost', 'en', transitioned, 'https://lenipo.example.org') as {
      text: string;
    };
    expect(message.text).toBe(
      'Lena Vogt changed the status of [WEB-1 Login <bauen> \\[neu\\]](https://lenipo.example.org/issues/WEB-1)\n> → Erledigt',
    );
  });

  it('writes an adaptive card for Teams with a button', () => {
    const message = chatMessage('teams', 'de', transitioned, 'https://lenipo.example.org') as {
      attachments: Array<{
        content: { body: Array<{ text: string }>; actions: Array<{ url: string }> };
      }>;
    };
    const card = message.attachments[0]?.content;
    expect(card?.body.map((block) => block.text)).toEqual([
      'Lena Vogt hat den Status von [WEB-1 Login <bauen> \\[neu\\]](https://lenipo.example.org/issues/WEB-1) geändert',
      '→ Erledigt',
    ]);
    expect(card?.actions[0]?.url).toBe('https://lenipo.example.org/issues/WEB-1');
  });

  it('shortens comments and names the test message', () => {
    const comment = chatMessage(
      'rocketchat',
      'de',
      {
        type: 'comment.created',
        data: {
          actor: null,
          issue: { key: 'WEB-2', summary: 'Suche' },
          comment: { text: 'x'.repeat(400) },
        },
      },
      '',
    ) as { text: string };
    expect(comment.text.split('\n')[0]).toBe('Jemand hat **WEB-2 Suche** kommentiert');
    expect(comment.text.split('\n')[1]).toHaveLength(2 + 300);
    const test = chatMessage(
      'slack',
      'en',
      { type: 'webhook.test', data: { webhook: { name: 'Team' } } },
      '',
    ) as {
      text: string;
    };
    expect(test.text).toBe('Test message from Lenipo for the webhook “Team”.');
  });
});
