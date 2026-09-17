/**
 * Reader/writer for `src/content/evidence/<slug>.toml`.
 *
 * These files are written by tooling, not by hand, so they're emitted in a fixed key order and
 * with one source per block — a stable layout means a review diff shows only what actually
 * changed, not a reshuffle.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parse } from 'smol-toml';

export const EVIDENCE_DIR = 'src/content/evidence';

export function evidencePath(slug) {
  return join(EVIDENCE_DIR, `${slug}.toml`);
}

export function readEvidence(slug) {
  const path = evidencePath(slug);
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : null;
}

function tomlString(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // Remaining control characters have no literal form in a TOML basic string.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return `"${escaped}"`;
}

function tomlValue(value) {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return tomlString(value);
}

const CLAIM_KEYS = ['field', 'value', 'confidence', 'method', 'checked', 'notes'];
const SOURCE_KEYS = ['url', 'title', 'quote', 'verified', 'archive_url', 'checked'];

function emitKeys(target, keys, indent = '') {
  const lines = [];
  for (const key of keys) {
    const value = target[key];
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${indent}${key} = ${tomlValue(value)}`);
  }
  return lines;
}

export function serializeEvidence({ slug, claims }) {
  const lines = [
    '# Sources for values in src/content/databases/' + slug + '.toml.',
    '# Written by scripts/import-research.mjs and scripts/verify-quotes.mjs — edit values in the',
    '# catalogue entry, not here; scripts/check-evidence.mjs fails the build if the two disagree.',
    '',
    `slug = ${tomlString(slug)}`,
  ];

  for (const claim of claims) {
    lines.push('', '[[claims]]', ...emitKeys(claim, CLAIM_KEYS));
    for (const source of claim.sources ?? []) {
      lines.push('', '  [[claims.sources]]', ...emitKeys(source, SOURCE_KEYS, '  '));
    }
  }

  return lines.join('\n') + '\n';
}

export function writeEvidence(evidence) {
  const path = evidencePath(evidence.slug);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeEvidence(evidence));
  return path;
}
