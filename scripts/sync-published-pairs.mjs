#!/usr/bin/env node
/**
 * Appends newly generated pair pages to `src/data/published-pairs.ts`.
 *
 * The pre-generated set in `src/lib/comparisons.ts` is recomputed from each month's
 * ranking, so it both gains and loses pairs. The losing half is already handled: the
 * manifest is unioned back in, so nothing that shipped can 404. This covers the gaining
 * half, recording new pairs so they are protected from the *next* ranking shuffle too.
 *
 * Reads `dist/` rather than re-deriving the selection, so it records what actually
 * shipped. Run after a build:
 *
 *     npm run build && npm run sync-pairs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIST = 'dist/compare';
const MANIFEST = 'src/data/published-pairs.ts';
const VS = '-vs-';

if (!existsSync(DIST)) {
  console.error(`No ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

const built = readdirSync(DIST, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.includes(VS))
  .map((e) => e.name)
  .sort();

if (built.length === 0) {
  console.error(`No pair directories under ${DIST}. Did the build fall back to no rankings?`);
  process.exit(1);
}

const source = readFileSync(MANIFEST, 'utf8');
const header = source.slice(0, source.indexOf('export const'));
const existing = new Set([...source.matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]));

const added = built.filter((slug) => !existing.has(slug));
const missing = [...existing].filter((slug) => !built.includes(slug));

if (missing.length > 0) {
  console.error(`${missing.length} manifest pair(s) were not built. This should be impossible:`);
  for (const slug of missing.slice(0, 10)) console.error(`  ${slug}`);
  process.exit(1);
}

if (added.length === 0) {
  console.log(`No new pairs. Manifest holds ${existing.size}.`);
  process.exit(0);
}

const all = [...existing, ...added].sort();
writeFileSync(MANIFEST, `${header}export const PUBLISHED_PAIRS: readonly string[] = [\n${all.map((s) => `  '${s}',`).join('\n')}\n];\n`);

console.log(`Added ${added.length} pair(s); manifest now holds ${all.length}.`);
for (const slug of added.slice(0, 20)) console.log(`  + ${slug}`);
if (added.length > 20) console.log(`  ... and ${added.length - 20} more`);
