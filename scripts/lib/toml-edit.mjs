/**
 * Line-level edits to catalogue entries.
 *
 * Entries are edited as text rather than reparsed and re-emitted, so hand-written key order,
 * spacing and comments survive a tooling pass. Every catalogue value is a simple scalar or a flat
 * array of strings on one line, which makes this safe without a full round-trip.
 */
import { readFileSync, writeFileSync } from 'node:fs';

function render(key, value) {
  const literal = Array.isArray(value)
    ? `[${value.map((v) => JSON.stringify(v)).join(', ')}]`
    : JSON.stringify(value);
  return `${key} = ${literal}`;
}

/**
 * Sets `key` in a catalogue TOML, inserting it after one of `anchors` when absent. An empty array
 * or null removes the key. Returns true when the file changed.
 *
 * Only the top-level table is touched: the search stops at the first `[section]` header so a key
 * inside `[features]` can never be mistaken for its top-level namesake.
 */
export function upsertField(path, key, value, anchors = []) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const topLevelEnd = lines.findIndex((l) => /^\[/.test(l));
  const limit = topLevelEnd === -1 ? lines.length : topLevelEnd;
  const existing = lines.findIndex((l, i) => i < limit && l.startsWith(`${key} = `));

  if (value === null || (Array.isArray(value) && value.length === 0)) {
    if (existing === -1) return false;
    lines.splice(existing, 1);
    writeFileSync(path, lines.join('\n'));
    return true;
  }

  const rendered = render(key, value);
  if (existing !== -1) {
    if (lines[existing] === rendered) return false;
    lines[existing] = rendered;
  } else {
    let anchor = -1;
    for (const a of anchors) {
      anchor = lines.findIndex((l, i) => i < limit && l.startsWith(`${a} = `));
      if (anchor !== -1) break;
    }
    if (anchor === -1) throw new Error(`${path}: no anchor among ${anchors.join(', ')} for "${key}".`);
    lines.splice(anchor + 1, 0, rendered);
  }

  writeFileSync(path, lines.join('\n'));
  return true;
}
