/**
 * Generates a 1200x630 Open Graph image for each ranking page. Each image shows the
 * board's title and its top three engines so links shared on X / LinkedIn / Slack render
 * with GDB-Engines branding (cream background, brand-maroon accent, graph icon, Familjen
 * Grotesk title, Rubik body).
 *
 * Endpoint: /og/rankings/{slug}.png — referenced from the ranking page's <Layout ogImage>.
 */
import { OGImageRoute } from 'astro-og-canvas';
import { loadRankings } from '../../../lib/rankings';
import { buildBoards } from '../../../lib/ranking-boards';

const ranking = await loadRankings();
const boards = ranking ? buildBoards(ranking) : [];

const pages = Object.fromEntries(
  boards.map((b) => [b.slug, { title: b.h1 }]),
);

// Brand palette sampled from public/og.png and global.css.
const CREAM: [number, number, number] = [239, 235, 228]; // #EFEBE4 — bg
const MAROON: [number, number, number] = [90, 32, 40];   // #5A2028 — brand

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    bgGradient: [CREAM],
    border: { color: MAROON, width: 8, side: 'inline-start' },
    padding: 90,
    // Pre-baked "graph-icon + GDB-Engines" wordmark, rendered above the title.
    logo: { path: './src/og-assets/wordmark.png', size: [449, 78] },
    fonts: ['./src/og-assets/familjen-grotesk.ttf'],
    font: {
      title: {
        color: MAROON,
        size: 80,
        weight: 'Bold',
        lineHeight: 1.1,
        families: ['Familjen Grotesk'],
      },
    },
  }),
});
