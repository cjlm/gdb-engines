/**
 * Loads a blog post's Garphield network when it comes near the screen, in the site's theme and
 * accent, and follows theme changes. The document comes from the chart spec (see GarphieldSpec).
 */
import { createGarphield } from 'garphield';
import { effectiveTheme, watchTheme } from '../components/graph/theme-sync';
import { prepareGarphieldDocument, setEmbedAccent } from './garphield-document.mjs';

async function load(node: HTMLElement, frame: HTMLIFrameElement, source: unknown): Promise<void> {
  const embedUrl = new URL('/embed', node.dataset.garphieldOrigin ?? 'https://garphield.com');
  setEmbedAccent(embedUrl);
  // The toolbar, the colour legend and node popovers; the overview panel and search crowd a
  // post-width frame.
  embedUrl.searchParams.set('chrome', 'toolbar,legend,tooltip');
  const driver = createGarphield(frame, { embedUrl, timeoutMs: 30_000 });
  await driver.ready();
  await driver.setTheme({ colorScheme: effectiveTheme() });
  await driver.setDocument(prepareGarphieldDocument(source, effectiveTheme()));
  watchTheme(() => {
    void driver.setTheme({ colorScheme: effectiveTheme() });
  });
}

/** Start the embed in `node` (a .blog-garphield element) once it is within a screen of view. */
export function mountBlogGarphield(node: HTMLElement): void {
  const frame = node.querySelector('iframe');
  const source = node.querySelector('script[type="application/json"]')?.textContent;
  if (!frame || !source) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      load(node, frame, JSON.parse(source)).catch((error: unknown) => {
        console.error('[blog] the Garphield network did not load', error);
        node.dataset.failed = 'true';
      });
    },
    { rootMargin: '100% 0px' },
  );
  observer.observe(node);
}
