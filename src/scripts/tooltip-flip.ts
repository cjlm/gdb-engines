// microtip is CSS-only and can't detect viewport edges, so tooltips authored to
// open upward ("top*") get clipped by the title bar for the first rows — or by
// the sticky table header for any row scrolled just beneath it. On hover/focus
// we measure the room above vs. below the host and flip to the "bottom*" side
// when there's more room there.

function chromeBottom(): number {
  // The sticky <thead> sits below the fixed site header, so its bottom edge is
  // the lowest point covered by sticky chrome. Fall back to the header alone.
  const thead = document.querySelector('thead');
  if (thead) return thead.getBoundingClientRect().bottom;
  const header = document.querySelector('header');
  return header ? header.getBoundingClientRect().bottom : 0;
}

function bestPosition(el: HTMLElement, authored: string): string {
  const rect = el.getBoundingClientRect();
  const above = rect.top - chromeBottom();
  const below = window.innerHeight - rect.bottom;
  return below > above ? authored.replace(/^top/, 'bottom') : authored;
}

function wire(el: HTMLElement): void {
  const authored = el.dataset.microtipPosition;
  if (!authored || !authored.startsWith('top')) return;
  const update = (): void => {
    el.dataset.microtipPosition = bestPosition(el, authored);
  };
  el.addEventListener('pointerenter', update);
  el.addEventListener('focusin', update);
}

document
  .querySelectorAll<HTMLElement>('[role~="tooltip"][data-microtip-position^="top"]')
  .forEach(wire);
