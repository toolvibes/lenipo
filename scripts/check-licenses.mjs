// Fails when a production dependency uses a license outside the permissive allowlist.
// Keeps every license option open for a later open-source release (see docs/08-entscheidungen.md, E-02).
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Python-2.0',
]);

const output = execFileSync('pnpm', ['licenses', 'list', '--json', '--prod'], { encoding: 'utf8' });
const byLicense = JSON.parse(output);

/** Accepts SPDX expressions like "(MIT OR Apache-2.0)" if at least one option is allowed. */
function isAllowed(license) {
  const options = license.replace(/[()]/g, '').split(/\s+OR\s+/);
  return options.some((option) => ALLOWED.has(option.trim()));
}

const violations = Object.entries(byLicense)
  .filter(([license]) => !isAllowed(license))
  .flatMap(([license, packages]) => packages.map((pkg) => `${pkg.name}@${pkg.versions.join(',')} (${license})`));

if (violations.length > 0) {
  console.error(`Disallowed licenses in production dependencies:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
console.log(`License check passed (${Object.keys(byLicense).join(', ')}).`);
