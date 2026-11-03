import { createGarphield, type Garphield } from 'garphield';
import { prepareGarphieldDocument, setEmbedAccent } from '../../lib/garphield-document.mjs';
import { effectiveTheme, watchTheme } from './theme-sync';
import { registerGraphView, setViewSelection, setViewStatus } from './view-registry';

interface GraphNode {
  id: string | number;
  label?: unknown;
  image?: unknown;
}

export interface Graph {
  nodes: GraphNode[];
  links: Array<Record<string, unknown>>;
}

interface GarphieldDocumentData {
  datasets: Array<{ graph: Graph }>;
}

export interface GarphieldView {
  readonly driver: Garphield;
  /** The loaded graph, or null before the document has loaded. */
  graph(): Graph | null;
  isActive(): boolean;
  setStatus(status: string): void;
}

export interface GarphieldViewOptions {
  /** Status line for the loaded graph. */
  status(graph: Graph): string;
  /**
   * Bring the embed in line with host controls before the view is shown. Runs after the status
   * is set and reports its own failures through `view.setStatus`.
   */
  sync?(view: GarphieldView): Promise<void>;
}

const imageLoads = new Map<string, Promise<void>>();

function preloadImage(url: string): Promise<void> {
  const existing = imageLoads.get(url);
  if (existing) return existing;

  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, 8_000);
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.addEventListener('error', finish, { once: true });
    image.addEventListener(
      'load',
      () => {
        // An image that cannot be decoded early still loads in the embed; stop waiting either way.
        image.decode().then(finish, finish);
      },
      { once: true },
    );
    image.src = url;
  });
  imageLoads.set(url, pending);
  return pending;
}

async function preloadNodeImages(graph: Graph) {
  const urls = new Set(
    graph.nodes.map((node) => node.image).filter((image) => typeof image === 'string'),
  );
  await Promise.all([...urls].map((url) => preloadImage(url)));
}

async function fetchDocument(url: string): Promise<GarphieldDocumentData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const document = (await response.json()) as GarphieldDocumentData;
  // Generated documents keep production-absolute asset URLs so they remain portable. In dev,
  // point those same assets at this local GDB server; Garphield still receives a valid
  // absolute URL.
  if (import.meta.env.DEV) {
    for (const node of document.datasets[0].graph.nodes) {
      if (typeof node.image !== 'string') continue;
      const image = new URL(node.image);
      if (image.origin === 'https://gdb-engines.com') {
        node.image = new URL(image.pathname, window.location.origin).href;
      }
    }
  }
  return document;
}

async function waitForGraphPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // The embed replies after accepting a document. Give its canvas one extra beat to paint
  // before the host starts revealing it.
  await new Promise((resolve) => window.setTimeout(resolve, 100));
}

function connectFrame(frame: HTMLIFrameElement): Garphield {
  const page = frame.closest<HTMLElement>('.graph-page');
  const origin = page?.dataset.garphieldOrigin ?? 'https://garphield.com';
  const embedUrl = new URL('/embed', origin);
  setEmbedAccent(embedUrl);
  if (frame.dataset.chrome) embedUrl.searchParams.set('chrome', frame.dataset.chrome);
  if (frame.dataset.edgeWidthScale) {
    embedUrl.searchParams.set('edgeWidthScale', frame.dataset.edgeWidthScale);
  }
  return createGarphield(frame, { embedUrl, timeoutMs: 30_000 });
}

/**
 * Hold a hidden frame at the size it last had on screen. The stage grows for the timeline and
 * lineage views; without this the embed would resize with it and re-fit its camera, so the
 * reader would see it re-lay out on their way back.
 */
function pinFrameSize(frame: HTMLIFrameElement) {
  // The unrounded height: even a fraction of a pixel makes the embed redraw.
  frame.style.height = `${frame.getBoundingClientRect().height}px`;
}

function databaseHref(nodeId: string): string {
  if (!nodeId.startsWith('db:')) return '';
  return `/db/${encodeURIComponent(nodeId.slice(3))}/`;
}

/**
 * Show a clicked node in the status row. Clicking the selected database again opens its page:
 * the embed reports a double-click as a single click, so this is the gesture it can pass on, as
 * on the timeline.
 */
function nodeSelector(viewId: string) {
  let selectedNodeId = '';
  return (nodeId: string, node: GraphNode | undefined) => {
    if (!node) {
      selectedNodeId = '';
      setViewSelection(viewId, null);
      return;
    }
    const href = databaseHref(String(node.id));
    if (href && nodeId === selectedNodeId) {
      window.location.href = href;
      return;
    }
    const imageUrl = typeof node.image === 'string' ? node.image : '';
    setViewSelection(viewId, { label: String(node.label ?? node.id), imageUrl, href });
    selectedNodeId = nodeId;
  };
}

/**
 * Connect a Garphield iframe and register it as a graph view.
 *
 * The frame loads its document the first time it is activated and keeps it, along with the
 * reader's selection, filter and camera, for the rest of the visit.
 */
export function mountGarphieldView(
  frame: HTMLIFrameElement,
  options: GarphieldViewOptions,
): GarphieldView {
  const viewId = frame.dataset.graphView ?? '';
  const documentUrl = frame.dataset.document ?? '';
  const driver = connectFrame(frame);
  const ready = driver.ready();
  let nodes = new Map<string, GraphNode>();
  let graph: Graph | null = null;
  let loading: Promise<void> | null = null;
  let active = false;
  const select = nodeSelector(viewId);

  const view: GarphieldView = {
    driver,
    graph: () => graph,
    isActive: () => active,
    setStatus: (status) => setViewStatus(viewId, status),
  };

  async function syncTheme() {
    await ready;
    await driver.setTheme({ colorScheme: effectiveTheme() });
  }

  async function loadDocument() {
    const source = await fetchDocument(documentUrl);
    await preloadNodeImages(source.datasets[0].graph);
    const prepared = prepareGarphieldDocument(source, effectiveTheme()) as GarphieldDocumentData;
    await syncTheme();
    await driver.setDocument(prepared);
    graph = prepared.datasets[0].graph;
    nodes = new Map(graph.nodes.map((node) => [String(node.id), node]));
    await waitForGraphPaint();
    frame.classList.add('ready');
  }

  function load(): Promise<void> {
    loading ??= loadDocument().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  }

  driver.on('nodeClick', ({ nodeId }) => {
    if (active) select(nodeId, nodeId ? nodes.get(nodeId) : undefined);
  });
  driver.on('error', (payload) => {
    if (active) view.setStatus(`Visualization error: ${payload.message}`);
  });
  const stopWatchingTheme = watchTheme(() => {
    void syncTheme().catch((error: unknown) => {
      view.setStatus(`Could not match visualization theme: ${String(error)}`);
    });
  });

  pinFrameSize(frame);
  registerGraphView(viewId, {
    async activate() {
      active = true;
      try {
        await load();
      } catch (error) {
        view.setStatus(`Could not load visualization: ${String(error)}`);
        throw error;
      }
      if (graph) view.setStatus(options.status(graph));
      await options.sync?.(view);
    },
    shown() {
      frame.style.removeProperty('height');
    },
    deactivate() {
      active = false;
      pinFrameSize(frame);
    },
  });

  window.addEventListener(
    'pagehide',
    () => {
      stopWatchingTheme();
      driver.destroy();
    },
    { once: true },
  );
  return view;
}
