type SelineProperty = string | number | boolean;

interface SelineClient {
  track: (name: string, properties: Record<string, SelineProperty>) => void;
}

declare global {
  interface Window {
    seline?: SelineClient;
  }
}

interface PendingEvent {
  name: string;
  properties: Record<string, SelineProperty>;
}

const script = document.querySelector<HTMLScriptElement>('#seline-script');
const pending: PendingEvent[] = [];
let waitingForScript = false;

function flush(): boolean {
  if (!window.seline) return false;
  for (const event of pending) window.seline.track(event.name, event.properties);
  pending.length = 0;
  return true;
}

/**
 * Seline loads asynchronously. Queue events in order until its script is ready, rather
 * than silently losing them on a cold cache or slow connection. Without a token the
 * script tag is never rendered, so nothing is queued.
 */
export function track(name: string, properties: Record<string, SelineProperty>): void {
  if (!script) return;

  pending.push({ name, properties });
  if (flush() || waitingForScript) return;

  waitingForScript = true;
  script.addEventListener('load', () => {
    waitingForScript = false;
    flush();
  }, { once: true });
}

export type ComparisonSurface = 'pair' | 'roundup' | 'custom';

/** Track the database set shown together, using catalogue slugs as stable identifiers. */
export function trackDatabaseComparison(slugs: string[], surface: ComparisonSurface): void {
  const databases = [...new Set(slugs)].sort();
  if (databases.length < 2) return;

  const properties: Record<string, SelineProperty> = {
    databases: databases.join(','),
    count: databases.length,
    surface,
  };
  databases.forEach((slug, index) => {
    properties[`database_${index + 1}`] = slug;
  });

  track('comparison: viewed', properties);
}
