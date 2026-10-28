import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de } from './de';
import { en } from './en';

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
/** German is the reference catalog; every other language must provide the same keys. */
export type Messages = Widen<typeof de>;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof de };
  }
}

/** Until users can pick a language in their profile, follow the browser. */
function initialLanguage(): 'de' | 'en' {
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

export default i18n;
