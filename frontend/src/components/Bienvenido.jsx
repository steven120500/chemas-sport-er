import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const categories = [
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
      id: 'balon', // Corregido: sin tilde para coincidir con la lógica
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

  return (
    <div 
      className="relative w-full h-[75vh] md:h-[85vh] bg-cover bg-center bg-no-repeat overflow-hidden flex flex-col justify-center items-center font-sans pb-16"
      style={{
        backgroundImage: `url(${window.innerWidth < 768 ? '/FondoMovil.jpg' : '/FondoCompu.jpg'})`
      }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-4xl px-4">
        
        {/* 1. LOGO ANIMADO (Fijo al centro) */}
        <div className={`
          absolute flex justify-center items-center pointer-events-none
          transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${animating ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}
        `}>
          <img 
            src="/logo.png" 
            alt="Logo"
            className="w-32 md:w-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          />
        </div>

        {/* 2. CONTENEDOR FIJO DE IMAGEN + BOTÓN */}
        <div className={`
            relative flex justify-center items-center
            transition-all duration-1000 ease-in-out
            /* Mantenemos una altura mínima fija para que nada salte al cambiar de imagen */
            h-[45vh] md:h-[60vh] w-full
            ${animating ? 'opacity-0 blur-xl scale-95' : 'opacity-100 blur-0 scale-100'}
        `}>
          
          {/* Imagen con tamaño controlado */}
          <div className="flex justify-center items-center w-full h-full">
            <img 
              src={currentCat.img} 
              alt={currentCat.label}
              className={`
                object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.8)]
                transition-all duration-500
                /* Tamaños estrictos para evitar saltos */
                ${currentCat.id === 'balon' 
                    ? 'h-[60%] md:h-[75%]' 
                    : 'h-full w-auto'
                }
              `}
            />
          </div>
          
          {/* BOTÓN FLOTANTE (Posicionamiento fijo relativo al contenedor) */}
          <button
            onClick={() => handleFilter(currentCat.filter)}
            className="
              absolute 
              bottom-0 right-0 md:right-10
              bg-black text-white 
              px-6 py-2 md:px-10 md:py-4 
              rounded-full font-bold text-lg md:text-xl 
              shadow-2xl border border-white/10
              hover:bg-zinc-900 hover:scale-105 transition-all duration-300
              whitespace-nowrap z-20
            "
          >
            {currentCat.buttonText}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Bienvenido;