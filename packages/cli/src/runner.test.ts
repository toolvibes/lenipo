import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commandLine, costOf, verifySignature } from './runner.js';

describe('agent runner (TL-99)', () => {
  it('builds the command line of each adapter', () => {
    expect(
      commandLine({ name: 'c', adapter: 'claude-code', args: ['--model', 'opus'] }, 'P'),
    ).toEqual(['claude', '-p', 'P', '--output-format', 'json', '--model', 'opus']);
    expect(commandLine({ name: 'x', adapter: 'codex', args: ['--full-auto'] }, 'P')).toEqual([
      'codex',
      'exec',
      '--full-auto',
      'P',
    ]);
    expect(commandLine({ name: 'g', adapter: 'gemini', args: ['--yolo'] }, 'P')).toEqual([
      'gemini',
      '--yolo',
      '-p',
      'P',
    ]);
    expect(
      commandLine(
        { name: 'o', adapter: 'command', command: ['aider', '--message', '{prompt}'] },
        'P',
      ),
    ).toEqual(['aider', '--message', 'P']);
  });

  it('reads the cost from the JSON of Claude Code', () => {
    expect(costOf('noise\n{"type":"result","total_cost_usd":0.4215}\n')).toBe(0.4215);
    expect(costOf('plain text')).toBeNull();
    expect(costOf('{"result":"ok"}')).toBeNull();
  });

  it('accepts only webhooks signed with the agent’s secret', () => {
    const secret = `whsec_${Buffer.from('geheimer-schluessel').toString('base64')}`;
    const now = Date.UTC(2026, 10, 3, 12);
    const timestamp = String(now / 1000);
    const body = '{"type":"notification.created"}';
    const digest = createHmac('sha256', Buffer.from('geheimer-schluessel'))
      .update(`msg_1.${timestamp}.${body}`)
      .digest('base64');
    const headers = { id: 'msg_1', timestamp, signature: `v1,${digest}` };
    expect(verifySignature(secret, headers, body, now)).toBe(true);
    expect(verifySignature(secret, headers, `${body} `, now)).toBe(false);
    expect(verifySignature(secret, headers, body, now + 600_000)).toBe(false);
    expect(verifySignature(secret, { ...headers, signature: undefined }, body, now)).toBe(false);
  });
});
