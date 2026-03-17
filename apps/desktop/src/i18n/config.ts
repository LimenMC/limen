import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import de from './locales/de.json';

const resources = {
  en: {
    translation: en
  },
  tr: {
    translation: tr
  },
  zh: {
    translation: zh
  },
  de: {
    translation: de
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
