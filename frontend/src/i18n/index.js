import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Cargar todos los JSON de /es y /en
const modules = import.meta.glob('./{es,en}/*.json', { eager: true });

const resources = {
  es: {},
  en: {},
};

// Repartir los módulos por idioma y flujo
for (const path in modules) {
  const parts = path.split('/');
  const lang = parts[1]; // 'es' o 'en'
  const key = parts[2].replace('.json', ''); // 'loginFlow', etc.

  resources[lang][key] = modules[path].default;
}

i18n.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'en',
  resources,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
