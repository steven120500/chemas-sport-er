import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOfertas = () => {
    if (onNavigate) onNavigate('Ofertas'); 
    setTimeout(() => {
      const section = document.getElementById('products-section') || document.getElementById('filter-bar');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div 
      className="relative w-full md:h-[85vh] md:min-h-[600px] overflow-hidden flex flex-col justify-between items-center font-sans py-4 md:py-12"
      style={{
        minHeight: isMobile ? '500px' : 'max(65vh, 600px)'
      }}
    >
      
      <style>
        {`
          @keyframes cardEntrance {
            0% { opacity: 0; transform: translateY(25px) scale(0.95); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-card-1 { animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.1s; opacity: 0; }
          .animate-card-2 { animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.22s; opacity: 0; }
          .animate-card-3 { animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.34s; opacity: 0; }
          
          @keyframes btnEntrance {
            0% { opacity: 0; transform: translateY(15px) scale(0.95); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-btn-enter { animation: btnEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.45s; opacity: 0; }
        `}
      </style>

      {/* 🖼️ CAPA BASE: Fondo dinámico */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${isMobile ? '/FondoMovil.png' : '/FondoDes.png'})` }}
      ></div>
      
      {/* Capa de oscurecimiento */}
      <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none"></div>

      {/* --- CONTENEDOR DE LAS 3 OFERTAS --- */}
      <div className="relative z-20 flex flex-col md:flex-row items-stretch md:items-center justify-around w-full max-w-6xl px-4 md:px-8 flex-grow my-auto gap-3.5 md:gap-6 py-2">
        
        {/* ==================== OFERTA 1 (1 CAMISETA) ==================== */}
        <div className="animate-card-1 w-full max-w-sm mx-auto md:max-w-none md:w-1/3 bg-black/60 md:bg-transparent border border-white/20 md:border-none rounded-2xl px-5 py-3 md:p-4 shadow-xl overflow-hidden flex flex-row md:flex-col items-center justify-between">
          
          <div className="flex items-center justify-start md:justify-center w-36 md:w-56 h-20 md:h-48 relative">
            <img 
              src="/Mundial.png" 
              className="w-20 md:w-52 h-auto object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.95)]" 
              alt="1 Camiseta"
            />
          </div>

          <div className="flex flex-col items-end md:items-center justify-center md:mt-6 text-right md:text-center">
            <span className="text-gray-300 font-bold text-xs md:text-xl uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              1 POR
            </span>
            <span className="font-black text-white tracking-tighter text-2xl md:text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] leading-none mt-1">
              ₡15.000
            </span>
          </div>

        </div>

        {/* ==================== OFERTA 2 (2 CAMISETAS) ==================== */}
        <div className="animate-card-2 w-full max-w-sm mx-auto md:max-w-none md:w-1/3 bg-black/60 md:bg-transparent border border-white/20 md:border-none rounded-2xl px-5 py-3 md:p-4 shadow-xl overflow-hidden flex flex-row md:flex-col items-center justify-between">
          
          <div className="flex items-center justify-start md:justify-center w-40 md:w-64 h-20 md:h-48 relative">
            <img 
              src="/Mundial.png" 
              className="w-20 md:w-44 h-auto object-contain z-20 drop-shadow-[0_15px_25px_rgba(0,0,0,0.95)]" 
              alt="Camiseta 1"
            />
            <img 
              src="/Fan2.png" 
              className="w-20 md:w-44 h-auto object-contain -ml-10 md:-ml-16 z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] scale-95 transform translate-y-1" 
              alt="Camiseta 2"
            />
          </div>

          <div className="flex flex-col items-end md:items-center justify-center md:mt-6 text-right md:text-center">
            <span className="text-gray-300 font-bold text-xs md:text-xl uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              2 POR
            </span>
            <span className="font-black text-white tracking-tighter text-2xl md:text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] leading-none mt-1">
              ₡27.000
            </span>
          </div>

        </div>

        {/* ==================== OFERTA 3 (3 CAMISETAS) ==================== */}
        <div className="animate-card-3 w-full max-w-sm mx-auto md:max-w-none md:w-1/3 bg-black/60 md:bg-transparent border border-white/20 md:border-none rounded-2xl px-5 py-3 md:p-4 shadow-xl overflow-hidden flex flex-row md:flex-col items-center justify-between">
          
          <div className="flex items-center justify-start md:justify-center w-40 md:w-72 h-20 md:h-48 relative">
            <img 
              src="/Mundial.png" 
              className="w-16 md:w-40 h-auto object-contain z-30 drop-shadow-[0_15px_25px_rgba(0,0,0,0.95)]" 
              alt="Camiseta 1"
            />
            <img 
              src="/Fan2.png" 
              className="w-16 md:w-40 h-auto object-contain -ml-8 md:-ml-16 z-20 drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] scale-95 transform -translate-y-1" 
              alt="Camiseta 2"
            />
            <img 
              src="/Player2.png" 
              className="w-16 md:w-40 h-auto object-contain -ml-8 md:-ml-16 z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.7)] scale-90 transform translate-y-1" 
              alt="Camiseta 3"
            />
          </div>

          <div className="flex flex-col items-end md:items-center justify-center md:mt-6 text-right md:text-center">
            <span className="text-gray-300 font-bold text-xs md:text-xl uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              3 POR
            </span>
            <span className="font-black text-white tracking-tighter text-2xl md:text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] leading-none mt-1">
              ₡35.000
            </span>
          </div>

        </div>

      </div>
      
      {/* --- BOTÓN CENTRADO INFERIOR --- */}
      <div className="relative z-30 mt-2 md:mt-4 flex flex-col items-center w-full px-4 animate-btn-enter">
        <button
          onClick={handleOfertas}
          className="bg-white text-gray-950 border-2 border-gray-100 px-8 py-3 md:px-16 md:py-6 rounded-full font-black text-sm md:text-2xl transition-all duration-300 hover:scale-105 hover:bg-gray-50 uppercase tracking-wider shadow-[0_15px_35px_rgba(0,0,0,0.9)] flex items-center justify-center min-w-[240px] md:min-w-[400px] h-12 md:h-20 cursor-pointer select-none active:scale-95"
        >
          <span className="flex items-center gap-2 md:gap-3 text-black font-extrabold tracking-widest">
            <span>VER OFERTAS</span>
            <svg 
              className="w-4 h-4 md:w-6 md:h-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </button>
      </div>

    </div>
  );
};

export default Bienvenido;