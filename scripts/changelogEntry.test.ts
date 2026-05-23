import { describe, expect, it } from 'vitest';

import { formatChangelogLine, parseBranchName, parseMergeCommitMessage } from './changelogEntry.mjs';

const REPO = 'Dark-Avian-Labs/Codex';

describe('parseBranchName', () => {
  it('parses type--description branches', () => {
    expect(parseBranchName('feat--integrate-Clerk-for-authentication-and-user-management')).toEqual({
      typeLabel: 'feat',
      description: 'integrate Clerk for authentication and user management',
    });
  });

  it('parses type(scope)--description branches', () => {
    expect(parseBranchName('fix(security)--adding-override-for-js-cookie')).toEqual({
      typeLabel: 'fix(security)',
      description: 'adding override for js cookie',
    });
  });
});

describe('parseMergeCommitMessage', () => {
  it('parses GitHub merge commits with colon branch refs', () => {
    expect(
      parseMergeCommitMessage(
        'Merge pull request #221 from Dark-Avian-Labs:fix(security)--adding-override-for-js-cookie',
      ),
    ).toEqual({
      typeLabel: 'fix(security)',
      description: 'adding override for js cookie',
      prNumber: '221',
    });
  });

  it('parses GitHub merge commits with slash branch refs', () => {
    expect(parseMergeCommitMessage('Merge pull request #220 from Dark-Avian-Labs/fix--styling')).toEqual({
      typeLabel: 'fix',
      description: 'styling',
      prNumber: '220',
    });
  });

  it('parses conventional squash commits with trailing PR numbers', () => {
    expect(parseMergeCommitMessage('feat(auth): enhance authentication middleware (#17)')).toEqual({
      typeLabel: 'feat(auth)',
      description: 'enhance authentication middleware',
      prNumber: '17',
    });
  });

  it('strips no-review markers from descriptions', () => {
    expect(parseMergeCommitMessage('chore: update deps no-review (#10)')).toEqual({
      typeLabel: 'chore',
      description: 'update deps',
      prNumber: '10',
    });
  });
});

describe('formatChangelogLine', () => {
  it('matches the backfilled changelog entry format', () => {
    expect(
      formatChangelogLine({
        version: '1.49.4',
        typeLabel: 'fix(security)',
        description: 'adding override for js cookie',
        prNumber: '221',
        repository: REPO,
      }),
    ).toBe(
      '- **v1.49.4** `fix(security)` [#221](https://github.com/Dark-Avian-Labs/Codex/pull/221): adding override for js cookie',
    );
  });
});
