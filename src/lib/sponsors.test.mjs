import assert from 'node:assert/strict';
import test from 'node:test';

const { isLive, sponsorFor, placementLink, parseSponsorFile } = await import('./sponsors.ts');

const at = (iso) => new Date(iso);

test('not live before start, live from start (UTC)', () => {
  const s = { start: '2026-11-01', end: null };
  assert.equal(isLive(s, at('2026-10-31T23:59:59Z'), false), false);
  assert.equal(isLive(s, at('2026-11-01T00:00:00Z'), false), true);
});

test('scheduled sponsors show when includeScheduled is set', () => {
  assert.equal(isLive({ start: '2026-11-01', end: null }, at('2026-10-27T00:00:00Z'), true), true);
});

test('live through the whole end day, gone the day after', () => {
  const s = { start: '2026-11-01', end: '2027-01-31' };
  assert.equal(isLive(s, at('2027-01-31T23:59:59Z'), false), true);
  assert.equal(isLive(s, at('2027-02-01T00:00:00Z'), false), false);
});

test('includeScheduled never revives an ended sponsor', () => {
  assert.equal(isLive({ start: '2026-01-01', end: '2026-02-01' }, at('2026-10-27T00:00:00Z'), true), false);
});

test('sponsorFor returns the first sponsor holding the placement', () => {
  const a = { id: 'a', placements: ['ranking-banner'] };
  const b = { id: 'b', placements: ['header', 'ranking-banner'] };
  assert.equal(sponsorFor([a, b], 'header')?.id, 'b');
  assert.equal(sponsorFor([a, b], 'ranking-banner')?.id, 'a');
  assert.equal(sponsorFor([a, b], 'compare-banner'), null);
  assert.equal(sponsorFor([], 'header'), null);
});

test('placementLink appends utm_content and keeps existing params', () => {
  const out = new URL(placementLink('https://x.test/p?utm_source=gdb-engines&utm_campaign=c', 'ranking-banner'));
  assert.equal(out.searchParams.get('utm_content'), 'ranking-banner');
  assert.equal(out.searchParams.get('utm_source'), 'gdb-engines');
  assert.equal(out.searchParams.get('utm_campaign'), 'c');
});

const valid = {
  id: 'acme', name: 'Acme', tier: 'founding', tagline: 't', description: 'd',
  link: 'https://acme.test/?utm_source=s&utm_medium=m&utm_campaign=c',
  logo: { light: 'sponsors/acme/l.svg', dark: 'sponsors/acme/d.svg' },
  start: '2026-11-01', end: null, placements: ['header'],
};

test('parseSponsorFile accepts a valid file and an empty list', () => {
  assert.equal(parseSponsorFile({ sponsors: [valid] }).length, 1);
  assert.deepEqual(parseSponsorFile({ sponsors: [] }), []);
});

test('parseSponsorFile rejects the old board-keyed format', () => {
  assert.throws(() => parseSponsorFile({ compare: { title: 'x' } }), /sponsors array/);
});

test('parseSponsorFile rejects bad entries with the sponsor id in the message', () => {
  assert.throws(() => parseSponsorFile({ sponsors: [{ ...valid, start: '1 Nov' }] }), /acme.*start/);
  assert.throws(() => parseSponsorFile({ sponsors: [{ ...valid, placements: ['sidebar'] }] }), /acme.*placement/);
  assert.throws(() => parseSponsorFile({ sponsors: [{ ...valid, link: 'http://acme.test' }] }), /acme.*https/);
  assert.throws(() => parseSponsorFile({ sponsors: [{ ...valid, logo: { light: 'x.png', dark: 'y.svg' } }] }), /acme.*svg/);
});
