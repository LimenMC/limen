import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import zh from '../locales/zh.json';
import de from '../locales/de.json';

export const resources = {
  en: { translation: en },
  tr: { translation: tr },
  zh: { translation: zh },
  de: { translation: de }
};

export const supportedLanguages = ['en', 'tr', 'zh', 'de'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export function initI18n(lng?: string, useReact = false) {
  const instance = useReact ? i18n.use(initReactI18next) : i18n;
  
  return instance.init({
    resources,
    lng: lng || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });
}

export { i18n };
export default i18n;
