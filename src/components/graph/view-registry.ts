/**
 * Client-side registry shared by the graph page's views and its switcher (graph-shell.ts).
 *
 * Each view component registers a controller for the element it renders with
 * `data-graph-view="<id>"`, and reports its status line and selection here. The registry keeps
 * that state per view, so a view the reader returns to shows what it showed when they left.
 */

export interface GraphSelection {
  label: string;
  imageUrl: string;
  href: string;
  detail?: string;
}

export interface GraphViewController {
  /** Get ready to be shown. Resolve once the view can appear in its last state. */
  activate(): Promise<void> | void;
  /** Runs in the same frame the view becomes visible, after the stage has switched to it. */
  shown?(): void;
  /** Runs just before another view replaces this one, while this one is still laid out. */
  deactivate?(): void;
}

interface ViewState {
  status: string | null;
  selection: GraphSelection | null;
}

const controllers = new Map<string, GraphViewController>();
const states = new Map<string, ViewState>();
const listeners = new Set<(viewId: string) => void>();

function stateFor(viewId: string): ViewState {
  let state = states.get(viewId);
  if (!state) {
    state = { status: null, selection: null };
    states.set(viewId, state);
  }
  return state;
}

function notify(viewId: string) {
  for (const listener of listeners) listener(viewId);
}

export function registerGraphView(viewId: string, controller: GraphViewController) {
  if (controllers.has(viewId)) {
    throw new Error(`Graph view "${viewId}" registered twice; each view needs a unique id.`);
  }
  controllers.set(viewId, controller);
}

export function graphViewController(viewId: string): GraphViewController | undefined {
  return controllers.get(viewId);
}

export function setViewStatus(viewId: string, status: string) {
  stateFor(viewId).status = status;
  notify(viewId);
}

export function setViewSelection(viewId: string, selection: GraphSelection | null) {
  stateFor(viewId).selection = selection;
  notify(viewId);
}

export function viewState(viewId: string): Readonly<ViewState> {
  return stateFor(viewId);
}

/** Subscribe to status and selection changes. Returns an unsubscribe function. */
export function onViewStateChange(listener: (viewId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
