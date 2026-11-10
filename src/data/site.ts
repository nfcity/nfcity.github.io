// Business details and the product list. Edit prices and contacts here.

export const site = {
  name: 'NFCity',
  url: 'https://nfcity.uz',
  telegram: 'https://t.me/nfcity_uz',
  telegramHandle: '@nfcity_uz',
  phone: '+998971282900',
  phoneDisplay: '+998 97 128 29 00',
  instagram: 'https://instagram.com/nfcity.uz',
  instagramHandle: '@nfcity.uz',
} as const;

export type ProductId = 'review' | 'business' | 'social' | 'menu';

// price: a number in soʻm (for example 120000), or null to show "ask for price".
export const products: { id: ProductId; price: number | null; featured?: boolean }[] = [
  { id: 'review', price: null, featured: true },
  { id: 'business', price: null },
  { id: 'social', price: null },
  { id: 'menu', price: null },
];

/** Telegram link that opens the chat with a ready-made message. */
export function telegramLink(message?: string) {
  return message ? `${site.telegram}?text=${encodeURIComponent(message)}` : site.telegram;
}
