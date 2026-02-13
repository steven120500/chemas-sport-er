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
      id: 'balones',      
      label: 'BALONES',
      buttonText: 'Ver Balones',
      img: '/Bola.png',      
      filter: 'Balones'
    },
  ];

  useEffect(() => {
    // Ciclo de 6 segundos en total
    const interval = setInterval(() => {
      setAnimating(true); // 1. Inicia transición (Sale Camiseta, Entra Logo)
      
      // Le damos 1.5 segundos al logo para lucirse suavemente
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % categories.length); // 2. Cambia datos
        setAnimating(false); // 3. Termina transición (Sale Logo, Entra Nueva Camiseta)
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
      className="relative w-full  h-[100vh] md:h-[110vh] bg-cover bg-center bg-no-repeat overflow-hidden flex flex-col justify-center items-center font-sans mb-30 pb-10 sm:pb-40"
      style={{
        backgroundImage: `url(${window.innerWidth < 768 ? '/FondoMovil.jpg' : '/FondoCompu.jpg'})`
      }}
    >
      
      <div className="absolute inset-0 -z-10 bg-[url('/FondoMovil.jpg')] md:bg-[url('/FondoCompu.jpg')] bg-cover bg-center"></div>
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-10 flex-grow flex flex-col justify-center items-center w-full max-w-4xl px-4 mt-10 md:mt-0">
        
        {/* =======================================================
            1. LOGO ANIMADO (Transición Suave)
           ======================================================= */}
        <div className={`
          absolute z-20 flex justify-center items-center
          /* duration-1000 hace que tarde 1 segundo en aparecer/desaparecer (muy suave) */
          transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${animating 
            ? 'opacity-100 scale-110 rotate-0'   // Al aparecer: Tamaño normal, sin rotación
            : 'opacity-0 scale-50 -rotate-12'}   // Al desaparecer: Se encoge y gira un poquito
        `}>
          <img 
            src="/logo.png" 
            alt="ChemaSport Logo"
            className="w-32 md:w-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          />
        </div>

        {/* =======================================================
            2. CAMISETA + BOTÓN
           ======================================================= */}
        <div className={`
            relative w-full flex justify-center items-center
            transition-all duration-1000 ease-in-out transform
            ${animating ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'}
        `}>
          
          <img 
            src={currentCat.img} 
            alt={currentCat.label}
            className={`
              object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.8)]
              ${currentCat.id === 'balones' ? 'w-[70%] md:w-[450px]' : 'w-[90%] md:w-[600px]'}
              h-auto
            `}
          />
          
          {/* BOTÓN FLOTANTE */}
          <button
            onClick={() => handleFilter(currentCat.filter)}
            className="
              absolute 
              /* MÓVIL */
              bottom-0 right-2 
              
              /* PC: Acercado más a la camiseta (right-4) */
              md:bottom-20 md:right-4 
              
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

    </div>
  );
};

export default Bienvenido;