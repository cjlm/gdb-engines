# Evidence

Catalogue values used to be unsourced assertions. This is the layer that fixes that: every value
collected under it carries the pages it came from, and every one of those citations has been
mechanically confirmed before it ships.

`protocols` is the first field collected this way. The rest of the catalogue is not yet covered.

## Where things live

| Path | What it holds |
|------|---------------|
| `src/content/databases/<slug>.toml` | the catalogue entry — the values themselves |
| `src/content/evidence/<slug>.toml` | the sources behind particular values |
| `src/lib/protocols.ts` | the closed protocol vocabulary |
| `scripts/import-research.mjs` | turns a research pass into entries + evidence |
| `scripts/verify-quotes.mjs` | refetches cited pages and confirms the quotes |
| `scripts/check-evidence.mjs` | build gate: values and evidence must agree |

Evidence sits beside the entry rather than inside it so the catalogue TOML stays readable and so a
value and its provenance can be reviewed as separate diffs.

## The shape of a claim

```toml
slug = "neo4j"

[[claims]]
field = "protocols"
value = ["Bolt", "HTTP/REST"]
confidence = "high"
method = "vendor-docs"
checked = "2026-07-31"

  [[claims.sources]]
  url = "https://neo4j.com/docs/bolt/current/bolt/"
  title = "Bolt Protocol"
  quote = "Bolt is an application protocol for the execution of database queries via a database query language, such as Cypher."
  verified = "matched"
  checked = "2026-07-31"
```

`value` restates the catalogue value the sources were gathered for. That redundancy is the point —
see the build gate below.

## Why the quote matters more than the URL

The characteristic way an LLM research pass fails is not getting the answer wrong. It is getting
the answer *right* and inventing the citation: a plausible URL, a plausible sentence, neither real.
Reviewing the values never catches this, because the value looks fine.

So every source carries a verbatim quote, and `verify-quotes.mjs` refetches the page and checks the
quote is on it. No model is involved in that check. A fabricated citation fails it outright.

Verdicts:

- **matched** — the quote is on the live page.
- **matched-archive** — the original wouldn't load, but an Internet Archive snapshot carries the
  quote. Weaker than the live page, and the engine page labels it as such, but far better than an
  unverifiable link. Vendor docs disappearing behind a bot wall is common and is no fault of the
  research.
- **mismatch** — the page loaded and does not contain the quote. Treat the claim as unsourced and
  research it again; do not reword the quote to fit.
- **unreachable** — the fetch failed and no snapshot has the quote either. Not a verdict on the
  quote — it needs a human.

Both matched states are published. Anything else is held back.

Verdicts are not perfectly stable. Some hosts (Google Cloud docs especially) serve different
content run to run, so an occasional `mismatch` on a previously-matched source is worth re-running
before treating as real. A quote that fails twice is a genuine failure.

Comparison is on words alone, with punctuation and markup dropped. GitHub `/blob/` URLs resolve to
`raw.githubusercontent.com`, since GitHub renders file contents client-side and quoting a line of
source is legitimate evidence. PDFs are extracted with `pdftotext`, rejoining line-ending hyphens
first so a paper breaking "protocol" across two lines doesn't fail an accurate quote. Without
poppler on PATH, PDFs degrade to `unreachable` rather than failing every quote in a paper. Stripping a `<code>` tag turns
"the SPARQL Protocol; the Graph Store Protocol" into "protocol ; the", and an accurately copied
quote would otherwise fail. Pages that refuse a non-browser user agent get one retry as a browser
before a quote is called fabricated — a false accusation is worse than a missed check.

## The build gate

`check-evidence.mjs` runs in `prebuild` and fails the build when:

- a claim's `value` no longer matches the entry it describes — someone corrected the value and left
  the sources pointing at the old answer, which is how this data would otherwise rot invisibly;
- a claim names a field the entry doesn't set;
- a field in `REQUIRE_EVIDENCE` ships with no claim behind it;
- every quote for a claim failed verification.

Unverified and unreachable quotes warn rather than fail, so a source going offline doesn't block a
release.

## Running a collection pass

1. **Take the deterministic route first.** Licences, archived status and packaging facts come from
   the GitHub, Docker Hub and package-registry APIs, with the API response as the source. Cheaper
   and more accurate than asking a model. Only send the residue to research.
2. **Fan out.** One subagent per small batch of engines, given the field list, the controlled
   vocabulary, and the evidence rules. Insist on `unknown` over a guess, and tell them the prior
   value is a hypothesis rather than a source — the uncited protocol draft this replaced was wrong
   for Alibaba GDB, Altair Graph Lakehouse, GraphScope and PuppyGraph, and agents shown a draft
   will otherwise ratify it.
3. **Import** with `import-research.mjs`. Off-vocabulary values and unknown slugs are reported and
   skipped rather than written.
4. **Verify** with `verify-quotes.mjs`, then re-research anything that mismatched.
5. **Run a blind second pass.** Re-research every engine from scratch, giving the agents only the
   engine's identity — no draft, no current value. This is the only check that catches an
   *omission*; the quote check is silent about protocols nobody thought to look for. Expect around
   70% exact agreement.
6. **Adjudicate the disagreements.** Show a third agent both answers with their citations,
   unlabelled and in shuffled order so the incumbent doesn't anchor the decision, and have it rule
   from primary sources. On the first run this split 17 / 15 / 3 between the two passes and
   "neither" — no pass was reliably better, which is why the labels have to be hidden.
7. **Read the `neither` rulings yourself.** They are where both passes missed something. MarkLogic
   turned out to speak five client protocols where each pass had found three different ones.

## Known gaps

- Four citations remain unverifiable: pages that refuse automated fetches and have no archive
  snapshot.
- Only `protocols` is covered. Licence, release date, implementation language and the feature
  scores are still unsourced.
