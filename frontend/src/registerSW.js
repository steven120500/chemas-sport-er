// src/registerSW.js
// Registro del service worker de la PWA (vite-plugin-pwa, registerType: 'autoUpdate').
// - Cuando hay un deploy nuevo, el SW nuevo se activa y la página se recarga sola UNA vez,
//   así el usuario ve los cambios en la primera visita (antes recién en la segunda).
// - Busca actualizaciones cada hora y cada vez que la pestaña / PWA vuelve a primer plano
//   (clave en iPhone, donde la app instalada casi nunca se cierra).
import { registerSW as registerPWA } from 'virtual:pwa-register';

const CHECK_EVERY_MS = 60 * 60 * 1000; // 1 hora

export function registerSW() {
  // sw.js solo existe en el build de producción
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  registerPWA({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = async () => {
        if (registration.installing || !navigator.onLine) return;
        try {
          // Pedimos sw.js saltando cualquier caché HTTP; si responde, que el navegador compare
          const resp = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
          if (resp.status === 200) await registration.update();
        } catch {
          /* sin conexión: se reintenta en el próximo ciclo */
        }
      };

      setInterval(checkForUpdate, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
  });
}
