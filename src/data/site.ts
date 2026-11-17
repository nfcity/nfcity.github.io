// Business details and the product list. Edit prices and contacts here.

export const site = {
  name: 'NFCity',
  // Set in astro.config.mjs.
  url: import.meta.env.SITE,
  telegram: 'https://t.me/nfcity_uz',
  telegramHandle: '@nfcity_uz',
  phone: '+998971282900',
  phoneDisplay: '+998 97 128 29 00',
  instagram: 'https://instagram.com/nfcity.uz',
  instagramHandle: '@nfcity.uz',
} as const;

export type ProductId = 'review' | 'business' | 'social' | 'menu';

// price: a number in soʻm (for example 120000), or null to show "ask for price".
// available: false shows the "available soon" badge instead of the price and order button.
//            Switch it to true on the day you start selling that card.
export const products: {
  id: ProductId;
  price: number | null;
  available: boolean;
  featured?: boolean;
}[] = [
  { id: 'review', price: 350_000, available: true, featured: true },
  { id: 'business', price: null, available: false },
  { id: 'social', price: null, available: false },
  { id: 'menu', price: null, available: false },
];

/** Telegram link that opens the chat with a ready-made message. */
export function telegramLink(message?: string) {
  return message ? `${site.telegram}?text=${encodeURIComponent(message)}` : site.telegram;
}
