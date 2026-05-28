import { readFileSync, writeFileSync } from 'node:fs';

const changelogPath = 'CHANGELOG.md';
let content;

try {
  content = readFileSync(changelogPath, 'utf8');
} catch (error) {
  console.error(`Failed to read ${changelogPath}: ${error.message}`);
  process.exit(1);
}

const lines = content.split(/\r?\n/);

const headerEnd = lines.findIndex((line) => line.startsWith('## Pull requests'));
const autoStart = lines.findIndex((line) => line.includes('[#212]') && line.includes('v1.48.15'));

if (headerEnd === -1 || autoStart === -1) {
  console.error('Could not locate backfill/automation split in CHANGELOG.md');
  process.exit(1);
}

const header = [
  '# Changelog',
  '',
  'Notable work on `main` is summarized **by merged pull request**, one line each.',
  '',
  'Entries before **v1.48.15** were backfilled from merged PR titles on GitHub (one line per PR; SemVer tags from that period are omitted because they no longer map reliably to PRs). From **v1.48.15** onward, CI appends version-tagged lines automatically when semantic-release bumps the version (from the merged PR title / squash commit message).',
  '',
  '## Early `main` (before merge commits)',
  '',
  '- `chore`: initial Codex release, dependency bumps, CSRF/rate-limit hardening, and Express/TS setup before the first `Merge pull request` on this line',
];
const entryRe =
  /^- `([^`]+)` \[#(\d+)\]\((https:\/\/github\.com\/Dark-Avian-Labs\/Codex\/pull\/\d+)\): (.+)$/;
const backfillLines = lines
  .slice(headerEnd + 1, autoStart)
  .filter((line) => line.startsWith('- `'));
const autoLines = lines.slice(autoStart).filter((line) => line.startsWith('- **v'));

const seen = new Set();
const deduped = [];

for (const line of backfillLines) {
  const match = line.match(entryRe);
  if (!match) {
    console.error(`Unrecognized backfill line: ${line}`);
    process.exit(1);
  }

  const [, typeLabel, pr, url, description] = match;
  if (seen.has(pr)) {
    continue;
  }

  seen.add(pr);
  deduped.push(`- \`${typeLabel}\` [#${pr}](${url}): ${description}`);
}
const output = [
  ...header,
  '',
  '## Pull requests (backfill, PR #1-#211)',
  '',
  'One line per merged PR. SemVer tags from this period were reconstructed and are not listed here because release tags outnumbered PRs and reused the same PR links.',
  '',
  ...deduped,
  '',
  '## Releases (automated, v1.48.15+)',
  '',
  'Each release maps to exactly one merged PR. CI appends these lines when semantic-release bumps the version.',
  '',
  ...autoLines,
  '',
].join('\n');

try {
  writeFileSync(changelogPath, output);
} catch (error) {
  console.error(`Failed to write ${changelogPath}: ${error.message}`);
  process.exit(1);
}

console.log(
  `Consolidated CHANGELOG: ${backfillLines.length} backfill lines -> ${deduped.length} unique PRs; kept ${autoLines.length} automated release lines.`,
);
