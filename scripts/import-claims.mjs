#!/usr/bin/env node
/**
 * Imports a multi-field research pass: writes each value onto its catalogue entry and merges the
 * sources behind it into `src/content/evidence/`.
 *
 * Input is a directory of JSON files, each an array of
 *   { slug, claims: [{ field, value, confidence, notes, sources: [{ url, title, quote }] }] }
 *
 * Claims merge rather than replace: an entry that already has a licence claim from the GitHub API
 * keeps it when a research pass adds `released`. Only the fields present in the input are touched.
 *
 * Corrections are the interesting output. Where a researched value differs from what the catalogue
 * held, the entry is updated and the change is printed — those lines are the ones worth reading,
 * since the old value was an unsourced assertion and this one isn't.
 *
 * Usage: node scripts/import-claims.mjs <results-dir> [--dry-run]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { readEvidence, writeEvidence } from './lib/evidence-file.mjs';
import { upsertField } from './lib/toml-edit.mjs';
import { PER_VALUE_FIELDS, unsupportedValues } from './lib/per-value-evidence.mjs';
import { KG_CAPABILITIES, KG_KINDS } from '../src/lib/knowledge-graph.ts';

const DB_DIR = 'src/content/databases';

/** Where a field is inserted when the entry doesn't already have it. */
const ANCHORS = {
  license: ['github_url', 'url', 'description'],
  released: ['query_languages', 'type', 'category'],
  implementation_language: ['license', 'github_url', 'url'],
  url: ['description', 'slug'],
  github_url: ['url', 'description'],
  vendor: ['name'],
  status: ['category', 'released', 'type'],
  kg_kinds: ['ai_roles', 'description'],
  kg_capabilities: ['protocols', 'query_languages', 'type'],
  kg_extension_capabilities: ['kg_capabilities', 'protocols', 'query_languages', 'type'],
};

/** Closed vocabularies; a value outside them is dropped and reported. */
const VOCABULARY = {
  kg_kinds: new Set(KG_KINDS),
  kg_capabilities: new Set(KG_CAPABILITIES),
  kg_extension_capabilities: new Set(KG_CAPABILITIES),
};

const resultsDir = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!resultsDir || !existsSync(resultsDir)) {
  console.error('Usage: node scripts/import-claims.mjs <results-dir> [--dry-run]');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const files = new Map();
const current = new Map();
for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith('.toml'))) {
  const data = parse(readFileSync(join(DB_DIR, file), 'utf8'));
  files.set(data.slug, file);
  current.set(data.slug, data);
}

function methodFor(sources) {
  const hosts = (sources ?? []).map((s) => {
    try { return new URL(s.url).hostname; } catch { return ''; }
  });
  if (hosts.some((h) => h.includes('api.github.com'))) return 'api';
  if (hosts.some((h) => h.includes('github') || h.includes('gitlab'))) return 'repo';
  return hosts.length > 0 ? 'vendor-docs' : 'web';
}

const skipped = [];
const corrections = [];
const unknowns = [];
let written = 0;
let unchanged = 0;

for (const file of readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort()) {
  let records;
  try {
    records = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'));
  } catch (err) {
    skipped.push(`${file}: unreadable JSON — ${err.message}`);
    continue;
  }

  for (const { slug, claims } of records) {
    if (!files.has(slug)) { skipped.push(`${file}: unknown slug "${slug}".`); continue; }
    if (!Array.isArray(claims)) { skipped.push(`${slug}: no claims array.`); continue; }

    const existing = readEvidence(slug);
    const added = [];

    for (const claim of claims) {
      const { field, confidence } = claim;

      if (!ANCHORS[field]) { skipped.push(`${slug}: unsupported field "${field}".`); continue; }
      if (!['high', 'medium', 'low'].includes(confidence)) {
        skipped.push(`${slug}.${field}: bad confidence "${confidence}".`);
        continue;
      }
      let value = claim.value;
      if (VOCABULARY[field] && Array.isArray(value)) {
        for (const v of value.filter((v) => !VOCABULARY[field].has(v))) {
          skipped.push(`${slug}.${field}: "${v}" is not in the vocabulary.`);
        }
        value = value.filter((v) => VOCABULARY[field].has(v));
      }
      // A value with no source of its own is left out rather than published on another's quote.
      if (PER_VALUE_FIELDS.includes(field) && Array.isArray(value)) {
        const unsupported = unsupportedValues({ ...claim, value });
        for (const v of unsupported) {
          skipped.push(`${slug}.${field}: "${v}" has no source naming it.`);
        }
        value = value.filter((v) => !unsupported.includes(v));
      }
      // An unresolved field stays absent rather than shipping the word "unknown" as a value. An
      // empty list is the same: the field is simply not set.
      const empty = Array.isArray(value) && value.length === 0;
      if (value === 'unknown' || value === null || value === '' || empty) {
        unknowns.push(`${slug}.${field}`);
        continue;
      }

      const was = current.get(slug)[field];
      if (was !== undefined && was !== value) corrections.push(`${slug}.${field}: ${was} → ${value}`);

      const changes = dryRun ? was !== value : upsertField(join(DB_DIR, files.get(slug)), field, value, ANCHORS[field]);
      if (changes) written += 1;
      else unchanged += 1;

      added.push({
        field,
        value,
        confidence,
        method: methodFor(claim.sources),
        checked: today,
        notes: claim.notes || undefined,
        sources: (claim.sources ?? [])
          // Sources for values dropped above would back nothing that ships.
          .filter((s) => !PER_VALUE_FIELDS.includes(field) || value.includes(s.supports))
          .map((s) => ({
            url: s.url, title: s.title, quote: s.quote, supports: s.supports, verified: 'unchecked',
          })),
      });
    }

    // Only valid, resolved claims replace existing evidence. Filtering against the raw input would
    // let an `unknown` or malformed result silently erase a good claim when another field in the
    // same record was imported.
    const replaced = new Set(added.map((claim) => claim.field));
    const kept = (existing?.claims ?? []).filter((claim) => !replaced.has(claim.field));
    if (added.length > 0 && !dryRun) writeEvidence({ slug, claims: [...kept, ...added] });
  }
}

for (const s of skipped) console.warn(`[import] skipped: ${s}`);
if (unknowns.length > 0) console.log(`\n[import] left unresolved (${unknowns.length}): ${unknowns.join(', ')}`);
if (corrections.length > 0) {
  console.log(`\n[import] values corrected (${corrections.length}) — these were unsourced before:`);
  for (const c of corrections) console.log(`  ${c}`);
}
console.log(`\n[import] ${written} values changed, ${unchanged} already current${dryRun ? ' (dry run)' : ''}.`);
if (!dryRun) console.log('[import] next: node scripts/verify-quotes.mjs && node scripts/check-evidence.mjs');
