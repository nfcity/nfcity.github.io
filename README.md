# NFCity website

Marketing site for NFCity (nfcity.uz). Built with Astro, Tailwind CSS, GSAP and Lenis.
The output is plain static files, ready for Vercel or Cloudflare Pages.

## Run it

```bash
npm install
npm run dev      # local preview at http://localhost:4321
npm run build    # writes the finished site to dist/
npm run preview  # serves dist/ locally
```

## Where to change things

| What | File |
| --- | --- |
| Text in Uzbek, Russian, English | `src/i18n/uz.json`, `src/i18n/ru.json`, `src/i18n/en.json` |
| Prices, product list, Telegram, phone, Instagram | `src/data/site.ts` |
| Colours and fonts | `src/styles/global.css`, `astro.config.mjs` |
| Hero animation timing, scroll motion | `src/scripts/motion.ts` |
| Sections | `src/components/` |

To show a price, set `price` for that product in `src/data/site.ts` (a number in soʻm).
Leave it as `null` to show "ask for price".

## Placeholder images to replace

- `src/components/ProductArt.astro`: the four drawn card mockups stand in for product photos.
- `src/assets/brand/logo.png`: cut out of the splash image by `scripts/extract-logo.mjs`.
  Replace it with the original transparent logo file if you have one.
- `public/og.png`: share image, made by `scripts/make-assets.mjs` from the same splash image.

## Deploy

- **Vercel**: import the folder or repository; the Astro preset is detected automatically.
- **Cloudflare Pages**: build command `npm run build`, output directory `dist`.

The site address is set in `astro.config.mjs` (`site`) and `src/data/site.ts` (`url`).
