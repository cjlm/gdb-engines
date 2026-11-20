/**
 * Chart data for blog posts. Like the posts themselves, it lives in data/ in the private blog
 * repo and is synced into src/data/blog/ at build time by scripts/sync-blog.mjs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'src', 'data', 'blog');

/**
 * Read one synced chart data file.
 *
 * Raises:
 *   Error: the file is missing, which means a post places a chart whose data was not synced.
 */
export function loadBlogData<T>(name: string): T {
  const file = resolve(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `[blog] chart data ${name}.json is missing from src/data/blog/. It comes from data/ in ` +
        'the blog repo; run `npm run sync-blog` (scripts/sync-blog.mjs).',
    );
  }
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}
