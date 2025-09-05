// src/registerSW.js
import { Workbox } from 'workbox-window';

export function registerSW() {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js', { scope: '/' });

    // 👉 Auto-actualizar el Service Worker si hay uno nuevo
    wb.addEventListener('waiting', () => {
      wb.messageSkipWaiting?.();
    });

    wb.register();
  }
}