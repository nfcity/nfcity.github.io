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
| Which cards can be ordered ("available soon" badge) | `src/data/site.ts` (`available`) |
| Scroll reveals, FAQ glide, loaders for the 3D scenes | `src/scripts/motion.ts` |
| Hero story timing (tap, waves, review page, stars) | `src/scripts/hero-story.ts` |
| Hero phone and card in 3D (Three.js, desktop only) | `src/scripts/hero3d.ts` |
| Hero phone and card in CSS 3D (phones, fallback) | `src/components/HeroScene.astro` |
| The four 3D product cards (Three.js, desktop only) | `src/scripts/cards3d.ts` |
| The product cards' front and back artwork | `scripts/make-card-textures.mjs` |
| Sections | `src/components/` |

To show a price, set `price` for that product in `src/data/site.ts` (a number in soʻm).
Leave it as `null` to show "ask for price".

## Motion and 3D

- Everything animates transform and opacity only, on one easing curve (`--ease-soft`).
  Visitors with "reduce motion" switched on get a still 3D pose and no animation.
- **Hero.** On phones the phone and card are CSS 3D (stacked layers give the thickness).
  On desktops with a mouse a Three.js scene takes over once the page is idle: bevelled
  slabs, physical materials, a studio environment generated in code, a rim light and a
  soft contact shadow. The phone's screen is the page's own HTML in both versions, so
  the text stays sharp and translated.
- **Product cards.** On desktop all four tiles show a real 3D card. They share a single
  WebGL renderer and load only when the tiles are about to scroll into view. Phones keep
  the drawn cards, which float gently.
- The card faces are built by `node scripts/make-card-textures.mjs` from the skyline
  artwork in `src/assets/card/source/` (generated with Higgsfield), recoloured to the
  brand palette, with the real logo laid on top.
- To start selling a card that is marked "available soon", set `available: true` for it
  in `src/data/site.ts`. Its price and order button come back by themselves.

## Placeholder images to replace

- `src/components/ProductArt.astro`: the four drawn card mockups stand in for product photos.
- `src/assets/brand/logo.png`: cut out of the splash image by `scripts/extract-logo.mjs`.
  Replace it with the original transparent logo file if you have one.
- `public/og.png`: share image, made by `scripts/make-assets.mjs` from the same splash image.

## Deploy

- **Vercel**: import the folder or repository; the Astro preset is detected automatically.
- **Cloudflare Pages**: build command `npm run build`, output directory `dist`.

The site address is set in `astro.config.mjs` (`site`) and `src/data/site.ts` (`url`).
