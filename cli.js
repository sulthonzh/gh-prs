#!/usr/bin/env node
const { parseArgs, run } = require('./src/index');

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`
gh-prs — See open PRs across your GitHub repos

Usage:
  gh-prs                  Show all open PRs across your repos
  gh-prs --repo user/repo Show PRs for a specific repo
  gh-prs --user username  Target a different user
  gh-prs --json           JSON output
  gh-prs --markdown       Markdown output
  gh-prs --summary        Summary stats only
  gh-prs --verbose        Show repos with no PRs
  gh-prs --limit 20       Limit number of repos scanned

Requires: gh CLI (https://cli.github.com)
`);
    process.exit(0);
  }

  try {
    const output = await run(args);
    console.log(output);
    // Exit with 1 if any PRs found (useful for CI "no stale PRs" checks)
    if (args.json) {
      const data = JSON.parse(output);
      const hasPRs = data.some(d => d.prs.length > 0);
      process.exit(hasPRs ? 1 : 0);
    }
  } catch (err) {
    console.error('Error: ' + err.message);
    process.exit(2);
  }
}

main();
