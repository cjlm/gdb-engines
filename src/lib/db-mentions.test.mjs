import assert from 'node:assert/strict';
import test from 'node:test';

const { engineSummary, linkEngineMentions, mentionCardHtml } = await import('./db-mentions.ts');

const engines = [
  { slug: 'neo4j', name: 'Neo4j', summary: 'A property graph database.' },
  { slug: 'neo4j-aura', name: 'Neo4j Aura', summary: 'Managed Neo4j.' },
  { slug: 'kuzu', name: 'Kuzu', aliases: ['KuzuDB'], summary: 'An embedded graph database.' },
  { slug: 'falkordblite', name: 'FalkorDBLite', summary: 'Embedded FalkorDB.' },
  { slug: 'traverse', name: 'Traverse', summary: 'Ambiguous name.' },
];
let n = 0;
const extras = () => ({ cardId: `c${++n}` });
const run = (html) => {
  n = 0;
  return linkEngineMentions(html, engines, extras, new Set(['Traverse']));
};

test('every mention of an engine becomes a link with its own card beside it', () => {
  const { html, linked } = run('<p>Neo4j is old. Neo4j is big.</p>');
  assert.match(html, /^<p><span class="db-mention-wrap"><a class="db-mention" href="\/db\/neo4j\/" aria-describedby="c1">Neo4j<\/a><span class="db-card" id="c1"/);
  assert.match(html, /aria-describedby="c2">Neo4j<\/a><span class="db-card" id="c2"/);
  assert.deepEqual(linked, [{ slug: 'neo4j', text: 'Neo4j' }, { slug: 'neo4j', text: 'Neo4j' }]);
});

test('mentions inside asides are decorated', () => {
  assert.deepEqual(run('<aside><p>Kuzu</p></aside>').linked.map((m) => m.slug), ['kuzu']);
});

test('aliases match, and the longest name wins at the same place', () => {
  assert.deepEqual(run('<p>KuzuDB and Neo4j Aura.</p>').linked.map((m) => m.slug), ['kuzu', 'neo4j-aura']);
});

test('matches whole words only, case-sensitive', () => {
  assert.equal(run('<p>neo4j-like and Neo4jX and neo4j</p>').linked.length, 0);
});

test('nothing in headings, quotes, code or figures changes', () => {
  const html = '<h2>Neo4j</h2><blockquote><p>Neo4j</p></blockquote><p><code>Neo4j</code></p><figure>Neo4j</figure>';
  assert.equal(run(html).html, html);
});

test('a link to an engine profile gets the logo and card and keeps its text', () => {
  const { html, linked } = run('<p>See <a href="https://gdb-engines.com/db/kuzu/">this one</a>, then Kuzu.</p>');
  assert.deepEqual(linked, [{ slug: 'kuzu', text: 'this one' }, { slug: 'kuzu', text: 'Kuzu' }]);
  assert.match(html, /<a class="db-mention" aria-describedby="c1" href="\/db\/kuzu\/">this one<\/a><span class="db-card"/);
});

test('another link naming an engine keeps its target and gets the logo and card', () => {
  const { html, linked } = run('<p>Neo4j <a href="https://neo4j.com/x">released Neo4j Aura</a>, and <a href="https://falkordb.com/lite">FalkorDBLite</a>.</p>');
  assert.deepEqual(linked.map((m) => m.slug), ['neo4j', 'neo4j-aura', 'falkordblite']);
  assert.match(html, /<a class="db-mention" aria-describedby="c2" href="https:\/\/neo4j.com\/x">released Neo4j Aura<\/a>/);
  assert.match(html, /<a class="db-mention" aria-describedby="c3" href="https:\/\/falkordb.com\/lite">FalkorDBLite<\/a>/);
});

test('names that are ordinary words are never linked automatically', () => {
  assert.equal(run('<p>Traverse the graph.</p>').linked.length, 0);
});

test('the card escapes text, links the profile, ranking and website, and shows the logo', () => {
  const engine = { slug: 'kuzu', name: 'Kuzu', summary: 'A "quoted" <db>', rank: 3, chips: ['Embedded', 'MIT'], since: 'Nov 2022', website: 'https://kuzu.io' };
  const card = mentionCardHtml(engine, { icon: { src: '/logos/kuzu.png', backfill: true }, cardId: 'm1', rankTotal: 158 });
  assert.match(card, /^<span class="db-card" id="m1">/);
  assert.match(card, /<a class="db-card-name" href="\/db\/kuzu\/">Kuzu<\/a>/);
  assert.match(card, /<a class="db-card-rank" href="\/rankings\/overall\/"[^>]*>#3<small> of 158<\/small><\/a>/);
  assert.match(card, /<span class="db-card-chip">Embedded<\/span><span class="db-card-chip">MIT<\/span>/);
  assert.match(card, /A &quot;quoted&quot; &lt;db&gt;/);
  assert.match(card, /href="https:\/\/kuzu.io" rel="noopener" target="_blank">Website ↗/);
  assert.match(card, /Website ↗<\/a><span class="db-card-since">Since Nov 2022<\/span><\/span><\/span>$/);
  assert.match(card, /database-logo--needs-backfill/);
  const bare = mentionCardHtml({ slug: 'k', name: 'K', summary: 's' }, { cardId: 'm2' });
  assert.doesNotMatch(bare, /<img|db-card-rank|db-card-chips|Website|Since/);
});

test('the card line is the first sentence, cut at a word', () => {
  assert.equal(engineSummary('An embedded database. It is fast.'), 'An embedded database.');
  const long = engineSummary(`${'word '.repeat(40)}end.`, 40);
  assert.ok(long.length <= 40 && long.endsWith('…'));
});
