# Review Open Database Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Review every currently open database-submission issue and add each candidate that meets the repository catalogue criteria.

**Architecture:** Treat each issue as an independent research record, using official project sources and repository conventions to decide whether it is a graph database/engine/extension and to populate only verified fields. Create one TOML entry per qualifying candidate, add one dated changelog line covering the batch, and validate the generated pages with the existing Astro build.

**Tech Stack:** Astro, TypeScript, TOML content collections, Zod schema validation, Node.js/npm, GitHub issues, Exa research workflow.

**Spec:** /Users/cjlm/.claude/skills/adding-databases/SKILL.md

## Global Constraints

- Review all ten open issues: #101 GQLDB, #100 LatticeDB, #99 qbix, #98 CozoDB, #96 SeleneDB, #95 Lora, #94 DuckGQL, #93 Duck RDF, #92 OxidDB, and #91 AstraeaDB.
- Add only graph databases, graph engines, graph extensions, graph query engines, embedded graph databases, or graph libraries that satisfy the repository schema and catalogue scope.
- Use unknown or omit optional fields when evidence is insufficient; never guess enum values, release dates, licenses, or vendor claims.
- Match the catalogue description tone: factual, neutral, present tense, 1–3 sentences, data model plus distinguishing features, no marketing language or unshipped features.
- Omit [features] blocks for all new entries.
- Add a dated entry at the top of the changelog in src/pages/about.astro.
- Do not close, comment on, or otherwise modify GitHub issues.
- Keep all work on the local branch review-open-database-issues; do not push or create a pull request.

---

### Task 1: Establish catalogue and schema conventions

**Files:**
- Read: src/content.config.ts
- Read: src/pages/about.astro
- Read: src/content/databases/*.toml
- Read: package.json

- [ ] **Step 1: Inspect the content schema and existing entry patterns**

Run:

~~~
sed -n '1,260p' src/content.config.ts
sed -n '1,220p' src/pages/about.astro
rg '^description = ' src/content/databases/*.toml | sed -n '1,80p'
~~~

Record the accepted enum values, required fields, changelog markup, and representative description style before drafting entries.

- [ ] **Step 2: Confirm the open issue set from GitHub**

Run:

~~~
gh issue list --state open --limit 100 --json number,title,url
~~~

Confirm that the ten issue numbers in the Global Constraints are still open and use each issue’s title/URL as the research input.

### Task 2: Research and classify every open candidate

**Files:**
- Read: GitHub issue pages and linked project documentation/repositories
- Temporary: research notes outside the repository or in /tmp

- [ ] **Step 1: Research each candidate with Exa’s search workflow**

For each candidate, search the project name and linked URL, requesting highlights only. Follow known URLs with contents extraction when needed. Prefer official documentation, repository metadata, release history, and license files; use independent sources only to validate adoption or production claims.

- [ ] **Step 2: Build a research matrix**

For every candidate record: official name, vendor, canonical URL, GitHub URL, license, implementation language, data model, query languages, kind, release date, category, status, GDOTV support, slug, inclusion decision, evidence URLs, and confidence. Use unknown/omission where a field cannot be verified.

- [ ] **Step 3: Apply the inclusion rules**

Include a candidate only when the evidence establishes that it belongs in a graph-database catalogue and has enough verified information to create a valid entry. Exclude non-graph projects, duplicates already present in src/content/databases/, abandoned prototypes without a usable catalogue identity when the repository’s criteria reject them, and candidates whose issue does not identify a verifiable project.

### Task 3: Add qualifying catalogue entries

**Files:**
- Create: one src/content/databases/<slug>.toml per candidate accepted in Task 2

- [ ] **Step 1: Draft each accepted TOML entry from the research matrix**

Use this field order and omit optional fields that are not verified:

~~~
name = "Verified official name"
vendor = "Verified vendor or project owner"
slug = "lowercase-slug"
description = "Neutral catalogue description."
url = "https://verified-project-url.example"
github_url = "https://github.com/owner/repository"
license = "SPDX-identifier"
implementation_language = "Verified language"
type = "Property Graph"
query_languages = ["GQL"]
kind = "embedded"
released = "YYYY-MM"
category = "Emerging"
gdotv_support = false
~~~

Use Property Graph, RDF, Multiple, or Other only according to the local skill’s definitions; use database, extension, query-engine, embedded, or library according to what the project actually is.

- [ ] **Step 2: Compare each description against existing entries**

Ensure each description starts with A or An, names the data model and one or two distinguishing features, states lineage where relevant, and contains no marketing or roadmap claims.

- [ ] **Step 3: Check slug and filename consistency**

Run:

~~~
for file in src/content/databases/*.toml; do
  slug=$(sed -n 's/^slug = "\([^"]*\)"/\1/p' "$file")
  test "$(basename "$file" .toml)" = "$slug" || echo "slug mismatch: $file"
done
~~~

Resolve every reported mismatch for the newly created files before building.

### Task 4: Update the changelog

**Files:**
- Modify: src/pages/about.astro

- [ ] **Step 1: Add the dated batch entry**

Insert a concise entry at the top of the existing <dl class="changelog"> that names the accepted databases added from the reviewed open issues. Do not mention excluded candidates as catalogue additions.

- [ ] **Step 2: Review the resulting markup**

Run:

~~~
git diff -- src/pages/about.astro
~~~

Confirm the new date and description are inside the existing changelog structure and do not alter unrelated history.

### Task 5: Validate the branch

**Files:**
- Read: generated dist/db/<slug>/index.html files for every accepted candidate

- [ ] **Step 1: Run the full Astro build**

Run:

~~~
npx astro build
~~~

Expected: exit code 0 with no content-collection, Zod, TOML, or URL validation errors.

- [ ] **Step 2: Verify generated pages**

Run:

~~~
for file in src/content/databases/*.toml; do
  slug=$(sed -n 's/^slug = "\([^"]*\)"/\1/p' "$file")
  test -f "dist/db/$slug/index.html" || echo "missing page: $slug"
done
~~~

Expected: no missing page output, including every newly accepted candidate.

- [ ] **Step 3: Review the final diff and branch state**

Run:

~~~
git status --short --branch
git diff --stat
git diff --check
git diff -- src/content/databases src/pages/about.astro
~~~

Confirm that only the intended plan, accepted database entries, and changelog update are present, with no credentials, generated artifacts, or unrelated modifications.

- [ ] **Step 4: Commit the completed local branch**

Run:

~~~
git add docs/superpowers/plans/2026-08-26-review-open-database-issues.md src/content/databases src/pages/about.astro
git commit -m "feat: add qualifying open database issues"
~~~

Do not push the branch or create a pull request.

