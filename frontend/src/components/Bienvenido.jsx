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
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % categories.length);
        setAnimating(false);
      }, 500);
    }, 5000);

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
      // CAMBIO 1: Altura "min-h-[105vh]" para que sea más largo y "pb-20" para espacio abajo
      className="relative w-full h-sreen bg-cover bg-center bg-no-repeat overflow-hidden flex flex-col justify-center items-center font-sans pb-40"
      style={{
        backgroundImage: `url(${window.innerWidth < 768 ? '/FondoMovil.jpg' : '/FondoCompu.jpg'})`
      }}
    >
      
      {/* Fondo estático para asegurar responsive */}
      <div className="absolute inset-0 -z-10 bg-[url('/FondoMovil.jpg')] md:bg-[url('/FondoCompu.jpg')] bg-cover bg-center"></div>
      
      {/* Sombra oscura general */}
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-0 flex-grow flex flex-col justify-center items-center w-full max-w-4xl px-4">
        
        {/* Contenedor Camiseta + Botón */}
        <div className={`
            relative w-full flex justify-center items-center
            transition-all duration-500 ease-in-out transform
            ${animating ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}
        `}>
          
          {/* CAMISETA */}
          <img 
            src={currentCat.img} 
            alt={currentCat.label}
            className="w-[90%] md:w-[600px] h-auto object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.8)]"
          />
          
          {/* CAMBIO 2: POSICIÓN DEL BOTÓN 
             - Mobile: bottom-0 right-4 (Esquina inferior derecha de la imagen)
             - PC: md:bottom-20 md:-right-10 (Flotando al costado derecho, fuera de la camiseta)
          */}
          <button
            onClick={() => handleFilter(currentCat.filter)}
            className="
              absolute 
              bottom-0  
              md:bottom-20  
              bg-black text-white 
              px-8 py-3 md:px-10 md:py-4 
              rounded-full font-bold text-lg md:text-xl 
              shadow-[0_10px_30px_rgba(0,0,0,0.5)] 
              border border-white/10
              hover:bg-zinc-900 hover:scale-105 hover:shadow-[0_10px_40px_rgba(255,255,255,0.2)] 
              transition-all duration-300
            "
          >
            {currentCat.buttonText}
          </button>
        </div>

      </div>

      {/* Indicadores de página (Puntitos) - Opcional, los dejé por si quieres navegación visual sutil */}
      <div className="absolute bottom-10 flex gap-3 z-20">
        {categories.map((_, index) => (
          <div 
            key={index}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              index === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'
            }`}
          ></div>
        ))}
      </div>
    
    </div>
  );
};

export default Bienvenido;