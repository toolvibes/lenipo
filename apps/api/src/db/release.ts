import { readFileSync } from 'node:fs';

/**
 * What the release says about updating (TL-110, E-155): the oldest version an update to this one
 * may start from, set by the release script when an earlier release removed something
 * (`-- lenipo:contract`). Null: any version.
 */
export interface ReleaseInfo {
  minimumUpgradeFrom: string | null;
}

export function readReleaseInfo(): ReleaseInfo {
  try {
    return JSON.parse(
      readFileSync(new URL('../../drizzle/release.json', import.meta.url), 'utf8'),
    ) as ReleaseInfo;
  } catch {
    return { minimumUpgradeFrom: null };
  }
}

/** Compares X.Y.Z versions numerically; anything after a hyphen is ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) =>
    value
      .replace(/^v/, '')
      .split('-')[0]
      ?.split('.')
      .map((part) => Number(part) || 0) ?? [];
  const left = parts(a);
  const right = parts(b);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}
