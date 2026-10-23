import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi.json';
import en from './locales/en.json';

const savedLang = localStorage.getItem('audit_language') || 'vi';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = (lng: 'vi' | 'en') => {
  localStorage.setItem('audit_language', lng);
  return i18n.changeLanguage(lng);
};

export default i18n;
