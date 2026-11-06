import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_ISSUE_TYPES,
  BUILT_IN_LINK_TYPES,
  BUILT_IN_PRIORITIES,
  BUILT_IN_RESOLUTIONS,
  BUILT_IN_STATUSES,
  BUILT_IN_WORKFLOWS,
  builtInId,
} from './builtins.js';

describe('built-in ids', () => {
  it('stay the ids installed databases already use', () => {
    expect(builtInId('status', 'open')).toBe('d7a7d84f-89d7-5b5f-a799-b6a85bb1ce1d');
    expect(builtInId('issue-type', 'task')).toBe('2ec8d98f-e343-5e35-98f0-e39755466aae');
    expect(builtInId('resolution', 'done')).toBe('b8dca4fa-7c0a-5f12-9645-c9b75ff7f6ab');
    expect(builtInId('workflow-version', 'software:1')).toBe(
      '8546f209-000b-52a5-a535-bc977c8f7776',
    );
  });

  it('are unique across all built-ins', () => {
    const ids = [
      ...BUILT_IN_ISSUE_TYPES.map((entry) => builtInId('issue-type', entry.key)),
      ...BUILT_IN_STATUSES.map((entry) => builtInId('status', entry.key)),
      ...BUILT_IN_PRIORITIES.map((entry) => builtInId('priority', entry.key)),
      ...BUILT_IN_RESOLUTIONS.map((entry) => builtInId('resolution', entry.key)),
      ...BUILT_IN_LINK_TYPES.map((entry) => builtInId('link-type', entry.key)),
      ...BUILT_IN_WORKFLOWS.map((entry) => builtInId('workflow', entry.key)),
      ...BUILT_IN_WORKFLOWS.map((entry) => builtInId('workflow-version', `${entry.key}:1`)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('derive a stable id for anything not fixed yet', () => {
    expect(builtInId('status', 'new-one')).toBe(builtInId('status', 'new-one'));
    expect(builtInId('status', 'new-one')).not.toBe(builtInId('status', 'other-one'));
  });
});
