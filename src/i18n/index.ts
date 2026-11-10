import uz from './uz.json';
import ru from './ru.json';
import en from './en.json';

export const locales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'uz';

export type Dictionary = typeof uz;

const dictionaries: Record<Locale, Dictionary> = { uz, ru, en };

export const localeNames: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
};

export const ogLocales: Record<Locale, string> = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' };

const NBSP = '\u00A0';
const RU_SHORT_WORDS = /(^|[\s(«])(в|к|с|и|а|у|о|на|по|от|до|за|из|не|ни|для|что|как|или)\s/giu;

/** Typographic touches applied to visible copy, so the JSON files can stay plain. */
function polish<T>(value: T, locale: Locale): T {
  if (typeof value === 'string') {
    // Keep a dash with the word before it, never at the start of a line.
    let text = value.replace(/ — /g, `${NBSP}— `);
    // Russian: short prepositions and conjunctions stay with the next word.
    if (locale === 'ru') text = text.replace(RU_SHORT_WORDS, `$1$2${NBSP}`);
    return text as T;
  }
  if (Array.isArray(value)) return value.map((item) => polish(item, locale)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, polish(item, locale)]),
    ) as T;
  }
  return value;
}

export function getDictionary(locale: Locale): Dictionary {
  const { meta, messages, ...visible } = dictionaries[locale];
  return { meta, messages, ...polish(visible, locale) } as Dictionary;
}

/** Home path for a locale: "/" for Uzbek, "/ru/" and "/en/" for the others. */
export function localePath(locale: Locale) {
  return locale === defaultLocale ? '/' : `/${locale}/`;
}

/** Price in soʻm, grouped the way each language writes it. */
export function formatPrice(price: number, locale: Locale, currency: string) {
  const grouped = new Intl.NumberFormat('ru-RU').format(price).replace(/ | /g, ' ');
  return `${grouped} ${currency}`;
}
