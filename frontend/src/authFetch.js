// src/authFetch.js
// Interceptor global de fetch: a TODA petición dirigida al backend le agrega
// "Authorization: Bearer <token>" con el token guardado al iniciar sesión.
// Así no hay que tocar los ~40 fetch repartidos en los componentes.
//
// - Si el backend responde 401 a una petición que llevaba token (vencido o usuario borrado),
//   dispara el evento "auth:expired" y App cierra la sesión.
// - En desarrollo, VITE_API_URL permite apuntar a un backend local sin tocar el código.

export const BACKEND_URL = 'https://chemas-sport-er-backend.onrender.com';
const API_OVERRIDE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function getToken() {
  return getStoredUser()?.token || null;
}

/** URL base efectiva del backend (para socket.io, etc.) */
export const API_BASE = API_OVERRIDE || BACKEND_URL;

export function installAuthFetch() {
  if (typeof window === 'undefined' || window.__authFetchInstalled) return;
  window.__authFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
    const isBackend = url.startsWith(BACKEND_URL) || (API_OVERRIDE && url.startsWith(API_OVERRIDE));
    if (!isBackend) return originalFetch(input, init);

    if (API_OVERRIDE && url.startsWith(BACKEND_URL)) url = API_OVERRIDE + url.slice(BACKEND_URL.length);

    const token = getToken();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    const finalInput = input instanceof Request ? new Request(url, input) : url;
    const res = await originalFetch(finalInput, { ...init, headers });

    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return res;
  };
}
