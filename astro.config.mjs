import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';

// Fallback for pages whose real change date can't be derived from git.
const buildDate = new Date().toISOString().split('T')[0];

/** Last git commit date (YYYY-MM-DD) touching any of `paths`, or null if unavailable. */
function gitDate(...paths) {
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
function databaseDates() {
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

const dbDates = databaseDates();
const homepageDate = gitDate('src/content/databases', 'src/pages/index.astro') ?? buildDate;

export default defineConfig({
  output: 'static',
  site: 'https://gdb-engines.com',
  // Canonical URLs carry a trailing slash (directory build format). Enforce it
  // so a no-slash internal link is a build error, not a silent 301 redirect.
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Report an honest per-page lastmod so unchanged pages don't claim freshness
      // on every rebuild (which trains Google to ignore lastmod entirely).
      serialize(item) {
        const path = new URL(item.url).pathname;
        const dbSlug = path.match(/^\/db\/(.+)\/$/)?.[1];
        if (path.startsWith('/rankings/')) {
          // Rankings regenerate from a monthly data refresh, so the build date is honest.
          item.lastmod = buildDate;
          item.changefreq = 'monthly';
          item.priority = 0.8;
        } else if (dbSlug) {
          item.lastmod = dbDates.get(dbSlug) ?? buildDate;
          item.changefreq = 'yearly';
          item.priority = 0.6;
        } else if (path === '/') {
          item.lastmod = homepageDate;
        } else {
          item.lastmod = gitDate(`src/pages${path.replace(/\/$/, '')}.astro`) ?? buildDate;
        }
        return item;
      },
    }),
  ],
});
