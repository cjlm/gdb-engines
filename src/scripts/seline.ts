type SelineProperty = string | number | boolean;

interface SelineClient {
  track: (name: string, properties: Record<string, SelineProperty>) => void;
}

declare global {
  interface Window {
    seline?: SelineClient;
  }
}

const pending = new Map<string, Record<string, SelineProperty>>();
let waitingForScript = false;

function flush(): boolean {
  if (!window.seline) return false;
  for (const [name, properties] of pending) window.seline.track(name, properties);
  pending.clear();
  return true;
}

/**
 * Seline loads asynchronously. Keep the latest event of each name until its script is
 * ready, rather than silently losing events on a cold cache or slow connection.
 */
function track(name: string, properties: Record<string, SelineProperty>): void {
  pending.set(name, properties);
  if (flush() || waitingForScript) return;

  const script = document.querySelector<HTMLScriptElement>('#seline-script');
  if (!script) return;

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
