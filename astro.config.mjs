import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import astroAgentAnnotate from 'astro-agent-annotate';
import { databaseDates, gitDate } from './src/lib/content-dates.mjs';
import { loadRankings } from './src/lib/rankings.ts';

// Fallback for pages whose real change date can't be derived from git.
const buildDate = new Date().toISOString().split('T')[0];
const garphieldOrigin =
  process.env.PUBLIC_GARPHIELD_ORIGIN ?? 'https://garphield.com';

const dbDates = databaseDates();
const homepageDate = gitDate('src/content/databases', 'src/pages/index.astro') ?? buildDate;
// Rankings, and the rank block on every comparison page, change when a new snapshot lands.
const rankingDate = (await loadRankings())?.generatedAt?.slice(0, 10) ?? buildDate;
const latest = (...dates) => dates.filter(Boolean).sort().at(-1);

export default defineConfig({
  output: 'static',
  site: 'https://gdb-engines.com',
  // Canonical URLs carry a trailing slash (directory build format). Enforce it
  // so a no-slash internal link is a build error, not a silent 301 redirect.
  trailingSlash: 'always',
  // Sigma loads node images into a WebGL texture atlas with anonymous CORS.
  // Production mirrors these headers in public/_headers; this keeps local
  // GDB + local Garphield development working with the same generated docs.
  vite: {
    server: {
      headers: {
        'Access-Control-Allow-Origin': garphieldOrigin,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
  },
  integrations: [
    // Dev-only: Alt+click any element to leave inline notes for the agent.
    // Self-gates to `astro dev`; the production build is untouched.
    astroAgentAnnotate(),
    sitemap({
      // /compare/custom/ is noindex and /graph/ canonicalises to /graph/query-languages/;
      // listing either in a sitemap is a contradictory signal.
      filter: (page) => !page.includes('/compare/custom/') && new URL(page).pathname !== '/graph/',
      // Report an honest per-page lastmod so unchanged pages don't claim freshness
      // on every rebuild (which trains Google to ignore lastmod entirely).
      serialize(item) {
        const path = new URL(item.url).pathname;
        const dbSlug = path.match(/^\/db\/(.+)\/$/)?.[1];
        if (path.startsWith('/rankings/')) {
          item.lastmod = rankingDate;
          item.changefreq = 'monthly';
          item.priority = 0.8;
        } else if (dbSlug) {
          item.lastmod = dbDates.get(dbSlug) ?? buildDate;
          item.changefreq = 'yearly';
          item.priority = 0.6;
        } else if (path.startsWith('/compare/')) {
          // Pair pages are numerous and individually low-value, so they sit below engine
          // pages; the hub is the distributor and sits above both. The rank block
          // changes with each rankings snapshot.
          const slug = path.match(/^\/compare\/(.+)\/$/)?.[1];
          const pairSlugs = slug?.split('-vs-') ?? [];
          if (pairSlugs.length === 2) {
            const dates = pairSlugs.map((s) => dbDates.get(s)).filter(Boolean);
            item.lastmod = latest(...dates, rankingDate);
            item.changefreq = 'monthly';
            item.priority = 0.5;
          } else if (slug) {
            // Roundups are hand-maintained and few, so they outrank pair pages; their
            // content moves when either the roundup TOML or the member data moves.
            const dates = [
              gitDate(`src/content/roundups/${slug}.toml`),
              gitDate('src/content/databases'),
            ].filter(Boolean);
            item.lastmod = latest(...dates, rankingDate);
            item.changefreq = 'monthly';
            item.priority = 0.7;
          } else {
            item.lastmod = latest(gitDate('src/pages/compare'), rankingDate);
            item.changefreq = 'weekly';
            item.priority = 0.8;
          }
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
