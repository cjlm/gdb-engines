/**
 * Generates a 1200x630 Open Graph image for each blog post, matching the ranking-page
 * OG images (cream background, brand-maroon accent, GDB-Engines wordmark, Familjen
 * Grotesk title) so shared blog links render with consistent branding on X / LinkedIn / Slack.
 *
 * Endpoint: /og/blog/{slug}.png — referenced from the blog post's <Layout ogImage>.
 */
import { OGImageRoute } from 'astro-og-canvas';
import { blogPosts } from '../../../lib/blog';

const posts = await blogPosts();

const pages = Object.fromEntries(
  posts.map((post) => [post.id, { title: post.data.title }]),
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
