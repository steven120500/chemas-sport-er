import React, { useState, useEffect } from 'react';

const productosNuevos = [
  { id: 1, equipo: 'Real Madrid', tipo: 'Casa', img: '/Real1.png' },
  { id: 2, equipo: 'Barcelona', tipo: 'Casa', img: '/Barcelona1.png' },
  { id: 3, equipo: 'Bayern Múnich', tipo: 'Casa', img: '/Bayern1.png' },
  { id: 4, equipo: 'PSG', tipo: 'Casa', img: '/PSG1.png' },
  { id: 5, equipo: 'Real Madrid', tipo: 'Visita', img: '/Real2.png' },
  { id: 6, equipo: 'Barcelona', tipo: 'Visita', img: '/Barcelona2.png' },
  { id: 7, equipo: 'Bayern Múnich', tipo: 'Visita', img: '/Bayern2.png' },
  { id: 8, equipo: 'PSG', tipo: 'Visita', img: '/PSG2.png' },
];

const FILTRO_OBJETIVO = 'Temp 26-27'; // 🎯 Exactamente el nombre de tu filtro

const Bienvenido = ({ onNavigate }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleIrAProductos = (categoria = FILTRO_OBJETIVO) => {
    if (onNavigate) onNavigate(categoria);
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

  const marqueeItems = [...productosNuevos, ...productosNuevos];

  return (
    <section
      className="relative w-full overflow-hidden flex flex-col justify-center items-center font-sans py-4 md:py-8 gap-3 md:gap-5 text-white select-none"
    >
      {/* 🔮 Animaciones CSS */}
      <style>{`
        @keyframes infiniteScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes floatItem {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .anim-marquee {
          display: flex;
          width: max-content;
          animation: infiniteScroll 30s linear infinite;
        }
        .anim-marquee:hover {
          animation-play-state: paused;
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
      <div className="relative z-20 flex flex-col items-center text-center px-4 max-w-4xl mx-auto mb-1 md:mb-2">
        <h1 className="text-2xl md:text-5xl font-black uppercase tracking-tight text-white drop-shadow-2xl">
          NUEVA TEMPORADA 26-27
        </h1>
      </div>

      {/* 🚀 CARRUSEL INFINITO (Al tocar cualquier camiseta también filtra por Temp 26-27) */}
      <div className="relative z-20 w-full overflow-hidden py-1 md:py-2">
        <div className="absolute top-0 left-0 bottom-0 w-12 md:w-36 bg-gradient-to-r from-black via-black/80 to-transparent z-30 pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 w-12 md:w-36 bg-gradient-to-l from-black via-black/80 to-transparent z-30 pointer-events-none" />

        <div className="anim-marquee gap-4 md:gap-7 px-4">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              onClick={() => handleIrAProductos(FILTRO_OBJETIVO)}
              className="group relative cursor-pointer w-56 md:w-72 lg:w-80 bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-xl border border-white/15 hover:border-white/40 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col justify-between transition-all duration-300 hover:scale-105 hover:-translate-y-1.5 shrink-0"
            >
              <div className="absolute inset-0 bg-white/5 rounded-3xl blur-xl group-hover:bg-white/10 transition-all pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-[10px] md:text-xs font-extrabold tracking-[0.3em] text-white uppercase">
                  TEMP 26-27
                </span>
              </div>

              <div className="relative z-10 flex items-center justify-center my-2 md:my-4 h-36 md:h-48 lg:h-52">
                <img
                  src={item.img}
                  alt={`${item.equipo} ${item.tipo}`}
                  className="anim-float max-h-full w-auto object-contain drop-shadow-[0_18px_25px_rgba(0,0,0,0.95)] transition-transform duration-300 group-hover:scale-110"
                />
              </div>

              <div className="relative z-10 mt-1 border-t border-white/10 pt-2.5 md:pt-3 text-center">
                <h3 className="text-sm md:text-base font-black uppercase text-white tracking-wide group-hover:text-amber-300 transition-colors truncate">
                  {item.equipo}
                </h3>
                <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                  {item.tipo}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ⚡ BOTÓN PRINCIPAL: ENVÍA 'Temp 26-27' */}
      <div className="relative z-20 flex flex-col items-center w-full mt-1 md:mt-2">
        <button
          onClick={() => handleIrAProductos(FILTRO_OBJETIVO)}
          className="group px-8 py-3 md:px-12 md:py-3.5 rounded-full bg-white text-black font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-300 hover:scale-105 hover:bg-gray-100 shadow-[0_10px_30px_rgba(255,255,255,0.25)] flex items-center gap-3 cursor-pointer"
        >
          <span>VER COLECCIÓN</span>
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>

    </section>
  );
};

export default Bienvenido;