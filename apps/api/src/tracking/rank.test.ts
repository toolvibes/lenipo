import { describe, expect, it } from 'vitest';
import { rankBetween } from './rank.js';

describe('rankBetween', () => {
  it('starts in the middle', () => {
    expect(rankBetween(null, null)).toBe('i');
  });

  it('orders before, between and after', () => {
    const middle = rankBetween(null, null);
    const first = rankBetween(null, middle);
    const last = rankBetween(middle, null);
    const between = rankBetween(first, middle);
    expect([last, between, middle, first].sort()).toEqual([first, between, middle, last]);
  });

  it('finds room between adjacent ranks', () => {
    const rank = rankBetween('a', 'b');
    expect(rank > 'a' && rank < 'b').toBe(true);
    const tight = rankBetween('a', 'a1');
    expect(tight > 'a' && tight < 'a1').toBe(true);
  });

  it('keeps a consistent order over many random insertions', () => {
    const ranks: string[] = [rankBetween(null, null)];
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let i = 0; i < 2_000; i++) {
      const position = Math.floor(random() * (ranks.length + 1));
      const rank = rankBetween(ranks[position - 1] ?? null, ranks[position] ?? null);
      ranks.splice(position, 0, rank);
    }
    expect([...ranks].sort()).toEqual(ranks);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks.every((rank) => !rank.endsWith('0'))).toBe(true);
    expect(Math.max(...ranks.map((rank) => rank.length))).toBeLessThan(40);
  });

  it('rejects inverted bounds', () => {
    expect(() => rankBetween('b', 'a')).toThrow();
  });
});
