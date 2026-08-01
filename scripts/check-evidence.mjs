#!/usr/bin/env node
/**
 * Fails the build when a catalogue value and the evidence backing it disagree.
 *
 * Evidence rots in one specific way: someone corrects a value in
 * `src/content/databases/<slug>.toml` and leaves the sources in
 * `src/content/evidence/<slug>.toml` pointing at the old answer. Nothing about the page looks
 * wrong afterwards — it just cites a source for something the source doesn't say. So every claim
 * restates the value it was gathered for, and this compares the two.
 *
 * Also enforces that fields in REQUIRE_EVIDENCE ship with sources at all, and that no claim rests
 * entirely on quotes that failed verification.
 *
 * Run by `prebuild`; run directly with `node scripts/check-evidence.mjs`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';

const DB_DIR = 'src/content/databases';
const EV_DIR = 'src/content/evidence';

/** Values we won't publish unsourced. Legacy fields are grandfathered in until backfilled. */
const REQUIRE_EVIDENCE = ['protocols'];

const errors = [];
const warnings = [];

function readToml(dir, file) {
  try {
    return parse(readFileSync(join(dir, file), 'utf8'));
  } catch (err) {
    errors.push(`${join(dir, file)}: cannot parse TOML — ${err.message}`);
    return null;
  }
}

/** Resolves "features.cli" as well as "license". Returns undefined for an absent field. */
function fieldValue(entry, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), entry);
}

function sameValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const [x, y] = [[...a].sort(), [...b].sort()];
    return x.every((v, i) => v === y[i]);
  }
  return a === b;
}

function show(v) {
  return Array.isArray(v) ? `[${v.join(', ')}]` : String(v);
}

const databases = new Map();
for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith('.toml'))) {
  const data = readToml(DB_DIR, file);
  if (data) databases.set(data.slug, { file, data });
}

const evidenced = new Map();
if (existsSync(EV_DIR)) {
  for (const file of readdirSync(EV_DIR).filter((f) => f.endsWith('.toml'))) {
    const ev = readToml(EV_DIR, file);
    if (!ev) continue;
    const where = join(EV_DIR, file);

    if (`${ev.slug}.toml` !== file) {
      errors.push(`${where}: slug "${ev.slug}" does not match the filename.`);
      continue;
    }
    const entry = databases.get(ev.slug);
    if (!entry) {
      errors.push(`${where}: no database entry with slug "${ev.slug}".`);
      continue;
    }

    const fields = new Set();
    for (const claim of ev.claims ?? []) {
      fields.add(claim.field);
      const actual = fieldValue(entry.data, claim.field);

      if (actual === undefined) {
        errors.push(`${where}: claims field "${claim.field}", which ${entry.file} does not set.`);
      } else if (!sameValue(actual, claim.value)) {
        errors.push(
          `${where}: evidence for "${claim.field}" is ${show(claim.value)} but ${entry.file} ` +
          `says ${show(actual)}. Re-check the sources, then update the claim.`,
        );
      }

      const sources = claim.sources ?? [];
      // An archived snapshot is weaker than the live page but still a checked citation.
      const matched = sources.filter((s) => s.verified === 'matched' || s.verified === 'matched-archive');
      const mismatched = sources.filter((s) => s.verified === 'mismatch');

      if (sources.length === 0 && claim.confidence !== 'low') {
        errors.push(`${where}: "${claim.field}" is ${claim.confidence} confidence with no sources.`);
      }
      if (sources.length > 0 && matched.length === 0 && mismatched.length === sources.length) {
        errors.push(
          `${where}: every quote for "${claim.field}" failed verification — the cited pages do ` +
          `not contain them. Re-research rather than republish.`,
        );
      }
      for (const s of sources.filter((s) => s.verified === 'unchecked')) {
        warnings.push(`${where}: quote from ${s.url} not yet verified (run verify-quotes.mjs).`);
      }
      for (const s of sources.filter((s) => s.verified === 'unreachable')) {
        warnings.push(`${where}: ${s.url} could not be refetched — may have rotted.`);
      }
    }
    evidenced.set(ev.slug, fields);
  }
}

for (const [slug, { file, data }] of databases) {
  for (const field of REQUIRE_EVIDENCE) {
    if (fieldValue(data, field) === undefined) continue;
    if (!evidenced.get(slug)?.has(field)) {
      errors.push(`${join(DB_DIR, file)}: sets "${field}" but ${EV_DIR}/${slug}.toml has no claim for it.`);
    }
  }
}

for (const w of warnings) console.warn(`[evidence] warn: ${w}`);
for (const e of errors) console.error(`[evidence] error: ${e}`);

const covered = [...databases.keys()].filter((s) => evidenced.has(s)).length;
console.log(
  `[evidence] ${covered}/${databases.size} entries have evidence; ` +
  `${errors.length} errors, ${warnings.length} warnings.`,
);

if (errors.length > 0) process.exit(1);
