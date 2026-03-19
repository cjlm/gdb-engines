import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import EleventyFetch from '@11ty/eleventy-fetch';
import { parse } from 'smol-toml';

const LOGOS_DIR = join(process.cwd(), 'public', 'logos');
const DB_DIR = join(process.cwd(), 'src', 'content', 'databases');

if (!existsSync(LOGOS_DIR)) {
  mkdirSync(LOGOS_DIR, { recursive: true });
}

// Fetch the default favicon for comparison (to filter out generic icons)
let defaultFaviconBytes = null;
try {
  defaultFaviconBytes = await EleventyFetch(
    'https://www.google.com/s2/favicons?sz=32&domain=this-domain-does-not-exist-xyz123.invalid',
    { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
  );
} catch {
  defaultFaviconBytes = Buffer.alloc(0);
}

let githubFaviconBytes = null;
try {
  githubFaviconBytes = await EleventyFetch(
    'https://www.google.com/s2/favicons?sz=32&domain=github.com',
    { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
  );
} catch {
  githubFaviconBytes = Buffer.alloc(0);
}

// Read all TOML files
const files = readdirSync(DB_DIR).filter(f => f.endsWith('.toml'));
let fetched = 0;
let skipped = 0;

for (const file of files) {
  const content = readFileSync(join(DB_DIR, file), 'utf-8');
  const data = parse(content);
  const slug = data.slug;
  const outPath = join(LOGOS_DIR, `${slug}.png`);

  // Skip if already extracted
  if (existsSync(outPath)) {
    skipped++;
    continue;
  }

  // Skip if custom icon
  if (data.icon) {
    skipped++;
    continue;
  }

  // Try Google favicon from site URL
  if (data.url) {
    try {
      const hostname = new URL(data.url).hostname;
      const buf = await EleventyFetch(
        `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`,
        { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
      );
      if (buf && defaultFaviconBytes.length > 0 && !buf.equals(defaultFaviconBytes) &&
          githubFaviconBytes.length > 0 && !buf.equals(githubFaviconBytes)) {
        writeFileSync(outPath, buf);
        fetched++;
        continue;
      }
    } catch {}
  }

  // Try GitHub avatar
  if (data.github_url) {
    try {
      const org = new URL(data.github_url).pathname.split('/').filter(Boolean)[0];
      if (org) {
        const buf = await EleventyFetch(`https://github.com/${org}.png?size=32`, {
          duration: '30d', type: 'buffer', directory: '.cache/favicons',
        });
        if (buf) {
          writeFileSync(outPath, buf);
          fetched++;
          continue;
        }
      }
    } catch {}
  }

  skipped++;
}

console.log(`Favicons: ${fetched} fetched, ${skipped} skipped, ${files.length} total`);
