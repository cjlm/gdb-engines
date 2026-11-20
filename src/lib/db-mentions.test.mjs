import assert from 'node:assert/strict';
import test from 'node:test';

const { decorateProfileLinks, engineSummary, linkEngineMentions, linkedProfileSlugs, mentionLinkHtml } = await import('./db-mentions.ts');

const engines = [
  { slug: 'neo4j', name: 'Neo4j', summary: 'A property graph database.' },
  { slug: 'neo4j-aura', name: 'Neo4j Aura', summary: 'Managed Neo4j.' },
  { slug: 'kuzu', name: 'Kuzu', aliases: ['KuzuDB'], summary: 'An embedded graph database.' },
  { slug: 'traverse', name: 'Traverse', summary: 'Ambiguous name.' },
];
const plain = (engine, text) => `[${engine.slug}:${text}]`;
const run = (html) => linkEngineMentions(html, engines, plain, new Set(['Traverse']));

test('links only the first mention of each engine', () => {
  const { html, linked } = run('<p>Neo4j is old. Neo4j is big.</p><p>Neo4j again.</p>');
  assert.equal(html, '<p>[neo4j:Neo4j] is old. Neo4j is big.</p><p>Neo4j again.</p>');
  assert.deepEqual(linked, [{ slug: 'neo4j', text: 'Neo4j' }]);
});

test('aliases match, and the longest name wins at the same place', () => {
  assert.equal(run('<p>KuzuDB and Neo4j Aura.</p>').html, '<p>[kuzu:KuzuDB] and [neo4j-aura:Neo4j Aura].</p>');
});

test('matches whole words only, case-sensitive', () => {
  assert.equal(run('<p>neo4j-like and Neo4jX and neo4j</p>').html, '<p>neo4j-like and Neo4jX and neo4j</p>');
});

test('skips links, code, headings, quotes, figures and asides', () => {
  const html = '<h2>Neo4j</h2><blockquote><p>Neo4j</p></blockquote><aside>Neo4j</aside><p><a href="/x">Neo4j</a> <code>Neo4j</code></p><figure>Neo4j</figure><p>Neo4j</p>';
  assert.ok(run(html).html.endsWith('<figure>Neo4j</figure><p>[neo4j:Neo4j]</p>'));
  assert.ok(run(html).html.startsWith('<h2>Neo4j</h2><blockquote><p>Neo4j</p></blockquote><aside>Neo4j</aside><p><a href="/x">Neo4j</a> <code>Neo4j</code></p>'));
  assert.equal(run(html).linked.length, 1);
});

test('an engine the post already links to is left alone', () => {
  const html = '<p>Kuzu, see <a href="https://gdb-engines.com/db/kuzu/">here</a>.</p>';
  assert.equal(run(html).html, html);
});

test('names that are ordinary words are never linked automatically', () => {
  assert.equal(run('<p>Traverse the graph.</p>').html, '<p>Traverse the graph.</p>');
});

test('the tooltip line is the first sentence, cut at a word', () => {
  assert.equal(engineSummary('An embedded database. It is fast.'), 'An embedded database.');
  const long = engineSummary(`${'word '.repeat(40)}end.`, 40);
  assert.ok(long.length <= 40 && long.endsWith('…'));
});

test('link markup carries a logo, a described-by card with rank and chips, all escaped', () => {
  const engine = { slug: 'kuzu', name: 'Kuzu', summary: 'A "quoted" <db>', rank: 3, chips: ['Embedded', 'MIT'] };
  const html = mentionLinkHtml(engine, 'Kuzu', { icon: { src: '/logos/kuzu.png', backfill: true }, cardId: 'm1', rankTotal: 158 });
  assert.match(html, /^<a class="db-mention" href="\/db\/kuzu\/" aria-describedby="m1">/);
  assert.match(html, /<span class="db-card" id="m1" role="tooltip">/);
  assert.match(html, /#3<small> of 158<\/small>/);
  assert.match(html, /<span class="db-card-chip">Embedded<\/span><span class="db-card-chip">MIT<\/span>/);
  assert.match(html, /A &quot;quoted&quot; &lt;db&gt;/);
  assert.match(html, /database-logo--needs-backfill/);
  assert.match(html, />Kuzu<\/a>$/);
  const bare = mentionLinkHtml({ slug: 'k', name: 'K', summary: 's' }, 'K', { cardId: 'm2' });
  assert.doesNotMatch(bare, /<img|db-card-rank|db-card-chips/);
});

test('existing profile links get the tooltip and logo, unknown slugs are untouched', () => {
  const html = '<p><a href="https://gdb-engines.com/db/kuzu/">Kuzu</a> and <a href="/db/nope/">x</a></p>';
  assert.deepEqual(linkedProfileSlugs(html), ['kuzu', 'nope']);
  const out = decorateProfileLinks(html, engines, () => ({ cardId: 'c1' }));
  assert.match(out, /<a class="db-mention" href="\/db\/kuzu\/" aria-describedby="c1"><span class="db-card" id="c1"[^]*?<\/span>Kuzu<\/a>/);
  assert.match(out, /<a href="\/db\/nope\/">x<\/a>/);
});
