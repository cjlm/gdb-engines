import { track } from './seline';

/**
 * Seline's exit-page report names the page a session ended on, but not where the visitor
 * went. On a catalogue whose outbound links all open in a new tab, that leaves a
 * satisfied click through to a vendor indistinguishable from a dead end.
 */
type OutboundKind = 'engine-site' | 'engine-github' | 'gdotv' | 'sponsor' | 'citation' | 'other';

const KINDS = new Set<string>(['engine-site', 'engine-github', 'gdotv', 'sponsor', 'citation']);
const TRACKED_PROTOCOLS = new Set(['http:', 'https:']);

/** An unrecognised attribute value falls back rather than inventing a dashboard category. */
function kindOf(link: HTMLAnchorElement): OutboundKind {
  const kind = link.dataset.outbound;
  return kind && KINDS.has(kind) ? (kind as OutboundKind) : 'other';
}

function report(event: MouseEvent): void {
  // A right-click opens a context menu; it is not a departure.
  if (event.button > 1) return;
  if (!(event.target instanceof Element)) return;

  const link = event.target.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.hostname === location.hostname) return;
  if (!TRACKED_PROTOCOLS.has(link.protocol)) return;

  const properties: Record<string, string> = {
    destination: link.hostname.toLowerCase().replace(/^www\./, ''),
    kind: kindOf(link),
  };
  const database = link.dataset.db;
  if (database) properties.database = database;

  track('outbound: clicked', properties);
}

// Middle-click opens a link in a new tab but fires auxclick, not click.
document.addEventListener('click', report);
document.addEventListener('auxclick', report);
