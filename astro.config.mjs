import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const subsets = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'];

// The address the site is published at. Canonical links, hreflang, the sitemap,
// share previews and structured data are all built from it.
// Change it to 'https://nfcity.uz' once that domain points at the site.
const SITE = 'https://nfcity.github.io';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // One page, small stylesheet: inline it so nothing blocks the first paint.
  build: { inlineStylesheets: 'always' },
  i18n: {
    defaultLocale: 'uz',
    locales: ['uz', 'ru', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'uz', locales: { uz: 'uz', ru: 'ru', en: 'en' } },
    }),
  ],
  // Fonts are downloaded at build time and served from this site (no third-party requests).
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Unbounded',
      cssVariable: '--font-unbounded',
      weights: ['200 900'],
      styles: ['normal'],
      subsets,
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Onest',
      cssVariable: '--font-onest',
      weights: ['100 900'],
      styles: ['normal'],
      subsets,
      fallbacks: ['sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // Three.js is one large chunk by nature; it is lazy-loaded on desktop only.
    build: { chunkSizeWarningLimit: 700 },
  },
});
