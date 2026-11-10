// Clases de Tailwind v3 que el CDN 2.2.19 no trae (generado). Va primero para que index.css gane en empates.
import './tailwind-compat.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './index.css';
import { registerSW } from './registerSW.js'; // 👈 importa tu helper de SW
import { installAuthFetch } from './authFetch.js';

// Agrega el token de sesión a todas las peticiones al backend (antes de renderizar)
installAuthFetch();

// Renderizar la aplicación
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 👇 Registramos el service worker al cargar la app
registerSW();