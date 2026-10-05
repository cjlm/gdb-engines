/**
 * Content change dates from git history, shared by the sitemap (astro.config.mjs) and the
 * pages that publish a modification date, so the two never disagree.
 */
import { execSync } from 'node:child_process';

/** Last git commit date (YYYY-MM-DD) touching any of `paths`, or null if unavailable. */
export function gitDate(...paths) {
  try {
    const quoted = paths.map((p) => `'${p}'`).join(' ');
    const out = execSync(`git log -1 --format=%cs -- ${quoted}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/** slug -> last commit date of its TOML source, built with one git-log pass. */
export function databaseDates() {
  const dates = new Map();
  try {
    const log = execSync('git log --format=%cs --name-only -- src/content/databases', {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let commitDate = null;
    for (const line of log.split('\n')) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
        commitDate = line;
      } else {
        const slug = line.match(/^src\/content\/databases\/(.+)\.toml$/)?.[1];
        if (slug && commitDate && !dates.has(slug)) dates.set(slug, commitDate);
      }
    }
  } catch {
    // git history unavailable (e.g. a shallow CI clone) — callers fall back to buildDate.
  }
  return dates;
}
