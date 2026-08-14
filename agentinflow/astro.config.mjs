// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.agentinflow.com',

  // Emit directory-style URLs so /service/ and /aboutus/ keep resolving
  // exactly as they did on the old hand-written site. Do not change this
  // without adding redirects - those URLs are indexed by Google.
  build: {
      format: 'directory'
  },

  // Emits /sitemap-index.xml plus /sitemap-0.xml, generated from the built
  // routes so it cannot drift the way the hand-written public/sitemap.xml
  // did. robots.txt points at the index.
  integrations: [
      sitemap({
          changefreq: 'monthly',
          lastmod: new Date(),
          serialize(item) {
              // The home page is the one worth crawling first.
              item.priority = item.url === 'https://www.agentinflow.com/' ? 1.0 : 0.8;
              return item;
          }
      })
  ]
});