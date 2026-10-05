#!/usr/bin/env node
/**
 * Fails the build when a page in dist/ links to an internal path that was not built.
 *
 * Collection, profile and pair pages all generate links from catalogue data, and only a subset
 * of pairs is published, so a template can easily promise a page the build never made. This
 * walks every built HTML file, resolves each same-site href against dist/ and _redirects, and
 * exits non-zero listing the misses.
 *
 * With --orphans it also lists built pages that no other page links to.
 *
 * Usage: node scripts/check-internal-links.mjs [dist] [--orphans]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const showOrphans = args.includes('--orphans');
const DIST = args.find((a) => !a.startsWith('--')) ?? 'dist';
const ORIGIN = 'https://gdb-engines.com';

if (!existsSync(DIST)) {
  console.error(`check-internal-links: ${DIST}/ does not exist — run the build first.`);
  process.exit(2);
}

function htmlFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...htmlFiles(path));
    else if (name.endsWith('.html')) files.push(path);
  }
  return files;
}

/** `dist/compare/a-vs-b/index.html` → `/compare/a-vs-b/` */
function routeOf(file) {
  const rel = relative(DIST, file).split('\\').join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function redirectSources() {
  const path = join(DIST, '_redirects');
  if (!existsSync(path)) return new Set();
  const sources = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((source) => source && !source.startsWith('#'));
  return new Set(sources.map((s) => s.replace(/\/$/, '') || '/'));
}

function resolves(pathname, redirects) {
  const bare = pathname.replace(/\/$/, '') || '/';
  if (redirects.has(bare)) return true;
  const candidates = pathname.endsWith('/')
    ? [join(DIST, pathname, 'index.html')]
    : [join(DIST, pathname), join(DIST, pathname, 'index.html'), join(DIST, `${pathname}.html`)];
  return candidates.some((c) => existsSync(c) && statSync(c).isFile());
}

const HREF = /<a\b[^>]*?\shref="([^"]+)"/g;

function internalPath(href, pageUrl) {
  if (/^(mailto:|tel:|javascript:|#)/.test(href)) return null;
  const url = new URL(href.replaceAll('&amp;', '&'), pageUrl);
  if (url.origin !== ORIGIN) return null;
  return decodeURIComponent(url.pathname);
}

const redirects = redirectSources();
const files = htmlFiles(DIST);
const routes = new Set(files.map(routeOf));
const inbound = new Map([...routes].map((r) => [r, 0]));
const missing = new Map();

for (const file of files) {
  const route = routeOf(file);
  const pageUrl = new URL(route, ORIGIN);
  const seen = new Set();
  for (const [, href] of readFileSync(file, 'utf8').matchAll(HREF)) {
    const pathname = internalPath(href, pageUrl);
    if (pathname === null || seen.has(pathname)) continue;
    seen.add(pathname);
    if (!resolves(pathname, redirects)) {
      const sources = missing.get(pathname) ?? [];
      sources.push(route);
      missing.set(pathname, sources);
      continue;
    }
    const target = pathname.endsWith('/') || pathname.includes('.') ? pathname : `${pathname}/`;
    if (target !== route && inbound.has(target)) inbound.set(target, inbound.get(target) + 1);
  }
}

if (showOrphans) {
  const orphans = [...inbound].filter(([route, count]) => count === 0 && route !== '/' && route !== '/404.html');
  const bySection = new Map();
  for (const [route] of orphans) {
    const section = route.split('/')[1] || '/';
    bySection.set(section, (bySection.get(section) ?? 0) + 1);
  }
  console.log(`${orphans.length} of ${routes.size} built pages have no inbound link:`);
  for (const [section, count] of [...bySection].sort((a, b) => b[1] - a[1])) {
    console.log(`  /${section}/  ${count}`);
  }
}

if (missing.size > 0) {
  console.error(`check-internal-links: ${missing.size} internal link target(s) were not built:`);
  for (const [pathname, sources] of [...missing].sort()) {
    console.error(`  ${pathname}  ← ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? ` (+${sources.length - 3})` : ''}`);
  }
  process.exit(1);
}
console.log(`check-internal-links: all internal links in ${files.length} pages resolve.`);
