const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

function digit(value: string, index: number): number {
  const position = DIGITS.indexOf(value[index] ?? '');
  if (position === -1) throw new Error(`Invalid rank "${value}"`);
  return position;
}

/**
 * Returns a rank strictly between `before` and `after` (fractional indexing over base 36).
 * `null` means unbounded. Results never end in "0", so there is always room before any rank.
 * Moving an item therefore only ever rewrites that one item's rank.
 */
export function rankBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(`Rank "${before}" is not before "${after}"`);
  }
  let result = '';
  let lower = before;
  let upper = after;
  for (let index = 0; ; index++) {
    const low = lower !== null && index < lower.length ? digit(lower, index) : 0;
    const high = upper !== null && index < upper.length ? digit(upper, index) : BASE;
    if (high - low > 1) {
      return result + DIGITS[Math.floor((low + high) / 2)];
    }
    result += DIGITS[low];
    // Once this position is below the upper bound, everything after it is free above.
    if (low < high) upper = null;
    if (lower !== null && index >= lower.length) lower = null;
  }
}
