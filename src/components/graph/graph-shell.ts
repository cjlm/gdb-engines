import { graphViewIdForPath } from '../../lib/graph-views.mjs';
import { isPlainPrimaryClick } from '../../lib/plain-click.mjs';
import {
  graphViewController,
  onViewStateChange,
  viewState,
  type GraphSelection,
} from './view-registry';

interface ShellParts {
  page: HTMLElement;
  stage: HTMLElement;
  status: HTMLElement;
  selection: HTMLElement;
  description: HTMLElement;
  buttons: HTMLAnchorElement[];
  viewport: HTMLElement;
  views: Map<string, HTMLElement>;
  controls: HTMLElement[];
}

const compactLayout = window.matchMedia('(max-width: 48rem)');

function findParts(): ShellParts {
  const page = document.querySelector<HTMLElement>('.graph-page');
  const stage = document.querySelector<HTMLElement>('.graph-stage');
  const status = document.querySelector<HTMLElement>('#graph-status');
  const selection = document.querySelector<HTMLElement>('#graph-selection');
  const description = document.querySelector<HTMLElement>('#model-description');
  const viewport = stage?.querySelector<HTMLElement>('.visualization-views');
  if (!page || !stage || !status || !selection || !description || !viewport) {
    throw new Error('Graph page: the stage, views, status, selection or description is missing.');
  }
  const views = new Map(
    [...stage.querySelectorAll<HTMLElement>('[data-graph-view]')].map((view) => [
      view.dataset.graphView ?? '',
      view,
    ]),
  );
  return {
    page,
    stage,
    status,
    selection,
    description,
    buttons: [...document.querySelectorAll<HTMLAnchorElement>('.model-button')],
    viewport,
    views,
    controls: [...stage.querySelectorAll<HTMLElement>('[data-graph-control]')],
  };
}

function renderSelection(element: HTMLElement, selection: GraphSelection | null) {
  if (!selection) {
    element.replaceChildren();
    element.hidden = true;
    return;
  }
  const content = document.createDocumentFragment();
  if (selection.imageUrl) {
    const image = document.createElement('img');
    image.src = selection.imageUrl;
    image.alt = '';
    image.width = 18;
    image.height = 18;
    content.append(image);
  }
  const name = document.createElement(selection.href ? 'a' : 'span');
  if (name instanceof HTMLAnchorElement) name.href = selection.href;
  name.textContent = selection.label;
  content.append(name);
  if (selection.detail) {
    const metadata = document.createElement('span');
    metadata.className = 'selection-detail';
    metadata.textContent = `· ${selection.detail}`;
    content.append(metadata);
  }
  element.replaceChildren(content);
  element.hidden = false;
}

function setMeta(selector: string, attribute: string, value: string | undefined) {
  if (value) document.querySelector(selector)?.setAttribute(attribute, value);
}

function updatePageMetadata(button: HTMLAnchorElement) {
  const { pageTitle, pageDescription, canonical } = button.dataset;
  if (pageTitle) document.title = pageTitle;
  setMeta('meta[property="og:title"]', 'content', pageTitle);
  setMeta('meta[name="twitter:title"]', 'content', pageTitle);
  setMeta('meta[name="description"]', 'content', pageDescription);
  setMeta('meta[property="og:description"]', 'content', pageDescription);
  setMeta('meta[name="twitter:description"]', 'content', pageDescription);
  setMeta('link[rel="canonical"]', 'href', canonical);
  setMeta('meta[property="og:url"]', 'content', canonical);
}

function markActiveButton(buttons: HTMLAnchorElement[], viewId: string) {
  for (const button of buttons) {
    const active = button.dataset.view === viewId;
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  }
}

/** On phones, bring the stage back under the header when the reader has scrolled past it. */
function keepStageInView(stage: HTMLElement) {
  if (!compactLayout.matches) return;
  const headerHeight =
    document.querySelector('.site-header')?.getBoundingClientRect().height ?? 56;
  const stageTop = stage.getBoundingClientRect().top;
  if (stageTop < headerHeight) {
    window.scrollTo({ top: window.scrollY + stageTop - headerHeight });
  }
}

function sameBox(left: DOMRect, right: DOMRect): boolean {
  return (
    left.top === right.top && left.height === right.height && left.width === right.width
  );
}

/**
 * Cancel the crossfade when the switch moved or resized the views area: the outgoing view would
 * be seen jumping to the new position while it faded, so swap in a single frame instead.
 */
function swapAtOnceIfMoved(viewport: HTMLElement, before: DOMRect) {
  if (sameBox(before, viewport.getBoundingClientRect())) return;
  viewport.classList.add('instant');
  requestAnimationFrame(() => requestAnimationFrame(() => viewport.classList.remove('instant')));
}

function showView(parts: ShellParts, viewId: string) {
  for (const [id, view] of parts.views) {
    const active = id === viewId;
    view.classList.toggle('active', active);
    if (active) view.classList.add('ready');
    view.setAttribute('aria-hidden', String(!active));
    if (view instanceof HTMLIFrameElement) {
      view.inert = !active;
      if (active) view.removeAttribute('tabindex');
      else view.tabIndex = -1;
    }
    parts.stage.classList.toggle(`${id}-active`, active);
  }
  for (const control of parts.controls) control.hidden = control.dataset.graphControl !== viewId;
  const isFrame = parts.views.get(viewId) instanceof HTMLIFrameElement;
  parts.stage.dataset.viewKind = isFrame ? 'garphield' : 'page';
  parts.stage.classList.add('ready');
  parts.stage.removeAttribute('aria-busy');
}

/**
 * Wire the model switcher, browser history and the stage that shows one view at a time.
 *
 * Views stay mounted. A switch waits for the incoming view to be ready, then reveals it over the
 * outgoing one in a single frame, so the stage never shows an empty or half-restored view.
 */
export function startGraphShell() {
  const parts = findParts();
  let requestedId = '';
  let shownId = '';
  let pending = false;
  let version = 0;

  function renderRequestedState() {
    const state = viewState(requestedId);
    parts.status.textContent = state.status ?? 'Loading…';
    renderSelection(parts.selection, state.selection);
  }

  function updateDescription() {
    const button = parts.buttons.find((candidate) => candidate.dataset.view === requestedId);
    if (!button) return;
    const { description, mobileDescription } = button.dataset;
    parts.description.textContent = (compactLayout.matches ? mobileDescription : description) ?? '';
  }

  function reveal(viewId: string) {
    const before = parts.viewport.getBoundingClientRect();
    for (const id of parts.views.keys()) {
      if (id !== viewId) graphViewController(id)?.deactivate?.();
    }
    showView(parts, viewId);
    shownId = viewId;
    graphViewController(viewId)?.shown?.();
    swapAtOnceIfMoved(parts.viewport, before);
  }

  async function switchTo(viewId: string) {
    if (viewId === requestedId && (viewId === shownId || pending)) return;
    const button = parts.buttons.find((candidate) => candidate.dataset.view === viewId);
    if (!button || !parts.views.has(viewId)) {
      throw new Error(`Graph page: no switcher button or view element for "${viewId}".`);
    }
    const switchVersion = ++version;
    requestedId = viewId;
    pending = true;
    parts.stage.setAttribute('aria-busy', 'true');
    keepStageInView(parts.stage);
    markActiveButton(parts.buttons, viewId);
    updateDescription();
    updatePageMetadata(button);
    renderRequestedState();

    let activated = true;
    try {
      await graphViewController(viewId)?.activate();
    } catch {
      // The view reports the failure in its status line; keep showing the previous view.
      activated = false;
    }
    if (switchVersion !== version) return;
    pending = false;
    if (activated) reveal(viewId);
    else parts.stage.removeAttribute('aria-busy');
  }

  const stopWatchingState = onViewStateChange((viewId) => {
    if (viewId === requestedId) renderRequestedState();
  });

  for (const button of parts.buttons) {
    button.addEventListener('click', (event) => {
      if (!isPlainPrimaryClick(event)) return;
      event.preventDefault();
      const nextPath = new URL(button.href).pathname;
      if (nextPath !== window.location.pathname) {
        window.history.pushState({}, '', nextPath);
      }
      void switchTo(button.dataset.view ?? '');
    });
  }
  const handlePopState = () => void switchTo(graphViewIdForPath(window.location.pathname));
  window.addEventListener('popstate', handlePopState);
  compactLayout.addEventListener('change', updateDescription);
  window.addEventListener(
    'pagehide',
    () => {
      stopWatchingState();
      window.removeEventListener('popstate', handlePopState);
      compactLayout.removeEventListener('change', updateDescription);
    },
    { once: true },
  );

  void switchTo(parts.page.dataset.initialView ?? parts.buttons[0]?.dataset.view ?? '');
}
