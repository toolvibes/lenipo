// Releases (TL-110, E-155): one product version for the whole repository (SemVer).
//
//   pnpm release minor|patch|major|<x.y.z> [--dry-run]
//     sets the version in every package and the Helm chart, writes the section of CHANGELOG.md
//     from the commits since the last tag (feat, fix, perf), records the minimum version an
//     update may start from when migrations removed something, commits "release: x.y.z" and
//     tags vx.y.z, with the API description regenerated for the new version (the Go and Python
//     SDKs follow with pnpm sdk:generate). Pushing the tag starts the release workflow.
//   node scripts/release.mjs notes <x.y.z>
//     prints the CHANGELOG section of that version, for the GitHub release.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHANGELOG = 'CHANGELOG.md';
const RELEASE = 'apps/api/drizzle/release.json';
const CHART = 'deploy/helm/lenipo/Chart.yaml';
const MIGRATIONS = 'apps/api/drizzle';
const MARKER = /^--\s*(?:lenipo|tasklore):contract\b/m;
const GROUPS = [
  ['feat', 'Neu'],
  ['fix', 'Behoben'],
  ['perf', 'Schneller'],
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

/** The section of one version in the changelog. */
function notes(version) {
  const text = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : '';
  const start = text.indexOf(`## ${version} `);
  if (start < 0) fail(`No section for ${version} in ${CHANGELOG}`);
  const next = text.indexOf('\n## ', start + 1);
  return text
    .slice(start, next < 0 ? undefined : next)
    .split('\n')
    .slice(1)
    .join('\n')
    .trim();
}

function bump(current, step) {
  if (/^\d+\.\d+\.\d+$/.test(step)) return step;
  const [major, minor, patch] = current.split('.').map(Number);
  if (step === 'major') return `${major + 1}.0.0`;
  if (step === 'minor') return `${major}.${minor + 1}.0`;
  if (step === 'patch') return `${major}.${minor}.${patch + 1}`;
  fail('pnpm release minor|patch|major|<x.y.z> [--dry-run]');
}

/** A commit subject as release notes show it: without type and internal references. */
export function cleanSubject(subject) {
  return subject
    .replace(/^\w+(\([^)]*\))?!?:\s*/, '')
    .replace(/\s*\((?:TL|E)-\d+(?:\s*,\s*(?:TL|E)-\d+)*\)/g, '')
    .replace(/\s*\b(?:TL|E)-\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const packageFiles = () =>
  ['apps', 'packages']
    .flatMap((dir) => readdirSync(dir).map((name) => join(dir, name, 'package.json')))
    .filter((file) => existsSync(file));

const [command, argument] = process.argv.slice(2);
if (command === 'notes') {
  console.log(notes((argument ?? '').replace(/^v/, '')));
  process.exit(0);
}

const dryRun = process.argv.includes('--dry-run');
if (!dryRun) {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Releases come from main.');
  const dirty = git('status', '--porcelain')
    .split('\n')
    .filter((line) => line && !line.includes('.claude/'));
  if (dirty.length > 0) fail(`Commit or stash first:\n${dirty.join('\n')}`);
}

const current = JSON.parse(readFileSync('apps/api/package.json', 'utf8')).version;
const version = bump(current, command);
const tags = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n').filter(Boolean);
const previous = tags[0] ?? null;
if (tags.includes(`v${version}`)) fail(`v${version} exists already.`);
const range = previous ? [`${previous}..HEAD`] : ['HEAD'];

const commits = git('log', ...range, '--format=%s')
  .split('\n')
  .filter(Boolean)
  .reverse();
const sections = [];
// The first release would list the whole history; the handbooks say what is in it.
if (!previous) {
  sections.push(
    'Erste veröffentlichte Version. Was Lenipo kann, steht im Benutzer- und im Admin-Handbuch.',
  );
}
for (const [type, title] of previous ? GROUPS : []) {
  const lines = commits
    .filter((subject) => new RegExp(`^${type}(\\([^)]*\\))?!?:`).test(subject))
    .map(
      (subject) =>
        `- ${/^\w+(\([^)]*\))?!:/.test(subject) ? '**Achtung:** ' : ''}${cleanSubject(subject)}`,
    );
  if (lines.length > 0) sections.push(`### ${title}\n\n${lines.join('\n')}`);
}

// Migrations since the last release that remove something: no way back, and an update has to
// start from the release before (its code may have prepared the data for the removal).
const added = previous
  ? git('diff', '--name-only', '--diff-filter=A', `${previous}..HEAD`, '--', MIGRATIONS)
      .split('\n')
      .filter((file) => file.endsWith('.sql'))
  : [];
const contract = added.filter((file) => MARKER.test(readFileSync(file, 'utf8')));
const release = JSON.parse(readFileSync(RELEASE, 'utf8'));
if (contract.length > 0 && previous) release.minimumUpgradeFrom = previous.replace(/^v/, '');
const updateNotes = [];
if (contract.length > 0) {
  updateNotes.push(
    'Diese Version räumt die Datenbank auf: Ein Rückweg auf eine frühere Version geht danach nur über eine Sicherung von vor dem Update.',
  );
}
if (release.minimumUpgradeFrom) {
  updateNotes.push(
    `Updates auf diese Version gehen ab Lenipo ${release.minimumUpgradeFrom}; ältere Installationen aktualisieren erst auf ${release.minimumUpgradeFrom}.`,
  );
}
if (updateNotes.length > 0)
  sections.push(`### Update\n\n${updateNotes.map((line) => `- ${line}`).join('\n')}`);
if (sections.length === 0) sections.push('Keine Änderungen an Funktionen.');

const date = new Date().toISOString().slice(0, 10);
const section = `## ${version} – ${date}\n\n${sections.join('\n\n')}\n`;
if (dryRun) {
  console.log(section);
  process.exit(0);
}

const header = '# Changelog\n\nAlle Versionen von Lenipo; die neueste oben.\n';
const old = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8').replace(header, '') : '';
writeFileSync(CHANGELOG, `${header}\n${section}${old ? `\n${old.trimStart()}` : ''}`);
for (const file of packageFiles()) {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
}
writeFileSync(RELEASE, `${JSON.stringify(release, null, 2)}\n`);
writeFileSync(
  CHART,
  readFileSync(CHART, 'utf8')
    .replace(/^version:.*$/m, `version: ${version}`)
    .replace(/^appVersion:.*$/m, `appVersion: "${version}"`),
);

// The API description carries the version; CI compares it with the code.
console.log('Generating the API description …');
execFileSync('pnpm', ['-s', 'api:generate'], { stdio: 'inherit' });
git('add', CHANGELOG, RELEASE, CHART, 'packages/sdk', ...packageFiles());
git('commit', '--quiet', '-m', `release: ${version}`);
git('tag', '--annotate', `v${version}`, '--message', `Lenipo ${version}`);
console.log(`Tagged v${version}. Publish with: git push origin main v${version}`);
