const modal = document.getElementById("modal") as HTMLDialogElement;
const modalClose = document.getElementById("close")!;
const help = document.getElementById("help")!;
const search = document.getElementById("search")! as HTMLInputElement;
const dbCount = document.getElementById("db-count");
const inactiveToggle = document.getElementById('toggle-inactive') as HTMLInputElement | null;
const totalCount = document.querySelectorAll("table tbody tr").length;
// Column indices to search (Name, Vendor, Type, Kind, Category, Status, Query Languages)
const SEARCHABLE_COLUMNS = [0, 1, 2, 3, 4, 5, 8];
let inactiveAutoEnabled = false;

function updateCount() {
  if (!dbCount) return;
  const visible = document.querySelectorAll("table tbody tr:not([style*='display: none'])").length;
  dbCount.textContent = visible === totalCount ? String(totalCount) : `${visible} / ${totalCount}`;
}

function updateRowVisibility() {
  const showInactive = inactiveToggle?.checked ?? false;
  const searchValue = search.value.toLowerCase();
  const searchTerms = searchValue.split(",").map(s => s.trim()).filter(s => s !== "");
  const rows = document.querySelectorAll("table tbody tr") as NodeListOf<HTMLTableRowElement>;

  rows.forEach((row) => {
    const isInactive = row.classList.contains('row-inactive') || row.classList.contains('row-deprecated');
    const hasSearch = searchTerms.length > 0;

    let matchesSearch = true;
    if (hasSearch) {
      const searchableTexts = SEARCHABLE_COLUMNS.map((i) =>
        row.cells[i]?.textContent?.toLowerCase() || ""
      );
      const previousVendors = row.getAttribute('data-previous-vendors')?.toLowerCase() || '';
      if (previousVendors) searchableTexts.push(previousVendors);
      const previousNames = row.getAttribute('data-previous-names')?.toLowerCase() || '';
      if (previousNames) searchableTexts.push(previousNames);

      matchesSearch = searchTerms.some((term) => searchableTexts.some((text) => text.includes(term)));
    }

    const hiddenByInactive = isInactive && !showInactive;
    row.style.display = matchesSearch && !hiddenByInactive ? '' : 'none';
  });

  updateCount();
}

/////////////////////////
// URL State Management
/////////////////////////
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function updateQueryParams(updates: Record<string, string | null>) {
  const params = getQueryParams();
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  const newPath = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.pushState({}, "", newPath);
}

function getColumnNameForURL(headerEl: Element): string {
  const text = headerEl.textContent?.trim().toLowerCase() || "";
  return text.replace(/↑|↓/g, "").trim().split(/\s+/).slice(0, 2).join("-");
}

function getColumnIndexByUrlName(name: string): number {
  const headers = document.querySelectorAll("th.sortable");
  return Array.from(headers).findIndex(
    (header) => getColumnNameForURL(header) === name
  );
}

/////////////////////////
// Handle About Modal
/////////////////////////
let y = 0;

help.addEventListener("click", () => {
  y = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  modal.showModal();
});

function closeDialog() {
  modal.close();
  document.body.style.position = "";
  document.body.style.top = "";
  window.scrollTo(0, y);
}

modalClose.addEventListener("click", closeDialog);
modal.addEventListener("cancel", closeDialog);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeDialog();
});

////////////////////
// Handle Sorting
////////////////////
let currentSort = { column: -1, direction: "asc" };

function getSortableCellIndex(sortableIndex: number): number {
  const sortableHeaders = document.querySelectorAll("th.sortable");
  const header = sortableHeaders[sortableIndex];
  const allHeaders = Array.from(header.parentElement!.children);
  return allHeaders.indexOf(header);
}

function sortTable(column: number, direction: "asc" | "desc") {
  const header = document.querySelectorAll("th.sortable")[column];
  const columnType = header.getAttribute("data-type");
  if (!columnType) return;

  // update state
  currentSort = { column, direction };
  updateQueryParams({
    sort: getColumnNameForURL(header),
    order: direction,
  });

  // sort rows
  const cellIndex = getSortableCellIndex(column);
  const tbody = document.querySelector("table tbody")!;
  const rows = Array.from(
    tbody.querySelectorAll("tr")
  ) as HTMLTableRowElement[];
  rows.sort((a, b) => {
    const aValue = getCellValue(a.cells[cellIndex], columnType);
    const bValue = getCellValue(b.cells[cellIndex], columnType);

    // Handle undefined values - always sort to bottom
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    let comparison = 0;
    if (columnType === "number" || columnType === "score") {
      comparison = (aValue as number) - (bValue as number);
    } else if (columnType === "boolean") {
      comparison = (aValue as string).localeCompare(bValue as string);
    } else {
      comparison = (aValue as string).localeCompare(bValue as string);
    }

    return direction === "asc" ? comparison : -comparison;
  });
  rows.forEach((row) => tbody.appendChild(row));

  // update sort indicators
  const headers = document.querySelectorAll("th.sortable");
  headers.forEach((header, i) => {
    const indicator = header.querySelector(".sort-indicator")!;

    if (i === column) {
      indicator.textContent = direction === "asc" ? "↑" : "↓";
    } else {
      indicator.textContent = "";
    }
  });
}

function getCellValue(
  cell: HTMLTableCellElement,
  type: string
): string | number | undefined {
  if (type === "score") {
    const bar = cell.querySelector('.bar-fill');
    return bar ? parseFloat(bar.getAttribute('data-score') || '0') : -1;
  }

  const text = cell.textContent?.trim() || "";
  if (text === "-") return undefined;
  if (type === "number") return parseFloat(text.replace(/[$,]/g, "")) || 0;
  return text;
}

document.querySelectorAll("th.sortable").forEach((header, index) => {
  header.addEventListener("click", () => {
    const direction =
      currentSort.column === index && currentSort.direction === "asc"
        ? "desc"
        : "asc";
    sortTable(index, direction);
  });
});

///////////////////
// Handle Search
///////////////////
function filterTable(value: string) {
  updateQueryParams({ search: value || null });

  if (inactiveToggle) {
    const hasSearch = value.trim() !== "";
    if (hasSearch && !inactiveToggle.checked) {
      inactiveToggle.checked = true;
      inactiveAutoEnabled = true;
    } else if (!hasSearch && inactiveAutoEnabled) {
      inactiveToggle.checked = false;
      inactiveAutoEnabled = false;
    }
  }

  updateRowVisibility();
}

search.addEventListener("input", () => {
  filterTable(search.value);
});

// Show platform-appropriate shortcut hint
const shortcutHint = document.getElementById('search-shortcut');
if (shortcutHint && !/Mac|iPhone|iPad/.test(navigator.platform || '')) {
  shortcutHint.textContent = 'Ctrl+K';
}

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    // Don't focus hidden search on narrow viewports
    if (search.offsetParent === null) return;
    e.preventDefault();
    search.focus();
  }
});

search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  }
});

/////////////////////////////////////
// Handle Theme Toggle
/////////////////////////////////////
const themeToggle = document.getElementById('theme-toggle');

function getEffectiveTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: string | null) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }
  // Swap favicon PNGs to match theme
  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/png"]').forEach(link => {
    link.href = link.href.replace(isDark ? '.png' : '-dark.png', isDark ? '-dark.png' : '.png');
  });
}

// Restore saved theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme) applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = getEffectiveTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

/////////////////////////////////////
// Handle Hamburger Menu
/////////////////////////////////////
const menuToggle = document.getElementById('menu-toggle');
const menuDropdown = document.getElementById('menu-dropdown');

if (menuToggle && menuDropdown) {
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target as Node) && e.target !== menuToggle) {
      menuDropdown.classList.remove('open');
    }
  });
}

/////////////////////////////////////
// Handle Inactive Toggle
/////////////////////////////////////
function setInactiveVisibility(show: boolean) {
  if (inactiveToggle) inactiveToggle.checked = show;
  updateQueryParams({ inactive: show ? '1' : null });
  updateRowVisibility();
}

if (inactiveToggle) {
  inactiveToggle.addEventListener('change', () => {
    inactiveAutoEnabled = false;
    setInactiveVisibility(inactiveToggle.checked);
  });
}

/////////////////////////////////////
// Handle Feature Toggle
/////////////////////////////////////
const featureToggle = document.getElementById('toggle-features') as HTMLInputElement | null;

function setFeatureVisibility(show: boolean) {
  document.querySelectorAll('.feature-col').forEach(el => {
    (el as HTMLElement).style.display = show ? 'table-cell' : 'none';
  });
  if (featureToggle) featureToggle.checked = show;
  updateQueryParams({ features: show ? '1' : null });
}

if (featureToggle) {
  featureToggle.addEventListener('change', () => {
    setFeatureVisibility(featureToggle.checked);
  });
}

///////////////////////////////////
// Initialize State from URL
///////////////////////////////////
function resetState() {
  // Clear search
  search.value = "";

  // Remove sort indicators
  currentSort = { column: -1, direction: "asc" };
  document.querySelectorAll("th.sortable .sort-indicator").forEach((ind) => {
    ind.textContent = "";
  });

  // Reset toggles to defaults
  if (inactiveToggle) inactiveToggle.checked = false;
  inactiveAutoEnabled = false;
  setFeatureVisibility(false);
}

function initializeFromURL() {
  resetState();
  const params = getQueryParams();

  // Restore search (set value without triggering updateRowVisibility yet)
  const searchQuery = params.get("search");
  if (searchQuery) {
    search.value = searchQuery;
    updateQueryParams({ search: searchQuery });
  }

  // Restore sort
  (() => {
    const columnName = params.get("sort");
    if (!columnName) return;

    const columnIndex = getColumnIndexByUrlName(columnName);
    if (columnIndex === -1) return;

    const direction = (params.get("order") as "asc" | "desc") || "asc";
    sortTable(columnIndex, direction);

    // Auto-expand features if sorted column is a hidden feature column
    const sortedHeader = document.querySelectorAll("th.sortable")[columnIndex];
    if (sortedHeader?.classList.contains("feature-col")) {
      setFeatureVisibility(true);
    }
  })();

  // Restore inactive visibility (set checkbox without triggering updateRowVisibility yet)
  if (params.get('inactive') === '1' && inactiveToggle) {
    inactiveToggle.checked = true;
    updateQueryParams({ inactive: '1' });
  } else if (searchQuery && !params.has('inactive') && inactiveToggle) {
    // Auto-enable inactive when search is present but inactive wasn't explicitly set
    inactiveToggle.checked = true;
    inactiveAutoEnabled = true;
  }

  // Restore feature visibility
  if (params.get('features') === '1') {
    setFeatureVisibility(true);
  }

  // Single pass to apply search + inactive state together
  updateRowVisibility();
}

// Astro module scripts run after DOM is ready, so call directly
initializeFromURL();
window.addEventListener("popstate", initializeFromURL);
