/**
 * Build-time sync for blog posts, sourced from the private cjlm/gdb-engines-blog repo
 * (editorial drafts and sponsor-adjacent copy stay out of the public site history).
 * Same pattern as src/lib/rankings.ts and src/lib/sponsors.ts:
 *
 *   - If RANKINGS_TOKEN is set, fetch posts/*.md from GitHub via the contents API.
 *   - Otherwise copy from a sibling checkout (../gdb-engines-blog-content/posts) for local dev.
 *   - If neither is available, leave the collection empty and the site builds without /blog/* posts.
 *
 * Markdown lands in src/content/blog/, which is a gitignored build artifact in this repo.
 */
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO = process.env.BLOG_REPO ?? 'cjlm/gdb-engines-blog';
const SRC_PATH = process.env.BLOG_PATH ?? 'posts';
const REF = process.env.BLOG_REF ?? 'main';
const LOCAL_FALLBACK = process.env.BLOG_CONTENT_DIR
  ? resolve(process.env.BLOG_CONTENT_DIR, 'posts')
  : resolve(process.cwd(), '..', 'gdb-engines-blog-content', 'posts');

const TARGET = resolve(process.cwd(), 'src', 'content', 'blog');

function resetTarget() {
  if (existsSync(TARGET)) {
    for (const f of readdirSync(TARGET)) {
      if (f.endsWith('.md')) rmSync(join(TARGET, f));
    }
  } else {
    mkdirSync(TARGET, { recursive: true });
  }
}

async function fetchFromGitHub(token) {
  const listUrl = `https://api.github.com/repos/${REPO}/contents/${SRC_PATH}?ref=${REF}`;
  const res = await fetch(listUrl, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'gdb-engines-build' },
  });
  if (!res.ok) {
    console.warn(`[blog] GitHub list failed: ${res.status} ${await res.text()}`);
    return 0;
  }
  const entries = (await res.json()).filter((e) => e.type === 'file' && e.name.endsWith('.md'));
  let count = 0;
  for (const entry of entries) {
    const raw = await fetch(entry.download_url, { headers: { 'user-agent': 'gdb-engines-build' } });
    if (!raw.ok) {
      console.warn(`[blog] fetch failed for ${entry.name}: ${raw.status}`);
      continue;
    }
    writeFileSync(join(TARGET, entry.name), await raw.text());
    count += 1;
  }
  return count;
}

function copyFromSibling() {
  if (!existsSync(LOCAL_FALLBACK)) {
    console.warn(`[blog] no token and no sibling checkout at ${LOCAL_FALLBACK}; blog will be empty.`);
    return 0;
  }
  let count = 0;
  for (const f of readdirSync(LOCAL_FALLBACK)) {
    if (!f.endsWith('.md')) continue;
    writeFileSync(join(TARGET, f), readFileSync(join(LOCAL_FALLBACK, f)));
    count += 1;
  }
  return count;
}

const token = process.env.RANKINGS_TOKEN;
resetTarget();
const count = token ? await fetchFromGitHub(token) : copyFromSibling();
console.log(`[blog] synced ${count} post(s) from ${token ? REPO : LOCAL_FALLBACK} into src/content/blog/`);
