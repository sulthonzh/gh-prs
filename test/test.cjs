#!/usr/bin/env node
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatText, formatJSON, formatMarkdown, formatSummary,
  daysSince, parseArgs, ghAvailable
} = require('../src/index.js');

describe('daysSince', () => {
  it('returns 0 for today', () => {
    assert.equal(daysSince(new Date().toISOString()), 0);
  });

  it('returns correct days for past date', () => {
    const d = new Date(Date.now() - 3 * 86400000);
    assert.equal(daysSince(d.toISOString()), 3);
  });

  it('handles ISO string', () => {
    const d = new Date(Date.now() - 10 * 86400000);
    assert.equal(daysSince(d.toISOString()), 10);
  });
});

describe('formatText', () => {
  const sampleData = [
    {
      repo: 'user/project',
      prs: [
        {
          number: 42,
          title: 'Fix auth bug',
          author: { login: 'dev1' },
          createdAt: new Date().toISOString(),
          labels: [{ name: 'bug' }],
          additions: 10,
          deletions: 5,
          changedFiles: 2,
          reviewDecision: 'APPROVED',
          isDraft: false,
        },
        {
          number: 43,
          title: 'Add feature X',
          author: { login: 'dev2' },
          createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
          labels: [],
          additions: 100,
          deletions: 20,
          changedFiles: 5,
          reviewDecision: 'REVIEW_REQUIRED',
          isDraft: true,
        },
      ],
    },
    {
      repo: 'user/empty-repo',
      prs: [],
    },
  ];

  it('shows PRs with repo names', () => {
    const out = formatText(sampleData);
    assert.ok(out.includes('user/project'));
    assert.ok(out.includes('#42'));
    assert.ok(out.includes('#43'));
    assert.ok(out.includes('Fix auth bug'));
    assert.ok(out.includes('Add feature X'));
  });

  it('hides repos with no PRs by default', () => {
    const out = formatText(sampleData);
    assert.ok(!out.includes('user/empty-repo'));
  });

  it('shows empty repos in verbose mode', () => {
    const out = formatText(sampleData, { verbose: true });
    assert.ok(out.includes('user/empty-repo'));
    assert.ok(out.includes('No open PRs'));
  });

  it('shows draft label', () => {
    const out = formatText(sampleData);
    assert.ok(out.includes('[DRAFT]'));
  });

  it('shows labels', () => {
    const out = formatText(sampleData);
    assert.ok(out.includes('[bug]'));
  });

  it('shows review status icons', () => {
    const out = formatText(sampleData);
    assert.ok(out.includes('✅'));
    assert.ok(out.includes('⏳'));
  });

  it('shows total count', () => {
    const out = formatText(sampleData);
    assert.ok(out.includes('2 total'));
  });
});

describe('formatJSON', () => {
  it('produces valid JSON', () => {
    const data = [{ repo: 'r', prs: [{ number: 1, title: 't' }] }];
    const out = formatJSON(data);
    const parsed = JSON.parse(out);
    assert.deepEqual(parsed, data);
  });

  it('handles empty data', () => {
    const out = formatJSON([]);
    assert.deepEqual(JSON.parse(out), []);
  });
});

describe('formatMarkdown', () => {
  it('produces markdown headers', () => {
    const data = [{ repo: 'user/proj', prs: [{ number: 1, title: 'Test PR', author: { login: 'dev' }, createdAt: new Date().toISOString(), labels: [{ name: 'enhancement' }], reviewDecision: 'APPROVED', isDraft: false }] }];
    const out = formatMarkdown(data);
    assert.ok(out.includes('## user/proj'));
    assert.ok(out.includes('**#1**'));
    assert.ok(out.includes('Test PR'));
    assert.ok(out.includes('@dev'));
    assert.ok(out.includes('`enhancement`'));
  });

  it('skips repos with no PRs', () => {
    const data = [{ repo: 'user/empty', prs: [] }];
    const out = formatMarkdown(data);
    assert.ok(!out.includes('user/empty'));
  });

  it('shows draft label', () => {
    const data = [{ repo: 'r', prs: [{ number: 1, title: 'T', author: { login: 'a' }, createdAt: new Date().toISOString(), labels: [], reviewDecision: null, isDraft: true }] }];
    const out = formatMarkdown(data);
    assert.ok(out.includes('(draft)'));
  });
});

describe('formatSummary', () => {
  it('counts totals correctly', () => {
    const data = [
      {
        repo: 'r1',
        prs: [
          { author: { login: 'a' }, createdAt: new Date().toISOString(), isDraft: false },
          { author: { login: 'b' }, createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), isDraft: true },
        ],
      },
      { repo: 'r2', prs: [] },
    ];
    const out = formatSummary(data);
    assert.ok(out.includes('Total open: 2'));
    assert.ok(out.includes('Drafts: 1'));
    assert.ok(out.includes('Stale (7+ days): 1'));
    assert.ok(out.includes('Repos with PRs: 1/2'));
  });

  it('shows author breakdown for multiple authors', () => {
    const data = [{
      repo: 'r',
      prs: [
        { author: { login: 'alice' }, createdAt: new Date().toISOString(), isDraft: false },
        { author: { login: 'alice' }, createdAt: new Date().toISOString(), isDraft: false },
        { author: { login: 'bob' }, createdAt: new Date().toISOString(), isDraft: false },
      ],
    }];
    const out = formatSummary(data);
    assert.ok(out.includes('Authors:'));
    assert.ok(out.includes('@alice: 2'));
    assert.ok(out.includes('@bob: 1'));
  });

  it('no author breakdown for single author', () => {
    const data = [{
      repo: 'r',
      prs: [
        { author: { login: 'alice' }, createdAt: new Date().toISOString(), isDraft: false },
      ],
    }];
    const out = formatSummary(data);
    assert.ok(!out.includes('Authors:'));
  });

  it('handles empty results', () => {
    const out = formatSummary([]);
    assert.ok(out.includes('Total open: 0'));
  });
});

describe('parseArgs', () => {
  it('parses --json', () => {
    const args = parseArgs(['node', 'cli', '--json']);
    assert.equal(args.json, true);
  });

  it('parses --markdown', () => {
    const args = parseArgs(['node', 'cli', '--markdown']);
    assert.equal(args.markdown, true);
  });

  it('parses --summary', () => {
    const args = parseArgs(['node', 'cli', '--summary']);
    assert.equal(args.summary, true);
  });

  it('parses --verbose -v', () => {
    assert.equal(parseArgs(['node', 'cli', '--verbose']).verbose, true);
    assert.equal(parseArgs(['node', 'cli', '-v']).verbose, true);
  });

  it('parses --limit with value', () => {
    const args = parseArgs(['node', 'cli', '--limit', '20']);
    assert.equal(args.limit, 20);
  });

  it('parses --user with value', () => {
    const args = parseArgs(['node', 'cli', '--user', 'octocat']);
    assert.equal(args.user, 'octocat');
  });

  it('parses --repo with value', () => {
    const args = parseArgs(['node', 'cli', '--repo', 'user/repo']);
    assert.equal(args.repo, 'user/repo');
  });

  it('parses --help', () => {
    const args = parseArgs(['node', 'cli', '--help']);
    assert.equal(args.help, true);
  });

  it('ignores unknown flags', () => {
    const args = parseArgs(['node', 'cli', '--unknown']);
    assert.equal(args.json, undefined);
    assert.equal(args._.length, 0);
  });

  it('collects positional args', () => {
    const args = parseArgs(['node', 'cli', 'extra']);
    assert.deepEqual(args._, ['extra']);
  });
});

describe('ghAvailable', () => {
  it('returns boolean', () => {
    const result = ghAvailable();
    assert.equal(typeof result, 'boolean');
  });
});
