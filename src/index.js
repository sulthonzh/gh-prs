const { execSync } = require('child_process');

function ghAvailable() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getAuthUser() {
  try {
    const out = execSync('gh api user --jq .login', { encoding: 'utf-8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function getRepos(user, opts = {}) {
  const args = ['--author=' + user, '--json=nameWithOwner,isFork,updatedAt'];
  if (opts.limit) args.push('--limit=' + opts.limit);
  if (opts.type === 'owner') args.push('--type=owner');

  try {
    const out = execSync('gh repo list ' + args.join(' '), { encoding: 'utf-8' });
    const repos = JSON.parse(out);
    return repos.filter(r => !r.isFork);
  } catch {
    return [];
  }
}

function getOpenPRs(repo) {
  try {
    const out = execSync(
      'gh pr list --repo ' + repo + ' --state open --json number,title,author,createdAt,updatedAt,labels,additions,deletions,changedFiles,reviewDecision,isDraft',
      { encoding: 'utf-8', timeout: 10000 }
    );
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function formatText(results, opts = {}) {
  const lines = [];
  let totalPRs = 0;

  for (const { repo, prs } of results) {
    if (!prs.length && !opts.verbose) continue;
    lines.push('\n📂 ' + repo);
    if (!prs.length) {
      lines.push('   No open PRs');
      continue;
    }
    totalPRs += prs.length;
    for (const pr of prs) {
      const draft = pr.isDraft ? ' [DRAFT]' : '';
      const author = (pr.author && pr.author.login) || 'unknown';
      const labels = (pr.labels || []).map(l => l.name).join(', ');
      const labelStr = labels ? ' [' + labels + ']' : '';
      const files = pr.changedFiles || 0;
      const adds = pr.additions || 0;
      const dels = pr.deletions || 0;
      const review = pr.reviewDecision || 'REVIEW_REQUIRED';
      const reviewIcon = review === 'APPROVED' ? '✅' : review === 'CHANGES_REQUESTED' ? '🔄' : '⏳';
      const age = daysSince(pr.createdAt);
      const ageStr = age === 0 ? 'today' : age === 1 ? '1 day' : age + ' days';

      lines.push('  #' + pr.number + ' ' + pr.title + draft + labelStr);
      lines.push('    by @' + author + ' · ' + ageStr + ' old · ' + files + ' files (+' + adds + '/-' + dels + ') ' + reviewIcon);
    }
  }

  const header = '\n🔍 Open Pull Requests (' + totalPRs + ' total across ' + results.length + ' repos)';
  return header + lines.join('\n');
}

function formatJSON(results) {
  return JSON.stringify(results, null, 2);
}

function formatMarkdown(results) {
  const lines = ['# Open Pull Requests\n'];
  let totalPRs = 0;

  for (const { repo, prs } of results) {
    if (!prs.length) continue;
    totalPRs += prs.length;
    lines.push('## ' + repo + '\n');
    for (const pr of prs) {
      const draft = pr.isDraft ? ' *(draft)*' : '';
      const author = (pr.author && pr.author.login) || 'unknown';
      const labels = (pr.labels || []).map(l => '`' + l.name + '`').join(' ');
      const review = pr.reviewDecision || 'REVIEW_REQUIRED';
      const age = daysSince(pr.createdAt);
      lines.push('- **#' + pr.number + '** ' + pr.title + draft + ' — @' + author + ' (' + age + 'd old, ' + review + ')');
      if (labels) lines.push('  ' + labels);
    }
    lines.push('');
  }

  lines.unshift('> ' + totalPRs + ' open PRs across ' + results.length + ' repos\n');
  return lines.join('\n');
}

function formatSummary(results) {
  let totalPRs = 0;
  let draftCount = 0;
  let staleCount = 0;
  let repoCount = 0;
  const authors = {};

  for (const { prs } of results) {
    if (!prs.length) continue;
    repoCount++;
    for (const pr of prs) {
      totalPRs++;
      if (pr.isDraft) draftCount++;
      const age = daysSince(pr.createdAt);
      if (age >= 7) staleCount++;
      const a = (pr.author && pr.author.login) || 'unknown';
      authors[a] = (authors[a] || 0) + 1;
    }
  }

  const lines = [
    '📊 PR Summary',
    '   Total open: ' + totalPRs,
    '   Drafts: ' + draftCount,
    '   Stale (7+ days): ' + staleCount,
    '   Repos with PRs: ' + repoCount + '/' + results.length,
  ];

  if (Object.keys(authors).length > 1) {
    lines.push('   Authors:');
    const sorted = Object.entries(authors).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      lines.push('     @' + name + ': ' + count);
    }
  }

  return lines.join('\n');
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--markdown') args.markdown = true;
    else if (a === '--summary') args.summary = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--limit' && argv[++i]) args.limit = parseInt(argv[i], 10);
    else if (a === '--user' && argv[++i]) args.user = argv[i];
    else if (a === '--repo' && argv[++i]) args.repo = argv[i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.charAt(0) !== '-') args._.push(a);
  }
  return args;
}

async function run(opts = {}) {
  if (!ghAvailable()) {
    throw new Error('gh CLI not found. Install from https://cli.github.com');
  }

  const user = opts.user || getAuthUser();
  if (!user) throw new Error('Could not determine GitHub user. Use --user');

  if (opts.repo) {
    const prs = getOpenPRs(opts.repo);
    const results = [{ repo: opts.repo, prs }];

    return formatResults(results, opts);
  }

  const repos = getRepos(user, { limit: opts.limit || 50, type: 'owner' });
  if (!repos.length) return 'No repos found.';

  const results = [];
  for (const r of repos) {
    const prs = getOpenPRs(r.nameWithOwner);
    results.push({ repo: r.nameWithOwner, prs });
  }

  return formatResults(results, opts);
}

function formatResults(results, opts) {
  if (opts.json) return formatJSON(results);
  if (opts.markdown) return formatMarkdown(results);
  if (opts.summary) return formatSummary(results);
  return formatText(results, opts);
}

module.exports = { ghAvailable, getAuthUser, getRepos, getOpenPRs, formatText, formatJSON, formatMarkdown, formatSummary, daysSince, parseArgs, run };
