# CLAUDE.md — ChemaSport ER

Tienda online + sistema interno (POS, inventario, comisiones, guías de envío) de **ChemaSport ER**, tienda de camisetas de fútbol en Costa Rica. Moneda: colones (`₡`). Idioma del código, UI y commits: **español**.

- Producción frontend: `https://chemasporter.com` (también `chemasport-er.onrender.com`)
- Producción backend: `https://chemas-sport-er-backend.onrender.com` (Render)
- Diseñado por Beesoft.

## Comandos

```bash
npm run dev                 # raíz: levanta api + frontend con concurrently
npm run dev --prefix api    # nodemon server.js (puerto PORT o 5000)
npm run dev --prefix frontend   # vite (5173)
npm run build --prefix frontend # vite build (genera también sw.js de la PWA)
npm run lint --prefix frontend  # eslint
node api/seedSuperUser.js   # (re)crea el súper usuario
```

No hay tests. No hay TypeScript. Verificar cambios con `npm run build --prefix frontend` y `npm run lint`.

## Estructura

```
api/                       Express 5 + Mongoose 8 (ESM, top-level await)
  server.js                CORS (lista allowedOrigins), socket.io, montaje de rutas
  middleware/attachUser.js Lee Bearer JWT (si existe) o header x-user → req.user
  models/                  Product, User, History, Guia, TiendaFactura
  routes/
    productRoutes.js       CRUD productos, lock/unlock, ventas (PUT), anular, subida a Cloudinary (multer memoria)
    tiendaRoutes.js        POS de tienda física: emitir factura (Alegra / interno), resumen, PDF, ajuste stock
    alegraRoutes.js        Facturación electrónica Hacienda vía API de Alegra (contactos, cédula, tiquete)
    correosRoutes.js       API Correos de Costa Rica (provincias/cantones/distritos, generar guía). Define su propio modelo GuiaCorreos inline
    guiasRoutes.js         Guías manuales (modelo Guia)
    saleRoutes.js          Anular ventas
    historyroutes.js       Bitácora de acciones (History)
    authRoutes.js          register / login / users
    pdfRoutes.js           /api/export-products-pdf (pdfkit)
frontend/                  React 19 + Vite 7 + PWA (vite-plugin-pwa / workbox)
  index.html               ⚠️ Carga Tailwind 2.2.19 por CDN (ver "Estilos")
  src/App.jsx              Router, estado global (productos, filtros, usuario, paginación), socket.io
  src/components/          Un archivo por pantalla/modal (algunos de 1000–2000 líneas)
  src/utils/tallaPorTipo.js Tallas por categoría
  src/i18n/                i18next (es por defecto, en fallback) — casi sin uso real
  public/                  Imágenes de campaña, fondos, stickers, fuentes de clubes
```

### Rutas del frontend (`App.jsx`)
| Ruta | Componente | Uso |
|---|---|---|
| `/` | catálogo (Bienvenido + FilterBar + grid de ProductCard + paginación) | público |
| `/producto/:id` | `ProductDetailWrapper` → `ProductScreen` | público |
| `/history` | `HistoryPage` | admin |
| `/comisiones` | `ComisionesPage` | admin |
| `/guias` | `GuiasPage` (+ `GuiasCorreos`) | admin |
| `/tienda` | `TiendaPage` (POS) | rol `tienda` / admin |

Filtros del catálogo se sincronizan con la URL: `?q=&type=&sizes=S,M`. Si hay filtros en la URL se salta la intro.

## Dominio

- **Producto** (`api/models/Product.js`): `name`, `price`, `discountPrice` (oferta si `>0` y `< price`), `type` (categoría), `imageSrc` + `images[]` (Cloudinary `{public_id,url}`), flags `isPopular`, `hidden`, `isMundial2026`, `isTemporada2627`, `isNumerable` + `teamFont` (`barca|madrid|boca|river|none`) + `dorsalOptions[]` (nombre/número/cantidad/imagen), `lockedBy/lockedAt` (candado de edición).
- **Inventario en 3 ubicaciones**, cada una objeto `{ talla: cantidad }`:
  - `tienda` → tienda física
  - `stock` → "bodega1"/"tienda1"
  - `bodega` → "bodega2"/"tienda2"
  - El parámetro `storeView` de `GET /api/products` filtra por ubicación.
- **Tallas**: adulto `S M L XL XXL 3XL 4XL`; niño `16–28` (pares); balón `3 4 5`; llavero `U`. Deben coincidir entre `Product.js`, `productRoutes.js` y `frontend/src/utils/tallaPorTipo.js`.
- **Categorías** (`type`): Player, Fan, Mujer, Nacional, Abrigos, Retro, Niño, F1, NBA, MLB, NFL, Balón. Filtros virtuales: `Ofertas`, `Populares`, `Mundial 2026`, `Temp 26-27`.
- **Precios**: enteros (se truncan en `pre('validate')`). Formato en UI: `₡{Number(x).toLocaleString("de-DE")}` → `₡25.000`.
- **Ventas**: se registran vía `PUT /api/products/:id` (descuenta stock, guarda `History`, actualiza `popularCountHistory`). Anulación devuelve stock. Toda modificación de stock emite `io.emit('productoActualizado', product)` y `App.jsx` actualiza la lista en vivo.
- **Facturación**: `TiendaFactura` guarda método de pago (`Efectivo | Datáfono | SINPE | Mixto`), montos desglosados y `historyIds` ya facturados. Emisión `hacienda` (Alegra) o `interno`.
- **Fechas**: se guardan como strings `fechaYMD` (`YYYY-MM-DD`) para filtrar por día, más una fecha formateada legible. Zona horaria Costa Rica.

## Auth y roles (estado actual)

- `POST /api/auth/login` devuelve `{ username, roles, isSuperUser }` (**sin token**). El frontend lo guarda en `localStorage.user`.
- Permisos se envían como headers que el cliente controla: `x-admin`, `x-super`, `x-roles`, `x-user`.
- Roles usados: `add`, `edit`, `delete`, `history`, `ver_ocultos`, `view_users`, `tienda`; `isSuperUser` lo puede todo.
- El frontend usa la URL del backend **hardcodeada** (`API_BASE` en `App.jsx` y `fetch` directo en cada componente). `src/api.js` (axios + `VITE_API_URL`) existe pero no se usa.

## Estilos — LEER ANTES DE TOCAR CSS

**Tailwind que realmente se aplica: v2.2.19 por CDN** (`frontend/index.html`). Tailwind v4 está instalado y hay `tailwind.config.js`, pero **no hay PostCSS ni plugin de Vite**, así que `@tailwind base/components/utilities` de `index.css` salen sin compilar. Consecuencias:
- Clases de v3+/JIT **no funcionan**: arbitrarias (`text-[#0f2d5c]`, `min-w-[40px]`, `rounded-[24px]`, `tracking-[0.2em]`, `text-[10px]`), paletas `zinc`, `emerald`, `amber`, `slate`, `neutral`, opacidad con barra (`bg-white/95`, `bg-black/80`), `animate-in slide-in-from-right`, `z-48`, `size-*`, etc. Muchas aparecen en el código y se ignoran silenciosamente.
- Para algo nuevo: usar clases de Tailwind 2.x, `style={{}}` inline, o CSS en `index.css` / `<style>` del componente. Si se migra a Tailwind compilado, revisar visualmente todo (cambiarán estilos que hoy no se aplican).

`index.css` también define estilos globales para `button` (fondo `#1a1a1a`, texto blanco, `hover: scale(1.05)` + borde verde `#4cc27b`, `outline` verde en focus) — cualquier `<button>` los hereda; hay que sobreescribirlos.

**Modo claro forzado**: `color-scheme: light`, fondo `#fff` y texto `#000` con `!important` en `index.html` e `index.css`. No hay dark mode.

### Paleta
Estética **monocroma blanco/negro "luxury"** con acentos puntuales.

| Uso | Color |
|---|---|
| Fondo / texto base | `#ffffff` / `#000000` |
| Superficies oscuras | `black`, `#111`, `#1a1a1a`, bordes `#222` / `#333` |
| Grises UI | gray-50…800 (y zinc en código, ver nota CDN) |
| Acento principal de marca (rojo) | `red-600` / `red-700` — página actual de paginación, cintas, CTAs de alerta |
| Verde (navegación/oferta) | `green-700` (botones paginación), `green-500` badge, gradiente oferta `#0f5132 → #2ecc71 → #7dffb3` |
| Azul (módulo guías/Correos) | `#0f2d5c` |
| Popular | `yellow-500`; etiqueta naranja/roja `#7a1600 → #ff2600` |
| Dorado (Mundial / premium) | `#FFE600`, `#F5C400`, `#D4A000`, `amber-300/400` |
| Links | `#007bff` / hover `#0056b3` |
| Focus / hover global de botones | `#4cc27b` |
| PWA | `theme_color #000000`, `background_color #ffffff` |

### Tipografía
- Base: `system-ui, Avenir, Helvetica, Arial, sans-serif`, `line-height 1.5`, antialiased.
- Lenguaje visual: **`font-black` + `uppercase` + `tracking-widest/wider`** en casi todo (títulos, badges, botones). Precios `font-black tracking-tight`. Tamaños pequeños tipo `text-[10px]`/`text-[11px]` (ojo: no aplican con el CDN).
- **Fuentes de dorsales** (`public/fonts/`), para previsualizar nombre+número en camisetas personalizables (`ProductScreen.jsx`, según `product.teamFont`):
  - `FontBarca` → `Barcelona Tipografia.ttf`
  - `FontMadrid` → `Real Madrid Tipografia.ttf`
  - `FontBoca` → `Boca Tipografia.ttf`
  - `FontRiver` → `River Tipografia.ttf`
  - Clases `.font-barca`, `.font-madrid`. Los `@font-face` están en `index.css` (solo Barca/Madrid) y repetidos en un `<style>` dentro de `ProductScreen.jsx` (los 4).

### Animaciones
Librería: **framer-motion** (`motion`, `AnimatePresence`) para modales, FilterBar y transiciones; el resto son keyframes CSS.

Globales (`index.css`):
| Clase | Efecto |
|---|---|
| `.animate-enter` + `.delay-100…400` | fade-up 40px + scale .95→1, 1.2s `cubic-bezier(0.16,1,0.3,1)` — entrada en cascada "premium" |
| `.etiqueta-oferta-verde` | badge con reflejo verde que barre (3s loop) |
| `.etiqueta-popular-naranja` | idem en naranja/rojo |
| `.etiqueta-nuevo` | `pulse-soft` latido 1→1.05, 2s |
| `.header-shine` / `.logo-shine` | barrido de brillo y glow del logo (2s, una vez) |
| `.animate-spin-slow` | rotación 10s (definida dos veces; gana la de 10s) |
| `.scrollbar-hide`, `.scroll-custom` | ocultar / estilizar scrollbar |
| `animate-sweep` (tailwind.config) | no se compila, no tiene efecto |

Por componente:
- **`WorldCupIntro.jsx`**: intro cinemática de jugada y gol (keyframes `ballDribbleReal`, `ballRocketShot`, `realKickLeg`, `netImpact`, `goalSlam`, `shockwave`, `snowfall`, `badgeSlide`…). Fases por `setTimeout` (2.4s remate, 2.9s "CHEMA SPORT", 3.3s "ER", fade ~8.5s). Se muestra **una vez por sesión** (`sessionStorage.chemasport_intro_shown`) y `App.jsx` la corta a los 4.5s como fallback.
- **`Header.jsx`**: alterna **blanco ↔ negro cada 4s** (`isLightMode`, `transition-colors duration-1000`, logo con `invert`). Barra de categorías con auto-scroll infinito (rAF, 0.6px/frame, lista duplicada) y drag manual.
- **`TopBanner.jsx`**: mensajes rotativos cada 4s con fade de 500ms.
- **`ProductCard.jsx`**: estilos en `index.css` (sección "PRODUCT CARD", clases `pc-*`, mobile-first con breakpoint 640px). framer-motion: entrada `whileInView` escalonada por columna (`(i % 4) * 0.07`), hover `y: -6` con spring, badges con `staggerChildren`, sello y sticker NEW con pop-in spring; respeta `useReducedMotion`. CSS: zoom de imagen, `swapContinuo` + `dot1Sync/dot2Sync` (alternar imágenes), sello SVG "TEMPORADA 26/27" con anillo de texto girando (`spin-slow` 14s), flecha que rota 45°, borde gris→negro. Badges de categoría con punto blanco (igual para todas); la oferta muestra `-X%`. Grid: `max-w-7xl`, 2/3/4 columnas, imagen 1:1.15.
- **`Bienvenido.jsx`**: hero "Nueva temporada 26/27" (estilos `bv-*` en `index.css`). Fondo `#050505` con luces radiales roja/verde y textura `FondoDes/FondoMovil.png` al 6%. Carrusel infinito (lista ×3, rAF, arrastre/táctil; se apaga con reduced-motion) de cards fijas 200/250px que alternan degradado rojo/verde, con "26" de marca de agua, foco de luz, camiseta flotando (`bvFloat`), brillo diagonal al hover. Toda la card es clickeable y filtra `Temp 26-27` + equipo. Encabezado con framer-motion (stagger fade-up) y "26/27" en degradado dorado.
- Modales: `fadeInUpModal` / `animate-fade-in-up` (definidas localmente en cada modal con `<style>`).
- Spinners: `animate-spin` con `border-t-black`.

## Integraciones y variables de entorno

`api/.env` (no versionado): `MONGO_URI`, `PORT`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CCR_API_URL`, `CCR_USUARIO`, `CCR_PASSWORD`, `CCR_CODIGO_CLIENTE`, `CCR_CODIGO_SERVICIO`. `attachUser` usa `JWT_SECRET` (no está definido; hoy no se emiten tokens).

- **Cloudinary**: imágenes de productos (cache agresivo en el service worker, 30 días).
- **Alegra**: facturación electrónica. Credenciales actualmente hardcodeadas en `alegraRoutes.js` y `tiendaRoutes.js` (deberían ir a `.env`).
- **Correos de Costa Rica**: token cacheado en memoria, catálogos geográficos cacheados.
- **socket.io**: evento único `productoActualizado`.
- **PWA**: `registerType: autoUpdate`; `/api/products` es `NetworkFirst` (timeout 3s, 5 min).
- Front: `react-hot-toast` y `react-toastify` (ambos montados), `react-icons` (Fa*) y `lucide-react`, `jspdf`+`html2canvas` en guías.
- WhatsApp de la tienda: `wa.me/50660369857`.

## Convenciones

- Componentes funcionales en `.jsx`, un componente grande por pantalla, estado local con hooks; no hay store global ni capa de servicios.
- Comentarios y nombres en español, con emojis de marcador (`🔥`, `👈`) — mantener el estilo existente al editar.
- Backend: rutas con try/catch y `res.status(500).json({ error: '...' })`; registrar cambios relevantes en `History`; emitir `productoActualizado` al tocar stock.
- Mobile-first: casi todo usa variantes `sm:`; probar siempre en ancho de móvil.
- Commits actuales usan "LISTO"; preferir mensajes descriptivos.

## Deuda técnica conocida (para priorizar mejoras)

1. **Seguridad (crítico)**: permisos basados en headers que manda el cliente (`x-super: true` da acceso total); `/api/auth/register`, `/users` y `DELETE /users/:id` sin protección; login sin JWT; credenciales de Alegra en el repo (rotarlas); `seedSuperUser.js` con contraseña en texto plano; `authRoutes` hace `console.log` del password.
2. **Tailwind**: configurar compilación real (v4 con `@tailwindcss/vite`) y quitar el CDN 2.2.19; muchas clases hoy no aplican.
3. **Fuente Barcelona**: `index.css` apunta a `Barcelona Tipografia .ttf` (con espacio) pero el archivo es `Barcelona Tipografia.ttf`; solo funciona por el fallback en `ProductScreen.jsx`.
4. **API base duplicada** en ~13 archivos; centralizar en `src/api.js` + `VITE_API_URL`.
5. **Búsqueda**: `q` va directo a `$regex` sin escapar. En `GET /api/products`, `Temp 26-27` usa `$or` y el filtro de tallas/`storeView` lo sobrescribe.
6. **Bundle** JS ~1.25 MB sin code-splitting: lazy-load de `TiendaPage`, `ComisionesPage`, `GuiasPage`, `HistoryPage`, `jspdf`.
7. Componentes gigantes (`TiendaPage` 2.1k líneas, `ComisionesPage` 1.8k, `GuiasPage`/`GuiasCorreos` 1.2k) y lógica de Alegra duplicada entre `alegraRoutes` y `tiendaRoutes`.
8. Varios: dos librerías de toasts, `.DS_Store` versionado, i18n con contenido placeholder (`DroppingCR`), meta anti-caché en `index.html` que choca con la PWA, `@keyframes spin-slow` duplicado.
