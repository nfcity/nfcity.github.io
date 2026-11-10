import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const subsets = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'];

export default defineConfig({
  site: 'https://nfcity.uz',
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
  vite: { plugins: [tailwindcss()] },
});
