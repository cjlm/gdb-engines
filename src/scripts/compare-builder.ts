/**
 * The add-database combobox and the client-side comparison builder.
 *
 * Progressive enhancement: pre-generated pages render server-side and this only mounts if
 * the script runs. `/compare/custom/` is noindex, so the JS-only path costs nothing in
 * search — it exists so a visitor whose combination was not pre-generated still gets a
 * comparison.
 */
import { featureGroups, featureDisplayNames, featureKeys } from '../data/feature-metadata';
import { formatCompactCount } from '../lib/format-number';

interface Engine {
  slug: string;
  name: string;
  aliases: string[];
  icon: string;
  rank: number | null;
  score?: number;
  vendor?: string;
  type?: string;
  kind?: string;
  category?: string;
  released?: number | string;
  status?: string;
  status_note?: string;
  license?: string;
  implementation_language?: string;
  query_languages?: string[];
  gdotv_support?: boolean;
  github_stars?: number;
  features?: Record<string, number | undefined>;
}

const MAX_COLUMNS = 4;

const root = document.querySelector<HTMLElement>('[data-compare-builder]');
if (root) void mount(root);

async function mount(root: HTMLElement): Promise<void> {
  const res = await fetch('/compare-index.json');
  if (!res.ok) return;
  const { engines, pregenerated } = (await res.json()) as { engines: Engine[]; pregenerated: string[] };
  const bySlug = new Map(engines.map((e) => [e.slug, e]));
  const pregeneratedSet = new Set(pregenerated);

  // A pre-generated pair or roundup page renders its comparison server-side; the combobox
  // there is a navigation control, not a renderer (§4.4).
  const staticPage = root.dataset.mode === 'static';

  const params = new URLSearchParams(location.search);
  let selected = params.getAll('db').filter((s) => bySlug.has(s));
  // 404.astro forwards unmatched pair URLs here, typos included: a `?pair=` that is
  // not exactly two known slugs falls through to the empty state.
  const pair = params.get('pair');
  if (!selected.length && pair) {
    const parts = pair.split('-vs-');
    if (parts.length === 2 && parts.every((p) => bySlug.has(p))) selected = parts;
  }
  // Pre-seed with the engines this page already compares.
  if (!selected.length) {
    selected = (root.dataset.seed ?? '').split(' ').filter((s) => bySlug.has(s));
  }
  selected = selected.slice(0, MAX_COLUMNS);

  const input = root.querySelector<HTMLInputElement>('[data-combobox-input]')!;
  const listbox = root.querySelector<HTMLElement>('[data-combobox-list]')!;
  const chips = root.querySelector<HTMLElement>('[data-combobox-chips]')!;
  const live = root.querySelector<HTMLElement>('[data-combobox-live]')!;
  let active = 0;
  let matches: Engine[] = [];

  /** A pair that was pre-generated is the faster, indexable page — go there instead. */
  function canonicalPair(slugs: string[]): string | null {
    if (slugs.length !== 2) return null;
    const slug = [...slugs].sort().join('-vs-');
    return pregeneratedSet.has(slug) ? `/compare/${slug}/` : null;
  }

  function syncUrl(): void {
    const canonical = canonicalPair(selected);
    if (canonical && location.pathname !== canonical) {
      location.assign(canonical);
      return;
    }
    if (staticPage) {
      // Already on the canonical page for this selection — nothing to navigate to. A
      // half-finished swap (one column removed, none added yet) waits for the next add
      // rather than dumping the visitor in the builder.
      if (canonical || selected.length < 2) return;
      const query = new URLSearchParams();
      for (const slug of [...selected].sort()) query.append('db', slug);
      location.assign(`/compare/custom/?${query}`);
      return;
    }
    const next = new URLSearchParams();
    for (const slug of [...selected].sort()) next.append('db', slug);
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
    track();
  }

  let trackTimer: number | undefined;
  function track(): void {
    window.clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => {
      const seline = (window as unknown as { seline?: { track: (n: string, p: unknown) => void } }).seline;
      if (!seline || selected.length < 2) return;
      const sorted = [...selected].sort();
      seline.track('compare_custom', { engines: sorted.join(','), count: sorted.length });
    }, 2000);
  }

  function monogram(engine: Engine): string {
    return `<span class="combobox-monogram" aria-hidden="true">${engine.name.charAt(0)}</span>`;
  }

  function iconHtml(engine: Engine): string {
    // No PNG means fetchFavicon fell back to the site's own icon, which would read as
    // though the engine belonged to GDB-Engines. A monogram is honest and free.
    return `<img src="${engine.icon}" alt="" width="16" height="16" loading="lazy"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'combobox-monogram',textContent:'${engine.name.charAt(0).replace(/'/g, '')}'}))" />`;
  }

  function rank(engine: Engine): number {
    return engine.rank ?? Number.POSITIVE_INFINITY;
  }

  function search(query: string): Engine[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...engines].sort((x, y) => rank(x) - rank(y)).slice(0, 20);
    const score = (e: Engine): number => {
      const name = e.name.toLowerCase();
      if (e.slug === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      if (e.aliases.some((a) => a.toLowerCase().includes(q))) return 3;
      return 99;
    };
    return engines
      .map((e) => ({ e, s: score(e) }))
      .filter((x) => x.s < 99)
      .sort((x, y) => x.s - y.s || rank(x.e) - rank(y.e))
      .map((x) => x.e)
      .slice(0, 20);
  }

  function renderChips(): void {
    chips.innerHTML = selected
      .map((slug) => {
        const engine = bySlug.get(slug)!;
        return `<span class="combobox-chip">${iconHtml(engine)}${engine.name}<button type="button" data-remove="${slug}" aria-label="Remove ${engine.name}">×</button></span>`;
      })
      .join('');
    for (const button of chips.querySelectorAll<HTMLButtonElement>('[data-remove]')) {
      button.addEventListener('click', () => remove(button.dataset.remove!));
    }
    input.disabled = selected.length >= MAX_COLUMNS;
    input.placeholder = input.disabled ? 'Remove a database to add another' : 'Add a database';
    syncAddColumn();
  }

  /**
   * The "+" affordance, in one place for both surfaces: the header row of every table
   * marked `data-compare-table`, whether this script rendered it or the page shipped it.
   *
   * It is written by the script and never by the server, so a page without JS is unchanged
   * (§4.5), and it only appears while a column can still be added. A wide roundup mounts no
   * combobox at all, so this never runs there.
   */
  function syncAddColumn(): void {
    const canAdd = selected.length < MAX_COLUMNS;
    for (const table of document.querySelectorAll<HTMLTableElement>('[data-compare-table]')) {
      const row = table.tHead?.rows[0];
      if (!row) continue;
      const existing = row.querySelector('.add-col');
      if (!canAdd) {
        existing?.remove();
        continue;
      }
      if (existing) continue;
      const slot = row.insertCell(-1);
      slot.className = 'add-col';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'add-col-btn';
      button.title = 'Add a database to compare';
      button.setAttribute('aria-label', 'Add a database to compare');
      button.innerHTML = '<span aria-hidden="true">+</span>';
      // focus() scrolls the combobox back into view, and its focus handler opens the list.
      button.addEventListener('click', () => input.focus());
      slot.append(button);
    }
  }

  function renderList(): void {
    matches = search(input.value);
    if (active >= matches.length) active = 0;
    if (!matches.length) {
      listbox.innerHTML = `<li class="combobox-empty" aria-disabled="true">No databases match “${esc(input.value.trim())}”</li>`;
      announce('No matches');
      input.setAttribute('aria-activedescendant', '');
      return;
    }
    listbox.innerHTML = matches
      .map((engine, i) => {
        const isSelected = selected.includes(engine.slug);
        return `<li role="option" id="cbo-${engine.slug}" class="combobox-option${i === active ? ' is-active' : ''}"
          aria-selected="${i === active}"${isSelected ? ' aria-disabled="true"' : ''}>${iconHtml(engine)}<span>${engine.name}</span>${isSelected ? '<span class="combobox-selected">Selected</span>' : ''}</li>`;
      })
      .join('');
    input.setAttribute('aria-activedescendant', matches[active] ? `cbo-${matches[active]!.slug}` : '');
    for (const [i, option] of [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].entries()) {
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        add(matches[i]!.slug);
      });
    }
  }

  function announce(message: string): void {
    live.textContent = message;
  }

  function add(slug: string): void {
    if (selected.includes(slug) || selected.length >= MAX_COLUMNS) return;
    selected.push(slug);
    input.value = '';
    renderChips();
    renderList();
    announce(`${bySlug.get(slug)!.name} added, ${selected.length} databases selected`);
    syncUrl();
    renderColumns();
  }

  function remove(slug: string): void {
    selected = selected.filter((s) => s !== slug);
    renderChips();
    renderList();
    announce(`${bySlug.get(slug)!.name} removed, ${selected.length} databases selected`);
    syncUrl();
    renderColumns();
  }

  function esc(value: unknown): string {
    return String(value ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  const EM_DASH = '—';

  function scoreOf(engine: Engine, key: string): number | null {
    const value = engine.features?.[key];
    return typeof value === 'number' ? value : null;
  }

  /** The three states §2.4 keeps apart: scored, assessed-absent, never assessed. */
  function cell(engine: Engine, key: string): string {
    const value = scoreOf(engine, key);
    if (value === null) return `<td class="cell-unassessed">${EM_DASH}</td>`;
    if (value === 1) return '<td class="cell-yes">&#10003;</td>';
    if (value === 0) return '<td class="cell-no">&#183;</td>';
    return `<td class="cell-partial">${value}</td>`;
  }

  function factRow(label: string, values: (string | null | undefined)[], mono = false): string {
    const cells = values.map((v) => `<td${mono ? ' class="num"' : ''}>${esc(v || EM_DASH)}</td>`).join('');
    const differs = new Set(values.map((v) => v || EM_DASH)).size > 1;
    return `<tr class="${differs ? 'differs' : ''}"><th scope="row">${esc(label)}</th>${cells}</tr>`;
  }

  /**
   * A real 2–4 column comparison, same shape and same missing-data rules as the
   * pre-generated pair pages (§2.4, §4.3): unsurveyed engines render a full band of
   * em-dashes, and the difference count is suppressed unless every column is surveyed.
   */
  function renderColumns(): void {
    const target = root.querySelector<HTMLElement>('[data-compare-result]');
    if (!target) return;
    if (selected.length < 2) {
      target.innerHTML = '';
      return;
    }
    const cols = selected.map((slug) => bySlug.get(slug)!);
    const unsurveyed = cols.filter((e) => !e.features);
    const allSurveyed = unsurveyed.length === 0;
    const anySurveyed = unsurveyed.length < cols.length;

    const head = `<thead><tr><th scope="col">Feature</th>${cols
      .map((e) => `<th scope="col"><a href="/db/${esc(e.slug)}/">${esc(e.name)}</a></th>`)
      .join('')}</tr></thead>`;

    const fundamentals = [
      factRow('Rank', cols.map((e) => (e.rank ? `#${e.rank}` : null)), true),
      factRow('Score', cols.map((e) => (typeof e.score === 'number' ? e.score.toFixed(1) : null)), true),
      ...(cols.some((e) => typeof e.github_stars === 'number')
        ? [factRow('GitHub stars', cols.map((e) => (typeof e.github_stars === 'number' ? formatCompactCount(e.github_stars) : null)), true)]
        : []),
      factRow('Vendor', cols.map((e) => e.vendor)),
      factRow('Model', cols.map((e) => e.type)),
      factRow('Kind', cols.map((e) => e.kind)),
      factRow('Category', cols.map((e) => e.category)),
      factRow('First released', cols.map((e) => (e.released == null ? null : String(e.released))), true),
      factRow('Status', cols.map((e) => (e.status === 'active' ? 'active' : [e.status, e.status_note].filter(Boolean).join(` ${EM_DASH} `)))),
      factRow('License', cols.map((e) => e.license)),
      factRow('Written in', cols.map((e) => e.implementation_language)),
      factRow('Query languages', cols.map((e) => (e.query_languages ?? []).join(', '))),
      factRow('gdotv support', cols.map((e) => (e.gdotv_support == null ? null : e.gdotv_support ? 'yes' : 'no'))),
    ].join('');

    const differs = (key: string): boolean => {
      if (!allSurveyed) return false;
      const scores = cols.map((e) => scoreOf(e, key)).filter((v): v is number => v !== null);
      return new Set(scores).size > 1;
    };
    const differCount = allSurveyed ? featureKeys.filter(differs).length : 0;

    const featureBody = featureGroups
      .map((group) => {
        const rows = group.features
          .map(
            (key) =>
              `<tr class="${differs(key) ? 'differs' : ''}"><th scope="row">${esc(
                featureDisplayNames[key] ?? key
              )}</th>${cols.map((e) => cell(e, key)).join('')}</tr>`
          )
          .join('');
        return `<tr class="group-row"><th scope="row" colspan="${cols.length + 1}">${esc(group.name)}</th></tr>${rows}`;
      })
      .join('');

    const countLabel = allSurveyed
      ? `<span class="differ-count num">${differCount} of ${featureKeys.length} rows differ</span>`
      : `<span class="differ-count">${EM_DASH} not surveyed for ${esc(unsurveyed.map((e) => e.name).join(' or '))}</span>`;

    target.innerHTML = `
      <table class="compare-table" data-compare-table>
        ${head}
        <tbody>
          <tr class="group-row"><th scope="row" colspan="${cols.length + 1}">Fundamentals</th></tr>
          ${fundamentals}
        </tbody>
      </table>
      <h2 class="feature-heading">Feature scores ${countLabel}</h2>
      ${
        anySurveyed
          ? `<table class="compare-table"><tbody>${featureBody}</tbody></table>`
          : `<p class="empty">No survey feature scores for ${esc(cols.map((e) => e.name).join(' or '))}.</p>`
      }`;
    // innerHTML replaced the table this was written into.
    syncAddColumn();
  }

  input.addEventListener('input', () => {
    active = 0;
    renderList();
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  });
  input.addEventListener('focus', () => {
    renderList();
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  });
  input.addEventListener('blur', () => {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { active = (active + 1) % Math.max(matches.length, 1); renderList(); event.preventDefault(); }
    else if (event.key === 'ArrowUp') { active = (active - 1 + matches.length) % Math.max(matches.length, 1); renderList(); event.preventDefault(); }
    else if (event.key === 'Home') { active = 0; renderList(); event.preventDefault(); }
    else if (event.key === 'End') { active = Math.max(matches.length - 1, 0); renderList(); event.preventDefault(); }
    else if (event.key === 'Enter') { if (matches[active]) add(matches[active]!.slug); event.preventDefault(); }
    else if (event.key === 'Escape') { listbox.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    else if (event.key === 'Backspace' && !input.value && selected.length) { remove(selected[selected.length - 1]!); }
  });

  // A visitor who typed a pair backwards, or landed via the `_redirects` splat, is sent
  // straight to the canonical pre-generated page.
  const canonical = canonicalPair(selected);
  if (canonical && location.pathname !== canonical) {
    location.replace(canonical);
    return;
  }

  root.hidden = false;
  renderChips();
  renderList();
  renderColumns();
}
