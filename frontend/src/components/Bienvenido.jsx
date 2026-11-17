import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ⚠️ Estilos en index.css (sección "BIENVENIDO", clases bv-*).
// Hero con UN carrusel curvo (como el interior de un cilindro) que va rotando de colección:
// Temporada 26/27 → Retro → LEGO → NBA·MLB·F1 (salteado), cambiando en cada vuelta. Decoración navideña: luces, nieve y gorrito.
// Toda la geometría se calcula en "unidades" (--u): 1440 de ancho en compu, 640 en celular.
// Las tarjetas se dibujan cada frame con transform + clip-path (sin layout), así corre liso en iPhone.

const FILTRO_TEMPORADA = 'Temp 26-27';
const IMG = (n) => `/Bienvenido/v2/${n}.webp`;
const VUELTAS_POR_COLECCION = 1; // 👈 cambia de colección en cada vuelta…
const SEGUNDOS_MENOS = 7; // …pero 7 s antes de completarla

const FILAS = [
  {
    key: 'temporada',
    titulo: 'Temporada 26/27',
    categoria: FILTRO_TEMPORADA,
    dir: -1, // 👈 derecha → izquierda
    items: [
      { nombre: 'Real Madrid', busqueda: 'Real Madrid', img: IMG('Real1') },
      { nombre: 'Barcelona', busqueda: 'Barcelona', img: IMG('Barcelona1') },
      { nombre: 'Bayern', busqueda: 'Bayern', img: IMG('Bayern1') },
      { nombre: 'PSG', busqueda: 'PSG', img: IMG('PSG1') },
      { nombre: 'Real Madrid', busqueda: 'Real Madrid', img: IMG('Real2') },
      { nombre: 'Barcelona', busqueda: 'Barcelona', img: IMG('Barcelona2') },
      { nombre: 'Bayern', busqueda: 'Bayern', img: IMG('Bayern2') },
      { nombre: 'PSG', busqueda: 'PSG', img: IMG('PSG2') },
    ],
  },
  {
    key: 'retro',
    titulo: 'Retro',
    categoria: 'Retro',
    dir: 1, // 👈 izquierda → derecha
    items: [
      { nombre: 'Barcelona', busqueda: 'Barcelona', img: IMG('BarcelonaRetro') },
      { nombre: 'Brasil', busqueda: 'Brasil', img: IMG('BrasilRetro') },
      { nombre: 'Argentina', busqueda: 'Argentina', img: IMG('Retro2') },
      { nombre: 'Francia', busqueda: 'Francia', img: IMG('FranciaRetro') },
      { nombre: 'Real Madrid', busqueda: 'Real Madrid', img: IMG('RealRetro') },
      { nombre: 'Inglaterra', busqueda: 'Inglaterra', img: IMG('IngaleterraRetro') },
      { nombre: 'Argentina', busqueda: 'Argentina', img: IMG('Retro') },
    ],
  },
  {
    key: 'lego',
    titulo: 'LEGO',
    categoria: 'LEGO',
    dir: -1,
    blend: true, // 👈 las fotos de LEGO traen fondo blanco: multiply lo funde con el color de la card
    items: [
      { nombre: 'Messi', busqueda: 'Messi', img: IMG('LegoMessi') },
      { nombre: 'Ferrari F1', busqueda: 'Ferrari', img: IMG('LegoFerrari') },
      { nombre: 'Cristiano', busqueda: 'Cristiano', img: IMG('LegoCristiano') },
      { nombre: 'Red Bull F1', busqueda: 'Red Bull', img: IMG('LegoRedBull') },
      { nombre: 'Porsche', busqueda: 'Porsche', img: IMG('LegoPorshe') },
      { nombre: 'Mercedes F1', busqueda: 'Mercedes', img: IMG('LegoMercedes') },
    ],
  },
  {
    key: 'usa',
    titulo: 'NBA · MLB · F1',
    categoria: 'NBA,MLB,F1', // 👈 filterType admite varios tipos separados por coma
    cta: 'Ver NBA, MLB y F1',
    dir: 1,
    cover: true, // 👈 fotos reales (fondo de hojas): llenan toda la card
    // Salteado: NBA → MLB → F1 → ...
    items: [
      { nombre: 'Bulls', busqueda: 'Bulls', categoria: 'NBA', img: IMG('Bulls') },
      { nombre: 'Yankees', busqueda: 'Yankees', categoria: 'MLB', img: IMG('Yankes') },
      { nombre: 'Ferrari', busqueda: 'Ferrari', categoria: 'F1', img: IMG('Ferrari') },
      { nombre: 'Lakers', busqueda: 'Lakers', categoria: 'NBA', img: IMG('Lakers') },
      { nombre: 'Dodgers', busqueda: 'Dodgers', categoria: 'MLB', img: IMG('Dodgers') },
      { nombre: 'McLaren', busqueda: 'McLaren', categoria: 'F1', img: IMG('Maclaren') },
      { nombre: 'Warriors', busqueda: 'Golden State', categoria: 'NBA', img: IMG('Warriors') },
      { nombre: 'Astros', busqueda: 'Astros', categoria: 'MLB', img: IMG('Astros') },
      { nombre: 'Red Bull', busqueda: 'Red Bull', categoria: 'F1', img: IMG('RedBull') },
      { nombre: 'Thunder', busqueda: 'Oklahoma', categoria: 'NBA', img: IMG('Oklahoma') },
      { nombre: 'Mercedes', busqueda: 'Mercedes', categoria: 'F1', img: IMG('Mercedes') },
    ],
  },
];

// 📐 Parámetros del cilindro (en unidades, los de la referencia)
const GEO = { w0: 170, h0: 280, pitch: 196, arch: 12 };
const SPEED = 60; // unidades por segundo
const GROW = 92 / 280; // alto extra en los bordes
const Q_MAX = 1.1;
const S_MAX = 1 + GROW * Math.pow(Q_MAX, 2.6);
const RADIO = 15; // esquinas

const medirLayout = (W) => {
  const mobile = W < 820;
  const u = mobile ? W / 640 : Math.min(W / 1440, 1.1);
  const H = (GEO.h0 * S_MAX + GEO.arch + 16) * u;
  const centroTop = H / 2 - (GEO.h0 / 2) * u;
  const wMax = GEO.w0 * u * (1 + 0.28 * Q_MAX * Q_MAX);
  const slotsNecesarios = Math.ceil((W + 2 * wMax + 2 * GEO.pitch * u) / (GEO.pitch * u)) + 1;
  return { W, mobile, u, H, centroTop, wMax, slotsNecesarios };
};

const mod = (a, n) => ((a % n) + n) % n;
const f1 = (n) => n.toFixed(1);

// Punto a distancia r de A en dirección a B
const hacia = (ax, ay, bx, by, r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(r / len, 0.5);
  return [ax + dx * k, ay + dy * k];
};

// Cuadrilátero con esquinas redondeadas (coordenadas locales de la card)
const pathQuad = (x0, tl, bl, x1, tr, br, r) => {
  const a = hacia(x0, tl, x1, tr, r);
  const b = hacia(x1, tr, x0, tl, r);
  const c = hacia(x1, br, x0, bl, r);
  const d = hacia(x0, bl, x1, br, r);
  return (
    `path('M${f1(x0)} ${f1(tl + r)}Q${f1(x0)} ${f1(tl)} ${f1(a[0])} ${f1(a[1])}` +
    `L${f1(b[0])} ${f1(b[1])}Q${f1(x1)} ${f1(tr)} ${f1(x1)} ${f1(tr + r)}` +
    `L${f1(x1)} ${f1(br - r)}Q${f1(x1)} ${f1(br)} ${f1(c[0])} ${f1(c[1])}` +
    `L${f1(d[0])} ${f1(d[1])}Q${f1(x0)} ${f1(bl)} ${f1(x0)} ${f1(bl - r)}Z')`
  );
};

/* ============ Animaciones de entrada ============ */
const EASE = [0.16, 1, 0.3, 1];
const grupo = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } };
const subeBlur = {
  hidden: { opacity: 0, y: 28, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: EASE } },
};
const trazo = (delay) => ({
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { pathLength: { duration: 0.9, ease: 'easeInOut', delay }, opacity: { duration: 0.01, delay } } },
});
const nota = (delay, rotate) => ({
  hidden: { opacity: 0, y: 8, rotate },
  show: { opacity: 1, y: 0, rotate, transition: { duration: 0.6, delay } },
});

/* ============ Decoración navideña ============ */
const COLORES_LUZ = ['#ff3b3b', '#ffd23f', '#2ecc71', '#ffffff'];

// Guirnalda: cable con ondas y focos que titilan (en px, según el ancho real para no deformarse)
const Guirnalda = ({ W, u }) => {
  const paso = Math.max(150 * u, 90);
  const n = Math.ceil(W / paso) + 1;
  const caida = Math.max(22 * u, 14);
  let d = 'M0 4';
  const focos = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * paso;
    d += ` Q${f1(x0 + paso / 2)} ${f1(4 + caida * 2)} ${f1(x0 + paso)} 4`;
    [0.25, 0.5, 0.75].forEach((k, j) => {
      const x = x0 + paso * k;
      const y = 4 + caida * 2 * 2 * k * (1 - k); // punto sobre la curva
      focos.push({ x, y, color: COLORES_LUZ[(i * 3 + j) % COLORES_LUZ.length], delay: ((i * 3 + j) % 5) * 0.35 });
    });
  }
  const r = Math.max(5 * u, 3.5);
  return (
    <svg className="bv-lights" width={W} height={caida * 2 + r * 3 + 8} aria-hidden="true">
      <path d={d} className="bv-lights-wire" />
      {focos.map((f, i) => (
        <g key={i} transform={`translate(${f1(f.x)} ${f1(f.y)})`}>
          <rect x={-r * 0.45} y={0} width={r * 0.9} height={r * 0.7} rx={1} fill="#2b3a2f" />
          <ellipse
            className="bv-light"
            cx={0}
            cy={r * 0.7 + r * 1.2}
            rx={r}
            ry={r * 1.3}
            fill={f.color}
            style={{ color: f.color, animationDelay: `${f.delay}s` }}
          />
        </g>
      ))}
    </svg>
  );
};

// Nieve: copos fijos (semilla) con caída CSS; con "Reducir movimiento" quedan quietos
const COPOS = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: 46 }, () => ({
    left: rnd() * 100,
    size: 2 + rnd() * 4,
    dur: 9 + rnd() * 10,
    delay: -rnd() * 19,
    drift: (rnd() - 0.5) * 60,
    op: 0.35 + rnd() * 0.5,
  }));
})();
const Nieve = () => (
  <div className="bv-snow" aria-hidden="true">
    {COPOS.map((c, i) => (
      <i
        key={i}
        style={{
          left: `${c.left}%`,
          width: c.size,
          height: c.size,
          opacity: c.op,
          animationDuration: `${c.dur}s`,
          animationDelay: `${c.delay}s`,
          '--drift': `${c.drift}px`,
        }}
      />
    ))}
  </div>
);

const Bienvenido = ({ onNavigate }) => {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const [layout, setLayout] = useState(() =>
    medirLayout(typeof window !== 'undefined' ? Math.min(window.innerWidth, 2400) : 1440)
  );
  const layoutRef = useRef(layout);
  useLayoutEffect(() => { layoutRef.current = layout; }, [layout]);

  // 🎠 Colección activa (cambia cada 2 vueltas)
  const [activa, setActiva] = useState(0);
  const activaRef = useRef(0);
  useLayoutEffect(() => { activaRef.current = activa; }, [activa]);

  // 👈 Estado de cada colección en refs (el rAF no pasa por React)
  const filas = useRef(FILAS.map(() => ({ scroll: 0, v: 0, dist: 0 })));
  const cards = useRef(FILAS.map(() => []));
  const visible = useRef(true);
  const hover = useRef(false); // 👈 mouse encima del carrusel → va más lento
  const ritmo = useRef(1);
  const drag = useRef({ active: false, moved: false, fila: 0, startX: 0, startScroll: 0, lastX: 0, lastT: 0, id: null });
  const hasMoved = useRef(false);

  const cambiarA = (i) => {
    const st = filas.current[i];
    st.dist = 0;
    st.v = 0;
    setActiva(i);
  };
  const cambiarARef = useRef(cambiarA);
  useLayoutEffect(() => { cambiarARef.current = cambiarA; });

  // 📏 Ancho real de la sección
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const medir = () => {
      const W = el.clientWidth;
      if (W > 0 && Math.abs(W - layoutRef.current.W) > 0.5) setLayout(medirLayout(W));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 💤 No dibujar ni contar vueltas cuando el hero no se ve
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 🃏 Cuántas cards por colección (múltiplo de sus fotos para que el bucle no tenga costura)
  const slotsPorFila = useMemo(
    () => FILAS.map((f) => f.items.length * Math.ceil(layout.slotsNecesarios / f.items.length)),
    [layout.slotsNecesarios]
  );

  // 🔄 Bucle de animación: auto-scroll + inercia + geometría curva + conteo de vueltas
  // (corre también con "Reducir movimiento": decisión del dueño, igual que el menú del Header)
  useEffect(() => {
    let id;
    let last = performance.now();

    const dibujarFila = (fi) => {
      const lista = cards.current[fi];
      const n = lista.length;
      if (!n) return;
      const { W, u, H } = layoutRef.current;
      const cx = W / 2;
      const R = W / 2;
      const pitch = GEO.pitch * u;
      const w0 = GEO.w0 * u;
      const h0 = GEO.h0 * u;
      const arch = GEO.arch * u;
      const r = RADIO * u;
      const imgW = w0 * 0.86;
      const imgH = h0 * 0.62;
      const largo = n * pitch;
      const scroll = filas.current[fi].scroll;

      const edge = (xe) => {
        const q = Math.min(Math.abs(xe - cx) / R, Q_MAX);
        const s = 1 + GROW * Math.pow(q, 2.6);
        const yc = H / 2 + arch / 2 - arch * q * q;
        return { s, top: yc - (h0 * s) / 2, bot: yc + (h0 * s) / 2 };
      };

      for (let i = 0; i < n; i++) {
        const c = lista[i];
        if (!c || !c.el) continue;
        const t = mod(i * pitch - scroll + largo / 2, largo) - largo / 2;
        const x = cx + t * (1 + 0.083 * (t / R) * (t / R));
        const d = Math.min(Math.abs(x - cx) / R, Q_MAX);
        const w = w0 * (1 + 0.28 * d * d);
        const xl = x - w / 2;
        const xr = x + w / 2;

        if (xr < -4 || xl > W + 4) {
          if (c.on) { c.el.style.visibility = 'hidden'; c.on = false; }
          continue;
        }

        const eL = edge(xl);
        const eR = edge(xr);
        const top = Math.min(eL.top, eR.top) - 1;
        const left = xl - 1;

        c.el.style.transform = `translate3d(${f1(left)}px,${f1(top)}px,0)`;
        c.el.style.clipPath = pathQuad(1, eL.top - top, eL.bot - top, w + 1, eR.top - top, eR.bot - top, r);
        if (!c.on) { c.el.style.visibility = 'visible'; c.on = true; }

        const s = (eL.s + eR.s) / 2;
        const ycLocal = (eL.top + eL.bot + eR.top + eR.bot) / 4 - top;
        if (c.img && c.cover) {
          // 👈 foto completa: centrada en la card (la caja es más ancha que la card del centro)
          c.img.style.transform = `translate3d(${f1((w + 2 - (layoutRef.current.wMax + 4)) / 2)}px,0,0)`;
        } else if (c.img) {
          c.img.style.transform = `translate3d(${f1(w / 2 + 1 - imgW / 2)}px,${f1(ycLocal - imgH / 2 - h0 * 0.06 * s)}px,0) scale(${s.toFixed(3)})`;
        }
        if (c.snow) {
          const ang = Math.atan2(eR.top - eL.top, w);
          c.snow.style.transform = `translate3d(1px,${f1(eL.top - top - 1)}px,0) rotate(${ang.toFixed(4)}rad)`;
        }
        if (c.lbl) {
          // 👈 pegado a la esquina inferior izquierda (que sube/baja según la inclinación)
          c.lbl.style.transform = `translate3d(${f1(1 + 11 * u)}px,${f1(eL.bot - top - 11 * u)}px,0) translateY(-100%) scale(${Math.min(s, 1.2).toFixed(3)})`;
        }
      }
    };

    const step = (now) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const { u } = layoutRef.current;
      const fa = activaRef.current;
      // 🐢 Con el mouse encima baja suave a 25% de velocidad (y vuelve suave al salir)
      const objetivo = hover.current ? 0.25 : 1;
      ritmo.current += (objetivo - ritmo.current) * Math.min(dt * 4, 1);

      FILAS.forEach((f, fi) => {
        const st = filas.current[fi];
        if (drag.current.active && drag.current.moved && drag.current.fila === fi) return;
        // 🧈 inercia que se apaga ~95% por segundo, y el auto-scroll sigue debajo
        st.v *= Math.pow(0.05, dt);
        if (Math.abs(st.v) < 1) st.v = 0;
        const delta = (-f.dir * SPEED * u * ritmo.current + st.v) * dt;
        st.scroll += delta;
        if (fi === fa && visible.current) st.dist += Math.abs(delta);
      });

      if (visible.current) {
        // Se dibujan todas las montadas (la que sale sigue moviéndose mientras se desvanece)
        FILAS.forEach((_, fi) => dibujarFila(fi));

        // 🔁 Cada vuelta (una vuelta = pasar todas sus fotos) cambia de colección
        const vuelta = FILAS[fa].items.length * GEO.pitch * u;
        const meta = Math.max(vuelta * VUELTAS_POR_COLECCION - SEGUNDOS_MENOS * SPEED * u, SPEED * u * 8);
        const p = filas.current[fa].dist / meta;
        if (p >= 1 && !(drag.current.active && drag.current.moved)) {
          cambiarARef.current((fa + 1) % FILAS.length);
        }
      }
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, []);

  // 👆 Arrastre (mouse y táctil). touch-action: pan-y deja el scroll vertical al navegador
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const fila = activaRef.current;
    drag.current = {
      active: true,
      moved: false,
      fila,
      startX: e.clientX,
      startScroll: filas.current[fila].scroll,
      lastX: e.clientX,
      lastT: performance.now(),
      id: e.pointerId,
    };
    hasMoved.current = false;
  };

  const handlePointerMove = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      hasMoved.current = true;
      d.startScroll = filas.current[d.fila].scroll + dx; // sin salto al empezar
      filas.current[d.fila].v = 0;
      // Captura solo al arrastrar, para que un toque simple siga siendo click en la card
      try { stageRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    if (!d.moved) return;
    const now = performance.now();
    const dts = Math.max(now - d.lastT, 8) / 1000;
    const st = filas.current[d.fila];
    st.v = Math.max(-4000, Math.min(4000, -(e.clientX - d.lastX) / dts));
    d.lastX = e.clientX;
    d.lastT = now;
    st.scroll = d.startScroll - dx; // 1:1 con el dedo
  };

  const handlePointerUp = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    // Si el dedo se quedó quieto antes de soltar, sin inercia
    if (!d.moved || performance.now() - d.lastT > 80) filas.current[d.fila].v = 0;
    try { stageRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const handleIrAProductos = (categoria = FILTRO_TEMPORADA, busqueda = '') => {
    if (hasMoved.current) return;
    if (onNavigate) onNavigate(categoria, busqueda);
    setTimeout(() => {
      const section =
        document.getElementById('products-section') ||
        document.getElementById('filter-bar') ||
        document.getElementById('catalogo');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const { u, H, centroTop, mobile, wMax } = layout;
  const anim = reduceMotion ? false : 'hidden';
  const boxH = GEO.h0 * u * S_MAX + 4;
  const fila = FILAS[activa];

  return (
    <section
      ref={sectionRef}
      className={`bv-section${mobile ? ' is-mobile' : ''}`}
      style={{ '--u': `${u}px` }}
    >
      {/* 🎄 Fondo navideño: luces arriba y nieve cayendo */}
      <Guirnalda W={layout.W} u={u} />
      <Nieve />

      <motion.div className="bv-copy" variants={grupo} initial={anim} animate="show">
        <h2 className="bv-title">
          <motion.span variants={subeBlur} className="bv-title-line">
            ¡
            <span className="bv-title-hat-wrap">
              <svg className="bv-title-hat" viewBox="0 0 64 56" aria-hidden="true">
                <path d="M8 40C14 18 30 6 50 8C46 16 50 26 56 34Z" fill="#c8102e" />
                <path d="M8 40C14 18 30 6 50 8C40 12 32 22 26 40Z" fill="#a50d26" opacity="0.55" />
                <rect x="2" y="36" width="58" height="13" rx="6.5" fill="#fff" />
                <circle cx="54" cy="36" r="7" fill="#fff" />
              </svg>
              F
            </span>
            eliz{' '}
            <span className="bv-title-mark">
              Navidad!
              <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <motion.path variants={trazo(1)} d="M4 14 C 50 4, 120 4, 196 10" />
              </svg>
            </span>
          </motion.span>
        </h2>

        <motion.p variants={subeBlur} className="bv-subtitle">
          Regalá la camiseta de su equipo.
        </motion.p>

        {/* Colecciones del carrusel (solo texto; la activa resaltada) */}
        <motion.p variants={subeBlur} className="bv-colecciones">
          {FILAS.map((f, i) => (
            <span key={f.key} className={i === activa ? 'is-active' : undefined}>{f.titulo}</span>
          ))}
        </motion.p>

        {/* ✍️ Notas a mano (solo compu) */}
        {!mobile && (
          <>
            <svg className="bv-doodle" viewBox="0 0 60 60" aria-hidden="true">
              <motion.path variants={trazo(1.2)} d="M22 8 L10 40" />
              <motion.path variants={trazo(1.35)} d="M40 14 L28 46" />
            </svg>
            <motion.span variants={nota(1.4, 12)} className="bv-note bv-note--top">
              ¡Ideas para
              <br />
              regalar!
            </motion.span>
            <svg className="bv-arrow-top" viewBox="0 0 160 260" aria-hidden="true">
              <motion.path variants={trazo(1.6)} d="M70 6 C 120 40, 150 110, 118 170 S 40 238, 22 246" />
              <motion.path variants={trazo(2.3)} d="M38 236 L22 246 L39 255" />
            </svg>
          </>
        )}
      </motion.div>

      {/* 🎠 CARRUSEL CURVO (una colección a la vez) */}
      <motion.div
        className="bv-stage-wrap"
        style={{ height: H, marginTop: -(centroTop - (mobile ? 40 : 44) * u) }}
        initial={reduceMotion ? false : { opacity: 0, y: 70 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.45 }}
      >
        <div
          ref={stageRef}
          className="bv-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') hover.current = true; }}
          onPointerLeave={() => { hover.current = false; }}
          onDragStart={(e) => e.preventDefault()}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={fila.key}
              className="bv-stage-set"
              initial={{ opacity: 0, y: 40 * u, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24 * u, scale: 0.98 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              {Array.from({ length: slotsPorFila[activa] }, (_, i) => {
                const fi = activa;
                const item = fila.items[i % fila.items.length];
                return (
                  <div
                    key={`${fila.key}-${i}`}
                    ref={(el) => {
                      const lista = cards.current[fi];
                      if (el) {
                        lista.length = slotsPorFila[fi];
                        lista[i] = {
                          el,
                          img: el.querySelector('img'),
                          lbl: el.querySelector('.bv-card-label'),
                          snow: el.querySelector('.bv-card-snow'),
                          cover: !!fila.cover,
                          on: el.style.visibility === 'visible', // 👈 arranca escondida hasta el primer dibujo
                        };
                      } else {
                        lista[i] = null;
                        if (lista.every((c) => !c)) lista.length = 0;
                      }
                    }}
                    className={`bv-card bv-card--${fila.blend ? (i % 2 === 0 ? 'crema' : 'rosa') : (i % 2 === 0 ? 'rojo' : 'menta')}`}
                    style={{ width: wMax + 4, height: boxH }}
                    onClick={() => handleIrAProductos(item.categoria || fila.categoria, item.busqueda)}
                    aria-hidden="true"
                  >
                    <img
                      src={item.img}
                      alt=""
                      draggable={false}
                      decoding="async"
                      className={`bv-card-img${fila.blend ? ' is-blend' : ''}${fila.cover ? ' is-cover' : ''}`}
                      style={fila.cover ? { width: wMax + 4, height: boxH } : { width: GEO.w0 * u * 0.86, height: GEO.h0 * u * 0.62 }}
                    />
                    <svg className="bv-card-snow" viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true" style={{ width: wMax + 4, height: 20 * u }}>
                      <path d="M0 0H200V10C190 14 184 20 176 17C168 14 166 8 156 11C146 14 144 22 132 20C120 18 122 9 110 10C98 11 98 19 86 18C74 17 76 8 64 9C52 10 52 21 40 20C28 19 30 10 18 11C10 12 6 16 0 14Z" />
                    </svg>
                    <span className="bv-card-label">
                      <i>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </i>
                      {item.nombre}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ⚡ CTA */}
      <motion.div
        className="bv-cta-wrap"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.8 }}
      >

        <div className="bv-cta-row">
          <motion.span
            className="bv-note bv-note--cta"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1, rotate: mobile ? -6 : -14 }}
            transition={{ duration: 0.6, delay: 1.6 }}
          >
            Envío a todo CR
            <svg viewBox="0 0 70 40" aria-hidden="true">
              <motion.path
                d="M4 10 C 24 6, 44 14, 60 28"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: 1.9 }}
              />
              <motion.path
                d="M48 28 L61 29 L58 16"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 2.5 }}
              />
            </svg>
          </motion.span>
          <span className="bv-cta-ring">
            <button type="button" onClick={() => handleIrAProductos(fila.categoria, '')} className="bv-cta">
              {fila.cta || (fila.key === 'lego' ? 'Ver los LEGO' : fila.key === 'retro' ? 'Ver las retro' : 'Ver la colección')}
            </button>
          </span>
        </div>
      </motion.div>
    </section>
  );
};

export default Bienvenido;
