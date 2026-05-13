import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const categories = [
    { 
      id: 'mundial', 
      label: 'MUNDIAL 2026', 
      buttonText: 'Mundial',
      img: '/Mundial.png', 
      filter: 'Mundial 2026'
    },
    { 
      id: 'nacional', 
      label: 'NACIONAL', 
      buttonText: 'Ver Nacional',
      img: '/Nacional.png', 
      filter: 'Nacional'
    },
    { 
      id: 'populares',   
      label: 'POPULARES',
      buttonText: 'Ver Populares',
      img: '/Player2.png',   
      filter: 'Populares'
    },
    { 
      id: 'retro',    
      label: 'RETRO',
      buttonText: 'Ver Retro',
      img: '/Retro.png',    
      filter: 'Retro'
    },
    { 
      id: 'nuevo',      
      label: 'LO NUEVO',
      buttonText: 'Ver Lo Nuevo',
      img: '/Fan.png',      
      filter: 'Nuevo'
    },
    { 
      id: 'balon',      
      label: 'BALÓN',
      buttonText: 'Ver Balones',
      img: '/Bola.png',      
      filter: 'Balón'
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % categories.length);
        setAnimating(false);
      }, 1500); 
    }, 6000); 

    return () => clearInterval(interval);
  }, [categories.length]);

  const handleFilter = (category) => {
    if (onNavigate) onNavigate(category);
    setTimeout(() => {
      const section = document.getElementById('products-section') || document.getElementById('filter-bar');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }; 
  
  const currentCat = categories[currentIndex];
  const isMundial = currentCat.filter === 'Mundial 2026';

  return (
    <div 
      className="relative w-full h-[75vh] md:h-[85vh] bg-cover bg-center bg-no-repeat overflow-hidden flex flex-col justify-center items-center font-sans pb-16"
      style={{
        backgroundImage: `url(${window.innerWidth < 768 ? '/FondoMovil.png' : '/FondoCompu.png'})`
      }}
    >
      {/* 🔥 AQUÍ ESTÁ EL CÓDIGO QUE FALTABA PARA DARLE COLOR AL BOTÓN 🔥 */}
      <style>
        {`
          @keyframes btnColorCycle {
            0%, 20%  { background-color: #0a9434; box-shadow: 0 0 20px rgba(10, 148, 52, 0.6); border-color: #0a9434; } /* Verde */
            33%, 53% { background-color: #7b1f09; box-shadow: 0 0 20px rgba(123, 31, 9, 0.6); border-color: #7b1f09; } /* Rojo Oscuro */
            66%, 86% { background-color: #0e77c8; box-shadow: 0 0 20px rgba(14, 119, 200, 0.6); border-color: #0e77c8; } /* Azul Celeste */
            100%     { background-color: #0a9434; box-shadow: 0 0 20px rgba(10, 148, 52, 0.6); border-color: #0a9434; }
          }
          .animate-btn-colors {
            animation: btnColorCycle 12s ease-in-out infinite;
          }
        `}
      </style>

      {/* CAPA OSCURA */}
      <div className="absolute inset-0 bg-black/40 md:bg-black/65 z-0"></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-0 flex-grow flex flex-col justify-center items-center w-full max-w-4xl px-4 mt-10 md:mt-0">
        
        {/* 1. LOGO ANIMADO */}
        <div className={`
          absolute z-0 flex justify-center items-center
          transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${animating ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}
        `}>
          <img src="/logo.png" alt="Logo" className="w-32 md:w-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]" />
        </div>

        {/* 2. AREA DE IMAGEN */}
        <div className={`
            relative w-full flex justify-center items-center
            h-[320px] md:h-[600px]
            transition-all duration-1000 ease-in-out transform
            ${animating ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'}
        `}>
          
          {isMundial ? (
            <div className="relative flex justify-center items-center w-full h-full">
              <img 
                src={currentCat.img} 
                className="relative z-20 w-40 md:w-96 object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.8)] h-auto" 
                alt="mundial-central"
              />
            </div>
          ) : (
            <img 
              src={currentCat.img} 
              alt={currentCat.label}
              className={`
                relative z-20 object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.8)]
                ${currentCat.filter === 'Balón' ? 'w-24 md:w-80' : 'w-40 md:w-96'}
                h-auto
              `}
            />
          )}
          
          {/* BOTÓN FLOTANTE CON COLORES ANIMADOS */}
          <button
            onClick={() => handleFilter(currentCat.filter)}
            className={`
              absolute z-30
              bottom-0 right-2 
              md:bottom-20 md:right-4 
              px-7 py-2.5 md:px-11 md:py-4 
              rounded-full font-black text-lg md:text-xl 
              transition-all duration-300 hover:scale-105
              ${isMundial 
                ? 'animate-btn-colors text-white border-2' 
                : 'bg-black text-white border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
              }
            `}
          >
            {currentCat.buttonText}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Bienvenido;