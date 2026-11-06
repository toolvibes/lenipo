// Every migration must work with the app version before it, so instances can be updated one by
// one (zero-downtime updates, TL-42, E-123): expand first, contract one release later.
// Statements that break the previous version need the marker line "-- lenipo:contract",
// which says the previous release no longer uses what is removed.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'apps/api/drizzle';
/** Migrations up to here were written before the rule and only ran with downtime. */
const BASELINE = 65;
const MARKER = /^--\s*lenipo:contract\b/m;

const RULES = [
  [/\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b/i, 'drops something the previous version may use'],
  [/\bRENAME\b/i, 'renames something the previous version uses by its old name'],
  [/\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i, 'changes a column type'],
  [/\bSET\s+NOT\s+NULL\b/i, 'makes a column required that the previous version may leave empty'],
  [
    {
      // Each ADD COLUMN clause up to the next comma or the end of the statement.
      test: (statement) =>
        [...statement.matchAll(/\bADD\s+COLUMN\b([^;,]*)/gi)].some(
          ([, clause]) => /\bNOT\s+NULL\b/i.test(clause) && !/\bDEFAULT\b/i.test(clause),
        ),
    },
    'adds a required column without a default, which the previous version cannot fill',
  ],
];

const problems = [];
for (const file of readdirSync(DIR)
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort()) {
  if (Number(file.slice(0, 4)) <= BASELINE) continue;
  const text = readFileSync(join(DIR, file), 'utf8');
  if (MARKER.test(text)) continue;
  for (const statement of text.split('--> statement-breakpoint')) {
    for (const [pattern, reason] of RULES) {
      if (pattern.test(statement)) problems.push(`${file}: ${reason}:\n  ${statement.trim()}`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    `Migrations that would break a rolling update (expand/contract, E-123):\n\n${problems.join('\n\n')}\n\nSplit the change: add first, remove in a later release with "-- lenipo:contract".`,
  );
  process.exit(1);
}
console.log('Migration check passed.');
