import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Stamp the build date as lastmod for every URL. Honest signal for a static
// catalog where TOML edits and monthly ranking refreshes both trigger a rebuild.
const buildDate = new Date().toISOString().split('T')[0];

export default defineConfig({
  output: 'static',
  site: 'https://gdb-engines.com',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = buildDate;
        if (item.url.includes('/rankings/')) {
          item.changefreq = 'monthly';
          item.priority = 0.8;
        } else if (item.url.includes('/db/')) {
          item.changefreq = 'yearly';
          item.priority = 0.6;
        }
        return item;
      },
    }),
  ],
});
