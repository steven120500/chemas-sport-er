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
  const scrollRef = useRef(null);
  const scrollPos = useRef(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasMoved = useRef(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🔄 Auto-scroll continuo (también con "Reducir movimiento" activado: es lento y se pausa al tocarlo)
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    scrollPos.current = scrollContainer.scrollLeft;
    const speed = isMobile ? 0.6 : 0.8;

    let id;
    const step = () => {
      if (!isInteracting && !isDragging.current && scrollContainer) {
        scrollPos.current += speed;

        const maxScroll = scrollContainer.scrollWidth / 3;
        if (maxScroll > 0) {
          if (scrollPos.current >= maxScroll * 2) {
            scrollPos.current -= maxScroll;
          } else if (scrollPos.current <= 0) {
            scrollPos.current += maxScroll;
          }
        }
        scrollContainer.scrollLeft = scrollPos.current;
      } else if (scrollContainer) {
        scrollPos.current = scrollContainer.scrollLeft;
      }
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [isInteracting, isMobile]);

  // 🖱️ Arrastre con mouse (desktop)
  const handleMouseDown = (e) => {
    isDragging.current = true;
    hasMoved.current = false;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftStart.current = scrollRef.current.scrollLeft;
    setIsInteracting(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.4;
    if (Math.abs(x - startX.current) > 5) {
      hasMoved.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStart.current - walk;
    scrollPos.current = scrollRef.current.scrollLeft;

    const maxScroll = scrollRef.current.scrollWidth / 3;
    if (maxScroll > 0) {
      if (scrollRef.current.scrollLeft >= maxScroll * 2) {
        scrollRef.current.scrollLeft -= maxScroll;
        scrollLeftStart.current -= maxScroll;
        scrollPos.current -= maxScroll;
      } else if (scrollRef.current.scrollLeft <= 0) {
        scrollRef.current.scrollLeft += maxScroll;
        scrollLeftStart.current += maxScroll;
        scrollPos.current += maxScroll;
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
    setTimeout(() => setIsInteracting(false), 1200);
  };

  // 📱 Táctil
  const handleTouchStart = () => {
    setIsInteracting(true);
  };

  const handleTouchEnd = () => {
    if (scrollRef.current) {
      scrollPos.current = scrollRef.current.scrollLeft;
    }
    setTimeout(() => setIsInteracting(false), 1500);
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
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="bv-track"
        >
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
