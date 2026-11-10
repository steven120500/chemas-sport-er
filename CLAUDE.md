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
- **Categorías** (`type`): Player, Fan, Mujer, Nacional, Abrigos, Retro, Niño, F1, NBA, MLB, NFL, Balón. Filtros virtuales: `Ofertas`, `Populares`, `Mundial 2026`, `Temp 26-27`, `Nuevo` (solo ordena). `filterType` admite **varios tipos separados por coma** (`?type=Player,Fan`), combinados con O; ver `parseTypes`/`matchesType` en `App.jsx`. El filtrado real se hace en el cliente sobre el catálogo completo (`allMatchingProducts`); al backend solo se manda `type` cuando hay uno.
- **Precios**: enteros (se truncan en `pre('validate')`). Formato en UI: `₡{Number(x).toLocaleString("de-DE")}` → `₡25.000`.
- **Ventas**: se registran vía `PUT /api/products/:id` (descuenta stock, guarda `History`, actualiza `popularCountHistory`). Anulación devuelve stock. Toda modificación de stock emite `io.emit('productoActualizado', product)` y `App.jsx` actualiza la lista en vivo.
- **Facturación**: `TiendaFactura` guarda método de pago (`Efectivo | Datáfono | SINPE | Mixto`), montos desglosados y `historyIds` ya facturados. Emisión `hacienda` (Alegra) o `interno`.
- **Fechas**: se guardan como strings `fechaYMD` (`YYYY-MM-DD`) para filtrar por día, más una fecha formateada legible. Zona horaria Costa Rica.

## Auth y roles

- **Login** (`POST /api/auth/login`): devuelve `{ token, username, roles, isSuperUser }`. JWT firmado con `JWT_SECRET`, vence a los 30 días. Límite: 10 intentos / 15 min por IP. Mensaje de error único ("Usuario o contraseña incorrectos").
- **Frontend**: el usuario (con `token`) vive en `localStorage.user`. `src/authFetch.js` intercepta `window.fetch` y agrega `Authorization: Bearer` a toda petición al backend; si responde 401 con token, dispara `auth:expired` y `App` cierra sesión. Sesiones viejas sin token se borran al cargar. Socket.io manda `auth: { token }`. `VITE_API_URL` permite apuntar a un backend local en desarrollo.
- **Backend**: `middleware/attachUser.js` valida el JWT → `req.user = { id, name, roles, isSuperUser }`. `middleware/auth.js`: `requireAuth`, `requireRole(...)` (súper usuario siempre pasa), `requireSuper`, `canSeeHidden`, `rateLimit`, `escapeRegex`. **Los headers `x-super`/`x-admin`/`x-roles` ya no dan permisos** (el frontend todavía los manda; se ignoran). `x-user`/`sellerName` solo sirven para atribuir nombre en el historial.
- **Permisos por ruta** (mismos que exige la UI):
  - Públicas: `GET /api/products`, `GET /api/products/:id` (ocultos → 404 sin permiso), `POST /api/auth/login`, health/ping.
  - Sesión: historial (GET), comisiones, anular ventas, `/api/tienda/*`, `/api/alegra/*`, `/api/guias/*`, `/api/correos/*`, export PDF.
  - `edit`: PUT / lock / unlock producto · `add`: crear producto, registrar usuario · `delete`: eliminar producto · `view_users`: listar/borrar usuarios (no a sí mismo ni a súper usuarios) · súper usuario: `DELETE /api/history`.
- **Socket.io**: con token válido → sala `admins` (objeto completo); público → versión sin `_lastEditMeta`/`lockedBy` (`utils/realtime.js`, usar siempre `emitProductUpdate(io, obj)`).
- Roles usados: `add`, `edit`, `delete`, `history`, `ver_ocultos`, `view_users`, `tienda`.
- Para agregar una ruta nueva: **siempre** ponerle `requireAuth`/`requireRole` salvo que sea catálogo público.

## Estilos — LEER ANTES DE TOCAR CSS

**Tailwind que realmente se aplica: v2.2.19 por CDN** (`frontend/index.html`). Tailwind v4 está instalado y hay `tailwind.config.js`, pero **no hay PostCSS ni plugin de Vite**, así que `@tailwind base/components/utilities` de `index.css` salen sin compilar. Consecuencias:
- Clases de v3+/JIT **no funcionan**: arbitrarias (`text-[#0f2d5c]`, `min-w-[40px]`, `rounded-[24px]`, `tracking-[0.2em]`, `text-[10px]`), paletas `zinc`, `emerald`, `amber`, `slate`, `neutral`, opacidad con barra (`bg-white/95`, `bg-black/80`), `animate-in slide-in-from-right`, `z-48`, `size-*`, etc. Muchas aparecen en el código y se ignoran silenciosamente.
- **Capa de compatibilidad** `src/tailwind-compat.css` (GENERADO, no editar): `frontend/scripts/gen-tailwind-compat.mjs` recorre los `.jsx` y genera CSS para las clases v3 que faltan, **solo estéticas**: paletas v3 (`zinc`, `emerald`, `amber`, …), colores con `/NN`, `bg-[#hex]`, `text-[Npx]`, `tracking-[..]`, `leading-[..]`, `rounded-[..]`, `border-[Npx]`, con variantes `sm/md/lg/xl`, `hover/focus/active/disabled/group-hover/placeholder`. No genera anchos/altos/posiciones arbitrarios (siguen sin aplicar). Se regenera solo en `predev`/`prebuild`, o con `npm run compat:css`. Se importa primero en `main.jsx` para que `index.css` gane en empates.
- Para algo nuevo: preferir CSS propio en `index.css` (prefijo por componente) o clases de Tailwind 2.x; las clases v3 estéticas funcionan vía la capa de compatibilidad (correr `npm run compat:css` si se agregan clases nuevas con el dev server ya abierto). Si se migra a Tailwind compilado, revisar visualmente todo.

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
  - Clases `.font-barca`, `.font-madrid`. Los `@font-face` de las 4 están en `index.css` y repetidos (con rutas de respaldo) en un `<style>` dentro de `ProductScreen.jsx`.

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
| `.animate-spin-slow` | rotación 10s (también la usan el sello TEMP y el spinner del login) |
| `.scrollbar-hide`, `.scroll-custom` | ocultar / estilizar scrollbar |
| `animate-sweep` (tailwind.config) | no se compila, no tiene efecto |

Por componente:
- **`WorldCupIntro.jsx`**: intro navideña "Gol navideño" (~4.9s, estilos `xi-*` en `index.css`). framer-motion: guirnalda de luces que cae con spring y parpadea (`xiTwinkle`), nieve en 3 capas parallax (`xiSnow`, random con semilla), balón SVG con gorro de Santa que cae y rebota con squash & stretch, remate hacia la cámara (scale 14) mientras el gorro sale volando, destello + anillo dorado + explosión de 30 estrellas/puntos, "CHEMA" (rojo) / "SPORT" letra por letra con spring + rotateX, badge "ER" dorado y "✦ Feliz Navidad ✦". Botón "Saltar intro" y barra de progreso. Línea de tiempo en la constante `T`. Una vez por sesión (`sessionStorage.chemasport_intro_shown`, se guarda al empezar); con reduced-motion no se muestra. `onFinished` se guarda en un ref (App lo pasa inline). `App.jsx` tiene un respaldo que la cierra a los 8s.
- **`Header.jsx`** (estilos `hd-*`): blanco fijo con blur, se compacta al hacer scroll (`is-scrolled`, >40px). Menú de categorías con auto-scroll continuo hacia la derecha (rAF, 0.5px/frame, lista duplicada ×2 para bucle infinito; la copia lleva `aria-hidden`), se pausa con hover/touch/focus y retoma a los 2s; desvanecido en los bordes, arrastre con mouse, subrayado animado (framer `scaleX`) y puntos de color en Temporada 26-27 / Nuevo / Ofertas; click en la activa la quita. Logo en `.hd-logo-mark` (el PNG `assets/logo.png` trae ~18% de margen transparente: se escala a 157.8% y se recorta al círculo; 46/40px móvil, 58/46px desktop). Menú lateral con framer (slide + items escalonados) renderizado con `createPortal` — el `backdrop-filter` del header recorta cualquier `position: fixed` hijo.
- **`TopBanner.jsx`**: mensajes rotativos cada 4s con fade de 500ms.
- **`ProductCard.jsx`**: estilos en `index.css` (sección "PRODUCT CARD", clases `pc-*`, mobile-first con breakpoint 640px). framer-motion: entrada `whileInView` escalonada por columna (`(i % 4) * 0.07`), hover `y: -6` con spring, badges con `staggerChildren`, sello y sticker NEW con pop-in spring; respeta `useReducedMotion`. CSS: zoom de imagen, `swapContinuo` + `dot1Sync/dot2Sync` (alternar imágenes), sello SVG "TEMPORADA 26/27" con anillo de texto girando (`spin-slow` 14s), flecha que rota 45°, borde gris→negro. Badges de categoría con punto blanco (igual para todas); la oferta muestra `-X%`. Grid: `max-w-7xl`, 2/3/4 columnas, imagen 1:1.15. Navidad: moño + cinta, capa de nieve SVG sobre el borde superior (`pc-snowcap`) y 5 copos que caen sobre la foto solo al hover (`pc-flakes`, `pcFlake`). Ya no muestra el bloque de inventario/traspasos del súper admin (el detalle por talla está en la pantalla de producto).
- **`Bienvenido.jsx`**: hero "Nueva temporada 26/27" (estilos `bv-*` en `index.css`). Fondo `#050505` con luces radiales roja/verde y textura `FondoDes/FondoMovil.png` al 6%. Carrusel infinito (lista ×3, rAF, arrastre/táctil; se apaga con reduced-motion) de cards fijas 200/250px que alternan degradado rojo/verde, con "26" de marca de agua, foco de luz, camiseta flotando (`bvFloat`), brillo diagonal al hover. Toda la card es clickeable y filtra `Temp 26-27` + equipo. Encabezado con framer-motion (stagger fade-up) y "26/27" en degradado dorado.
- **`FilterBar.jsx`** (estilos `fb-*`): buscador con debounce de 350ms, botón "Filtros" con contador, botón "Guía de tallas" (`onOpenMedidas`) y "Ocultos" (super admin). Chips de filtros activos removibles + "Limpiar todo". Panel: bottom sheet en móvil (se cierra arrastrando la manija, `useDragControls`) y modal en desktop; categorías y tallas multi-selección que aplican en vivo; footer "Limpiar" / "Ver resultados". Escape cierra.
- **`Medidas.jsx`** (estilos `gt-*`): guía de tallas con tabs (las de la categoría actual primero, pill animada con `layoutId`), una tabla a la vez con transición, botón ampliar, bloque "¿Cómo medir?" en 3 pasos y CTA a WhatsApp. Siempre montado en `App.jsx` (prop `open`) para que la animación de salida funcione.
- **`ProductScreen.jsx`** (estilos `ps-*`): galería con miniaturas, flechas y swipe (framer `drag="x"`), columna de info sticky en desktop, chips de dorsal (reemplazan el `<select>`, usan el mismo `handleDorsalSelectChange`), tallas como botones, CTA de WhatsApp verde con "shake" si falta talla y pulso cuando está listo, bloque de confianza (envíos/pagos/WhatsApp). ⚠️ El contenedor `relative inline-flex w-full` + `img w-full` no se toca: el dorsal (`getDorsalLayout`) está calibrado sobre él.
- **Otros (estilos en `index.css`)**: `TopBanner` (`tb-*`, barra negra, mensajes que suben con framer), `Footer` (`ft-*`, oscuro con 3 beneficios, logo, redes), `FloatingWhatsapp` (`fw-btn`, verde con pulso; en desktop muestra "¿Dudas? Escribinos"), botón admin agregar (`fab-add`), paginación (`pg-*`, blanco/negro + total de productos), estado vacío (`empty-state`), `LoginModal` (`lg-*`).
- **Páginas admin** (`/tienda`, `/comisiones`, `/guias`, `/history`): contenedor raíz con `.adm-page` (fondo `#f4f4f5` con puntos sutiles) para que resalten las tarjetas blancas; sin `FloatingWhatsapp`. La intro solo corre en `/`.
- Modales: `fadeInUpModal` / `animate-fade-in-up` (definidas localmente en cada modal con `<style>`).
- Spinners: `animate-spin` con `border-t-black`.

## Integraciones y variables de entorno

`api/.env` (no versionado; plantilla en `api/.env.example`): `MONGO_URI`, `PORT`, `JWT_SECRET`, `CLOUDINARY_*`, `ALEGRA_EMAIL`, `ALEGRA_TOKEN`, `CCR_*`. `server.js` carga dotenv con `import 'dotenv/config'` como **primer import** (las rutas leen `process.env` al importarse). Sin `JWT_SECRET` nadie puede iniciar sesión; sin `ALEGRA_*` no funciona la facturación (ambos avisan en el log al arrancar).

- **Cloudinary**: imágenes de productos. **El costo es ~96% ancho de banda** (nov-2026: 248 GB/mes, 2,3 M impresiones; almacenamiento 8 GB, transformaciones despreciables). Reglas para no inflarlo:
  - Nunca mostrar una URL de Cloudinary sin transformar: siempre `f_auto,q_auto:eco` + ancho fijo (cards `w_480,h_552` en `ProductCard.cldUrl`; producto `c_limit,w_1000` y miniaturas `w_160` en `ProductScreen.transformCloudinary`; Tienda `cldThumb` 96px).
  - **No usar `dpr_auto`** (genera imágenes de 2–3× el ancho en celulares).
  - La 2da foto de cada card se monta solo tras el primer hover (`wantsAlt`).
  - El service worker guarda Cloudinary con `CacheFirst` (30 días, 400 entradas).
  - Subida: `UPLOAD_LIMIT` (`api/config/cloudinary.js`) achica toda imagen a máx. 1400px / `q_auto:good` antes de guardarla; `AddProductModal` y `ProductAdminEditor` además comprimen en el navegador (WebP 1000px, 0.75).
  - Limpieza: `api/utils/cloudinaryCleanup.js` → al editar se borran las fotos/dorsales reemplazados y al eliminar un producto sus fotos + dorsales, **solo si ningún otro producto ni `TiendaFactura.ventas.imagen` las referencia**. Si un PUT deja al producto sin fotos, no se borra nada.
  - Huérfanas: `npm run cloudinary:orphans` (en `api/`) genera reporte en `api/scripts/output/` (gitignored); borrar requiere `--delete --yes` y solo toca carpetas `products*`. Nov-2026: 1.860 originales (5,3 GB, ~2,8 MB c/u por subidas sin comprimir), 137 huérfanas (261 MB). El panel muestra ~30k "Images" porque cuenta las versiones derivadas.
- **Alegra**: facturación electrónica (`ALEGRA_EMAIL`/`ALEGRA_TOKEN` desde el entorno).
- **Correos de Costa Rica**: token cacheado en memoria, catálogos geográficos cacheados.
- **socket.io**: evento único `productoActualizado`.
- **PWA**: `registerType: autoUpdate`, `injectRegister: null`, `skipWaiting`/`clientsClaim`. Registro único en `src/registerSW.js` vía `virtual:pwa-register` (solo en producción): al haber deploy nuevo la página se recarga sola una vez; busca actualizaciones cada hora y al volver la pestaña a primer plano. En Render, `/*` debe ir con `Cache-Control: no-cache` (si no, `sw.js`/`index.html` quedan cacheados y los deploys tardan en verse). `/api/products` es `NetworkFirst` (timeout 3s, 5 min).
- Front: `react-hot-toast` y `react-toastify` (ambos montados), `react-icons` (Fa*) y `lucide-react`, `jspdf`+`html2canvas` en guías.
- WhatsApp de la tienda: `wa.me/50660369857`.

## Convenciones

- Componentes funcionales en `.jsx`, un componente grande por pantalla, estado local con hooks; no hay store global ni capa de servicios.
- Comentarios y nombres en español, con emojis de marcador (`🔥`, `👈`) — mantener el estilo existente al editar.
- Backend: rutas con try/catch y `res.status(500).json({ error: '...' })`; registrar cambios relevantes en `History`; emitir `productoActualizado` al tocar stock.
- Mobile-first: casi todo usa variantes `sm:`; probar siempre en ancho de móvil.
- Commits actuales usan "LISTO"; preferir mensajes descriptivos.

## Deuda técnica conocida (para priorizar mejoras)

1. ~~Seguridad crítica~~ (corregido nov-2026: JWT + permisos por ruta, secretos a env, helmet, rate limit, regex escapadas, límites de tamaño, `npm audit` en 0). Pendiente operativo: rotar el token de Alegra (estuvo en el historial de git) y las contraseñas débiles de usuarios.
2. **Tailwind**: configurar compilación real (v4 con `@tailwindcss/vite`) y quitar el CDN 2.2.19; muchas clases hoy no aplican.
3. ~~Fuente Barcelona con ruta rota~~ (corregido; `index.css` ya declara las 4 fuentes de dorsal).
4. **API base duplicada** en ~13 archivos; centralizar en `src/api.js` + `VITE_API_URL`.
5. **Búsqueda**: en `GET /api/products`, `Temp 26-27` usa `$or` y el filtro de tallas/`storeView` lo sobrescribe.
6. **Bundle** JS ~1.25 MB sin code-splitting: lazy-load de `TiendaPage`, `ComisionesPage`, `GuiasPage`, `HistoryPage`, `jspdf`.
7. Componentes gigantes (`TiendaPage` 2.1k líneas, `ComisionesPage` 1.8k, `GuiasPage`/`GuiasCorreos` 1.2k) y lógica de Alegra duplicada entre `alegraRoutes` y `tiendaRoutes`.
8. Varios: dos librerías de toasts, `.DS_Store` versionado, i18n con contenido placeholder (`DroppingCR`), componentes sin uso: `ProductModal.jsx` y `UserDropDown.jsx`.
