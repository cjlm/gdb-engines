/**
 * Generates a 1200x630 Open Graph image for each ranking page. Each image shows the
 * board's title and a short blurb so links shared on X / LinkedIn / Slack render nicely.
 *
 * Endpoint: /og/rankings/{slug}.png — referenced from the ranking page's <Layout ogImage>.
 */
import { OGImageRoute } from 'astro-og-canvas';
import { loadRankings } from '../../../lib/rankings';
import { buildBoards } from '../../../lib/ranking-boards';

const ranking = await loadRankings();
const boards = ranking ? buildBoards(ranking) : [];

const pages = Object.fromEntries(
  boards.map((b) => {
    const top = b.engines.slice(0, 3).map((e, i) => `${i + 1}. ${e.name}`).join('   ');
    return [b.slug, { title: b.h1, description: top || `${b.engines.length} engines ranked` }];
  }),
);

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgGradient: [
      [13, 27, 42],
      [27, 50, 71],
    ],
    border: { color: [29, 110, 191], width: 6, side: 'inline-start' },
    padding: 80,
    font: {
      title: { color: [255, 255, 255], size: 70, weight: 'Bold', lineHeight: 1.15 },
      description: { color: [173, 181, 189], size: 32, lineHeight: 1.4 },
    },
  }),
});
