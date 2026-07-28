/**
 * The add-database combobox and the client-side comparison builder.
 *
 * Progressive enhancement: pre-generated pages render server-side and this only mounts if
 * the script runs. `/compare/custom/` is noindex, so the JS-only path costs nothing in
 * search — it exists so a visitor whose combination was not pre-generated still gets a
 * comparison.
 */
interface Engine {
  slug: string;
  name: string;
  aliases: string[];
  icon: string;
  rank: number | null;
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

  const params = new URLSearchParams(location.search);
  let selected = params.getAll('db').filter((s) => bySlug.has(s));
  // The `_redirects` splat forwards unmatched pair URLs here, typos included: a `?pair=`
  // that is not exactly two known slugs falls through to the empty state.
  const pair = params.get('pair');
  if (!selected.length && pair) {
    const parts = pair.split('-vs-');
    if (parts.length === 2 && parts.every((p) => bySlug.has(p))) selected = parts;
  }
  selected = selected.slice(0, MAX_COLUMNS);

  const input = root.querySelector<HTMLInputElement>('[data-combobox-input]')!;
  const listbox = root.querySelector<HTMLElement>('[data-combobox-list]')!;
  const chips = root.querySelector<HTMLElement>('[data-combobox-chips]')!;
  const live = root.querySelector<HTMLElement>('[data-combobox-live]')!;
  const empty = root.querySelector<HTMLElement>('[data-compare-empty]');
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
    if (empty) empty.hidden = selected.length >= 2;
  }

  function renderList(): void {
    matches = search(input.value);
    if (active >= matches.length) active = 0;
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

  /** The builder links out to a rendered comparison rather than re-implementing the table. */
  function renderColumns(): void {
    const target = root.querySelector<HTMLElement>('[data-compare-result]');
    if (!target) return;
    if (selected.length < 2) {
      target.innerHTML = '';
      return;
    }
    target.innerHTML = `<ul class="combobox-result">${selected
      .map((slug) => `<li><a href="/db/${slug}/">${bySlug.get(slug)!.name}</a></li>`)
      .join('')}</ul>`;
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
  if (canonical) {
    location.replace(canonical);
    return;
  }

  root.hidden = false;
  renderChips();
  renderList();
  renderColumns();
}
