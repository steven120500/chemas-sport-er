
import React, { useState, useEffect, useRef } from 'react';

const FILTRO_OBJETIVO = 'Temp 26-27';

const productosNuevos = [
  {
    id: 1,
    equipo: 'Real Madrid',
    busqueda: 'Real Madrid',
    tipo: 'Casa',
    img: '/Real1.png',
  },
  {
    id: 2,
    equipo: 'Barcelona',
    busqueda: 'Barcelona',
    tipo: 'Casa',
    img: '/Barcelona1.png',
  },
  {
    id: 3,
    equipo: 'Bayern Múnich',
    busqueda: 'Bayern',
    tipo: 'Casa',
    img: '/Bayern1.png',
  },
  {
    id: 4,
    equipo: 'PSG',
    busqueda: 'PSG',
    tipo: 'Casa',
    img: '/PSG1.png',
  },
  {
    id: 5,
    equipo: 'Real Madrid',
    busqueda: 'Real Madrid',
    tipo: 'Visita',
    img: '/Real2.png',
  },
  {
    id: 6,
    equipo: 'Barcelona',
    busqueda: 'Barcelona',
    tipo: 'Visita',
    img: '/Barcelona2.png',
  },
  {
    id: 7,
    equipo: 'Bayern Múnich',
    busqueda: 'Bayern',
    tipo: 'Visita',
    img: '/Bayern2.png',
  },
  {
    id: 8,
    equipo: 'PSG',
    busqueda: 'PSG',
    tipo: 'Visita',
    img: '/PSG2.png',
  },
];

const Bienvenido = ({ onNavigate }) => {
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef(null);
  const scrollPos = useRef(0); // 👈 Acumulador de precisión decimal para celulares
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

  // 🔄 Auto-scroll continuo garantizado para PC y Celulares
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    scrollPos.current = scrollContainer.scrollLeft;
    const speed = isMobile ? 0.9 : 1.1;

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
        // Mantiene sincronizada la posición mientras el usuario toca o arrastra
        scrollPos.current = scrollContainer.scrollLeft;
      }
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [isInteracting, isMobile]);

  // 🖱️ Control de arrastre con Mouse (Desktop)
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

  // 📱 Control táctil para Celular
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
    <section
      className="relative w-full overflow-hidden flex flex-col justify-center items-center font-sans py-4 md:py-8 gap-3 md:gap-5 text-white select-none"
    >
      {/* 🔮 Animación de flotación */}
      <style>{`
        @keyframes floatItem {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .anim-float {
          animation: floatItem 4s ease-in-out infinite;
        }
      `}</style>

      {/* 🖼️ FONDO OSCURO */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none transition-all duration-700 scale-105"
        style={{
          backgroundImage: `url(${isMobile ? '/FondoMovil.png' : '/FondoDes.png'})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/75 to-black/95 z-10 pointer-events-none" />

      {/* 🏆 ENCABEZADO */}
      <div className="relative z-20 flex flex-col items-center text-center px-4 max-w-4xl mx-auto mb-1 md:mb-2 pointer-events-none">
        <h1 className="text-2xl md:text-5xl font-black uppercase tracking-tight text-white drop-shadow-2xl">
          NUEVA TEMPORADA 26-27
        </h1>
      </div>

      {/* 🚀 CINTA DESLIZABLE */}
      <div className="relative z-20 w-full overflow-hidden py-2 md:py-4">
        <div className="absolute top-0 left-0 bottom-0 w-12 md:w-36 bg-gradient-to-r from-black via-black/80 to-transparent z-30 pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 w-12 md:w-36 bg-gradient-to-l from-black via-black/80 to-transparent z-30 pointer-events-none" />

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex gap-6 md:gap-8 px-6 overflow-x-auto cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-2"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {marqueeItems.map((item, index) => {
            const isPSG = item.equipo === 'PSG';

            return (
              <div
                key={`${item.id}-${index}`}
                className={`group relative bg-black hover:bg-gray-600 backdrop-blur-xl border border-white/15 hover:border-gray-600 rounded-3xl shadow-2xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1.5 shrink-0 select-none ${
                  isPSG
                    ? "w-100 sm:w-80 md:w-80 lg:w-96 p-10 md:p-36"
                    : "w-78 sm:w-50 md:w-50 lg:w-78 p-6 md:p-28"
                }`}
              >
                <div className="absolute inset-0 bg-white/5 rounded-3xl blur-xl group-hover:bg-white/10 transition-all pointer-events-none" />

                {/* Tag superior */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="text-xs font-extrabold tracking-[0.25em] text-white uppercase whitespace-nowrap">
                    TEMP 26-27
                  </span>
                </div>

                {/* Camiseta */}
                <div className="relative z-10 flex items-center justify-center my-4 md:my-6 h-48 sm:h-56 md:h-64 pointer-events-none overflow-visible">
                  <div 
                    style={{
                      transform: isPSG
                        ? (isMobile ? 'scale(1.45)' : 'scale(2.00)')
                        : (isMobile ? 'scale(1.00)' : 'scale(1.10)')
                    }}
                    className="flex items-center justify-center h-full w-full transition-transform duration-300"
                  >
                    <img
                      src={item.img}
                      alt={`${item.equipo} ${item.tipo}`}
                      draggable={false}
                      className="anim-float max-h-full w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.95)] select-none"
                    />
                  </div>
                </div>

                {/* Nombre, tipo y botón */}
                <div className="relative z-10 mt-2 border-t border-white/10 pt-3 md:pt-4 text-center">
                  <h3 className="text-base md:text-lg font-black uppercase text-white tracking-wide group-hover:text-amber-300 transition-colors truncate pointer-events-none">
                    {item.equipo}
                  </h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-0.5 pointer-events-none">
                    {item.tipo}
                  </p>

                  <button
                    onClick={() => handleIrAProductos(FILTRO_OBJETIVO, item.busqueda)}
                    className="mt-3.5 w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white text-white hover:text-black font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border border-white/20 hover:border-white shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <span>Ver {item.equipo}</span>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚡ BOTÓN INFERIOR GENERAL */}
      <div className="relative z-20 flex flex-col items-center w-full mt-2 md:mt-3">
        <button
          onClick={() => handleIrAProductos(FILTRO_OBJETIVO, '')}
          className="group px-8 py-3.5 md:px-12 md:py-4 rounded-full bg-white text-black font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-300 hover:scale-105 hover:bg-gray-100 shadow-[0_10px_30px_rgba(255,255,255,0.25)] flex items-center gap-3 cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <span>VER TODA LA COLECCIÓN</span>
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>

    </section>
  );
};

export default Bienvenido;