import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// ⚠️ Estilos en index.css (sección "BIENVENIDO", clases bv-*).
// El Tailwind del CDN es 2.2.19: no soporta valores arbitrarios (w-78, p-28, bg-black/90…).

const FILTRO_OBJETIVO = 'Temp 26-27';

const productosNuevos = [
  { id: 1, equipo: 'Real Madrid', busqueda: 'Real Madrid', tipo: 'Casa', img: '/Real1.png' },
  { id: 2, equipo: 'Barcelona', busqueda: 'Barcelona', tipo: 'Casa', img: '/Barcelona1.png' },
  { id: 3, equipo: 'Bayern Múnich', busqueda: 'Bayern', tipo: 'Casa', img: '/Bayern1.png' },
  { id: 4, equipo: 'PSG', busqueda: 'PSG', tipo: 'Casa', img: '/PSG1.png' },
  { id: 5, equipo: 'Real Madrid', busqueda: 'Real Madrid', tipo: 'Visita', img: '/Real2.png' },
  { id: 6, equipo: 'Barcelona', busqueda: 'Barcelona', tipo: 'Visita', img: '/Barcelona2.png' },
  { id: 7, equipo: 'Bayern Múnich', busqueda: 'Bayern', tipo: 'Visita', img: '/Bayern2.png' },
  { id: 8, equipo: 'PSG', busqueda: 'PSG', tipo: 'Visita', img: '/PSG2.png' },
];

/* ============ Animaciones del encabezado ============ */
const headerGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const Bienvenido = ({ onNavigate }) => {
  const reduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef(null);
  const innerRef = useRef(null);
  // 👈 Todo en refs: el carrusel se mueve con transform (sin scroll nativo, que en iPhone se peleaba con el auto-scroll)
  const offset = useRef(0);
  const loopW = useRef(0);
  const velocity = useRef(0);
  const pausedUntil = useRef(0);
  const focusPaused = useRef(false);
  const drag = useRef({ active: false, moved: false, startX: 0, startOffset: 0, lastX: 0, lastT: 0, id: null });
  const hasMoved = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 📏 Ancho de una vuelta (la lista va ×3)
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const medir = () => { loopW.current = inner.scrollWidth / 3; };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // 🔄 Auto-scroll continuo con transform (también con "Reducir movimiento": es lento y se pausa al tocarlo)
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const speed = isMobile ? 0.6 : 0.8;
    let id;
    let last = performance.now();

    const step = (t) => {
      const dt = Math.min(t - last, 50) / 16.67; // normalizado a 60fps
      last = t;
      if (!drag.current.active) {
        if (Math.abs(velocity.current) > 0.05) {
          // 🧈 inercia propia después de soltar
          offset.current += velocity.current * dt;
          velocity.current *= Math.pow(0.94, dt);
        } else if (!focusPaused.current && t > pausedUntil.current) {
          offset.current += speed * dt;
        }
      }
      const L = loopW.current;
      const x = L > 0 ? ((offset.current % L) + L) % L : 0;
      inner.style.transform = `translate3d(${-x}px,0,0)`;
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [isMobile]);

  // 👆 Arrastre (mouse y táctil) con Pointer Events. touch-action: pan-y deja el scroll vertical de la página al navegador
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const L = loopW.current;
    if (L > 0) offset.current = ((offset.current % L) + L) % L;
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startOffset: offset.current,
      lastX: e.clientX,
      lastT: performance.now(),
      id: e.pointerId,
    };
    velocity.current = 0;
    hasMoved.current = false;
  };

  const handlePointerMove = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      hasMoved.current = true;
      // Captura solo al arrastrar, para que un toque simple siga siendo click en la card
      try { trackRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    if (!d.moved) return;
    const now = performance.now();
    const dtf = Math.max(now - d.lastT, 1) / 16.67;
    velocity.current = Math.max(-40, Math.min(40, -(e.clientX - d.lastX) / dtf));
    d.lastX = e.clientX;
    d.lastT = now;
    offset.current = d.startOffset - dx;
  };

  const handlePointerUp = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    // Si el dedo se quedó quieto antes de soltar, sin inercia
    if (!d.moved || performance.now() - d.lastT > 80) velocity.current = 0;
    try { trackRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pausedUntil.current = performance.now() + (e.pointerType === 'mouse' ? 1200 : 1500);
  };

  const handleIrAProductos = (categoria = FILTRO_OBJETIVO, busqueda = '') => {
    if (hasMoved.current) return;

    if (onNavigate) {
      onNavigate(categoria, busqueda);
    }
    setTimeout(() => {
      const section =
        document.getElementById('products-section') ||
        document.getElementById('filter-bar') ||
        document.getElementById('catalogo');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const marqueeItems = [...productosNuevos, ...productosNuevos, ...productosNuevos];

  return (
    <section className="bv-section">
      {/* Fondo: textura muy sutil + luces roja y verde */}
      <div
        className="bv-texture"
        style={{ backgroundImage: `url(${isMobile ? '/FondoMovil.png' : '/FondoDes.png'})` }}
        aria-hidden="true"
      />
      <div className="bv-glow" aria-hidden="true" />

      {/* 🏆 ENCABEZADO */}
      <motion.div
        className="bv-header"
        variants={headerGroup}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        <motion.span variants={fadeUp} className="bv-eyebrow">
          <i className="bv-eyebrow-dot" />
          Recién llegadas
        </motion.span>
        <motion.h2 variants={fadeUp} className="bv-title">
          Nueva temporada <span className="bv-title-accent">26/27</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="bv-subtitle">
          Las camisetas de los grandes de Europa ya están en tienda.
        </motion.p>
      </motion.div>

      {/* 🚀 CARRUSEL */}
      <motion.div
        className="bv-track-wrap"
        initial={reduceMotion ? false : { opacity: 0, x: 60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onFocusCapture={() => { focusPaused.current = true; }}
          onBlurCapture={() => { focusPaused.current = false; }}
          onDragStart={(e) => e.preventDefault()}
          className="bv-track"
        >
          <div ref={innerRef} className="bv-track-inner">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              role="button"
              tabIndex={0}
              aria-label={`Ver camisetas ${item.equipo} ${item.tipo}`}
              onClick={() => handleIrAProductos(FILTRO_OBJETIVO, item.busqueda)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleIrAProductos(FILTRO_OBJETIVO, item.busqueda);
                }
              }}
              className={`bv-card ${index % 2 === 0 ? 'bv-card--red' : 'bv-card--green'}`}
            >
              <div className="bv-card-top">
                <span className="bv-tag">Temp 26/27</span>
                <span className="bv-kit">{item.tipo}</span>
              </div>

              <div className="bv-jersey">
                <span className="bv-watermark" aria-hidden="true">26</span>
                <span className="bv-spot" aria-hidden="true" />
                <img
                  src={item.img}
                  alt={`Camiseta ${item.equipo} ${item.tipo} 26-27`}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="bv-img"
                  style={{ animationDelay: `${(index % 4) * -1}s` }}
                />
              </div>

              <div className="bv-card-bottom">
                <div className="bv-team">
                  <h3>{item.equipo}</h3>
                  <span>Ver colección</span>
                </div>
                <span className="bv-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
          </div>
        </div>
      </motion.div>

      {/* ⚡ CTA GENERAL */}
      <motion.div
        className="bv-cta-wrap"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <button type="button" onClick={() => handleIrAProductos(FILTRO_OBJETIVO, '')} className="bv-cta">
          <span>Ver toda la colección</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </motion.div>
    </section>
  );
};

export default Bienvenido;
