/**
 * Build-time sync for blog posts and their chart specs, sourced from the private
 * cjlm/gdb-engines-blog repo (editorial drafts and sponsor-adjacent copy stay out of the public
 * site history). Same pattern as src/lib/rankings.ts and src/lib/sponsors.ts:
 *
 *   - If RANKINGS_TOKEN is set, fetch posts/*.md and charts/*.json from GitHub via the contents API.
 *   - Otherwise copy them from a sibling checkout (../gdb-engines-blog-content) for local dev.
 *   - If neither is available, leave both empty and the site builds without /blog/* posts.
 *
 * Posts land in src/content/blog/ and chart specs in src/data/blog-charts/; both are gitignored
 * build artifacts in this repo. A spec carries everything a chart shows (see src/lib/blog-charts.ts).
 */
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO = process.env.BLOG_REPO ?? 'cjlm/gdb-engines-blog';
const REF = process.env.BLOG_REF ?? 'main';
const LOCAL_ROOT = process.env.BLOG_CONTENT_DIR
  ? resolve(process.env.BLOG_CONTENT_DIR)
  : resolve(process.cwd(), '..', 'gdb-engines-blog-content');

const SYNCS = [
  { label: 'post', source: process.env.BLOG_PATH ?? 'posts', ext: '.md', target: resolve(process.cwd(), 'src', 'content', 'blog') },
  { label: 'chart spec', source: 'charts', ext: '.json', target: resolve(process.cwd(), 'src', 'data', 'blog-charts') },
  // Illustrations a post places with <img src="/blog-images/<name>.webp">.
  { label: 'image', source: 'images', ext: '.webp', target: resolve(process.cwd(), 'public', 'blog-images') },
];
const OPTIONAL_SOURCES = new Set(['charts', 'images']);

function resetTarget({ target, ext }) {
  if (existsSync(target)) {
    for (const f of readdirSync(target)) {
      if (f.endsWith(ext)) rmSync(join(target, f));
    }
  } else {
    mkdirSync(target, { recursive: true });
  }
}

async function fetchFromGitHub({ source, ext, target }, token) {
  const listUrl = `https://api.github.com/repos/${REPO}/contents/${source}?ref=${REF}`;
  const res = await fetch(listUrl, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'gdb-engines-build' },
  });
  // A repo without charts/ or images/ is normal; a missing posts/ folder is reported like any failure.
  if (res.status === 404 && OPTIONAL_SOURCES.has(source)) return 0;
  if (!res.ok) {
    console.warn(`[blog] GitHub list of ${source}/ failed: ${res.status} ${await res.text()}`);
    return 0;
  }
  const entries = (await res.json()).filter((e) => e.type === 'file' && e.name.endsWith(ext));
  let count = 0;
  for (const entry of entries) {
    // Fetch via the contents API with the raw accept header (not download_url,
    // which is not reliably authenticated for private repos).
    const raw = await fetch(entry.url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.raw', 'user-agent': 'gdb-engines-build' },
    });
    if (!raw.ok) {
      console.warn(`[blog] fetch failed for ${source}/${entry.name}: ${raw.status}`);
      continue;
    }
    writeFileSync(join(target, entry.name), Buffer.from(await raw.arrayBuffer()));
    count += 1;
  }
  return count;
}

function copyFromSibling({ source, ext, target }) {
  const dir = join(LOCAL_ROOT, source);
  if (!existsSync(dir)) {
    if (!OPTIONAL_SOURCES.has(source)) console.warn(`[blog] no token and no sibling checkout at ${dir}; blog will be empty.`);
    return 0;
  }
  let count = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(ext)) continue;
    writeFileSync(join(target, f), readFileSync(join(dir, f)));
    count += 1;
  }
  return count;
}

const token = process.env.RANKINGS_TOKEN;
for (const sync of SYNCS) {
  resetTarget(sync);
  let count = 0;
  try {
    count = token ? await fetchFromGitHub(sync, token) : copyFromSibling(sync);
  } catch (err) {
    // Degrade gracefully like loadRankings/loadSponsors: warn and build without posts
    // rather than failing the whole site build on a transient fetch error.
    console.warn(`[blog] ${sync.source}/ sync failed, building without it: ${err.message}`);
  }
  console.log(`[blog] synced ${count} ${sync.label}(s) from ${token ? REPO : LOCAL_ROOT}/${sync.source} into ${sync.target}`);
}
