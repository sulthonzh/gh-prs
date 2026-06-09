# gh-prs

See all open pull requests across your GitHub repos at a glance.

Because `gh pr list` only shows one repo at a time, and you've got better things to do than check them one by one.

## Why

You maintain multiple repos. PRs pile up. Some go stale. Some need review. You want a single command that shows you everything — who opened what, how old it is, whether it's been reviewed.

## Install

```bash
npm install -g gh-prs
```

Requires [gh CLI](https://cli.github.com) to be installed and authenticated.

## Usage

```bash
# Show all open PRs across your repos
gh-prs

# Specific repo
gh-prs --repo sulthonzh/my-project

# Different user
gh-prs --user octocat

# JSON output (pipe to jq, scripts, etc.)
gh-prs --json

# Markdown (paste into docs/issues)
gh-prs --markdown

# Summary stats
gh-prs --summary

# Show repos with zero PRs too
gh-prs --verbose

# Limit repos scanned
gh-prs --limit 10
```

## Output Example

```
🔍 Open Pull Requests (3 total across 15 repos)

📂 sulthonzh/my-project
  #42 Fix auth bug [bug]
    by @dev1 · 2 days old · 2 files (+10/-5) ✅
  #43 Add feature X [DRAFT]
    by @dev2 · 8 days old · 5 files (+100/-20) ⏳

📂 sulthonzh/other-project
  #7 Update dependencies
    by @dependabot · 1 day old · 1 file (+5/-5) ⏳
```

Review status icons:
- ✅ Approved
- 🔄 Changes requested
- ⏳ Awaiting review

## Summary Mode

```
📊 PR Summary
   Total open: 3
   Drafts: 1
   Stale (7+ days): 1
   Repos with PRs: 2/15
```

## Exit Codes

- `0` — No open PRs found
- `1` — PRs found (useful for CI: "no stale PRs" checks)
- `2` — Error (gh not installed, auth issue, etc.)

## Programmatic API

```js
const { run, formatJSON, formatSummary } = require('gh-prs');

// Full run
const output = await run({ user: 'octocat', json: true });

// Or use formatters directly
const { getOpenPRs, formatText } = require('gh-prs');
const prs = getOpenPRs('user/repo');
console.log(formatText([{ repo: 'user/repo', prs }]));
```

## License

MIT
