import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  // Estado para controlar el cambio de imágenes (Imagen 1 vs Imagen 2)
  const [showSecondary, setShowSecondary] = useState(false);

  // Efecto: Cambia las imágenes automáticamente cada 4 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setShowSecondary(prev => !prev);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);
  
  // Manejador de navegación y scroll suave
  const handleFilter = (category) => {
    if (onNavigate) onNavigate(category);
    // Pequeño delay para asegurar que la App recibe el cambio antes de bajar
    setTimeout(() => {
      const section = document.getElementById('products-section') || document.getElementById('filter-bar');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // =====================================================================
  // CONFIGURACIÓN DE CATEGORÍAS
  // =====================================================================
  const categories = [
    { 
      id: 'nacional', 
      label: 'NACIONAL', 
      img1: '/Nacional.png', 
      img2: '/Nacional2.png', 
      filter: 'Nacional', 
      delay: 'delay-100',
      size: 'p-16 md:p-24' // Tamaño GRANDE
    },
    { 
      id: 'populares',   
      label: 'POPULARES', // Etiqueta comercial
      img1: '/Player.png', 
      img2: '/Player2.png',   
      filter: 'Populares', // Filtra por isPopular: true
      delay: 'delay-200',
      size: 'p-16 md:p-24' // Tamaño MEDIANO/PEQUEÑO (para que no se vea gigante)
    },
    { 
      id: 'retro',    
      label: 'RETRO',    
      img1: '/Retro.png', 
      img2: '/Retro2.png',    
      filter: 'Retro', 
      delay: 'delay-300',
      size: 'p-16 md:p-24' // Tamaño GRANDE
    },
    { 
      id: 'nuevo',      
      label: 'LO NUEVO', // Etiqueta comercial
      img1: '/Fan.png', 
      img2: '/Fan2.png',      
      filter: 'Nuevo', // Filtra por orden de llegada (Id más nuevo)
      delay: 'delay-400',
      size: 'p-16 md:p-24' // Tamaño GRANDE
    },
  ];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {/* GRID DE 4 COLUMNAS (2 en Móvil) */}
      <div className="w-full h-full grid grid-cols-2 md:grid-cols-4 z-10">
        
        {categories.map((cat) => (
          <div 
            key={cat.id}
            onClick={() => handleFilter(cat.filter)}
            className={`
              relative group cursor-pointer 
              /* Bordes blancos sutiles */
              border-r border-white/25 last:border-r-0 border-b border-white/25 md:border-b-0
              flex flex-col items-center justify-center
              bg-black transition-all duration-700 ease-out
              hover:bg-zinc-950 overflow-hidden
              animate-enter ${cat.delay}
            `}
          >
            {/* CONTENEDOR DE IMAGEN (Con tamaño personalizado) */}
            <div className={`
              relative w-full aspect-square flex items-center justify-center
              ${cat.size}
            `}>
              
              {/* Círculo Gris de Fondo al Hover */}
              <div className="absolute w-[90%] h-[90%] rounded-full bg-zinc-800/50 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 ease-out"></div>

              {/* --- IMAGEN 1 (Principal) --- */}
              <img 
                src={cat.img1} 
                alt={cat.label}
                className={`
                  absolute inset-0 m-auto w-full h-full object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] z-20
                  filter grayscale-[100%] transition-all duration-1000 ease-in-out
                  /* Efectos al pasar el mouse: Color + Zoom Grande + Rotación */
                  group-hover:grayscale-0 group-hover:scale-[1.6] group-hover:-rotate-6
                  /* Lógica de visibilidad (Crossfade) */
                  ${showSecondary ? 'opacity-0' : 'opacity-80 group-hover:opacity-100'}
                `}
              />

              {/* --- IMAGEN 2 (Secundaria) --- */}
              <img 
                src={cat.img2} 
                alt={cat.label}
                className={`
                  absolute inset-0 m-auto w-full h-full object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] z-20
                  filter grayscale-[100%] transition-all duration-1000 ease-in-out
                  group-hover:grayscale-0 group-hover:scale-[1.6] group-hover:-rotate-6
                  /* Lógica de visibilidad (Crossfade inversa) */
                  ${showSecondary ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'}
                `}
              />

            </div>

            {/* ETIQUETA INFERIOR */}
            <div className="absolute bottom-6 md:bottom-12 flex flex-col items-center z-30">
              <span className="text-white font-black text-sm md:text-xl tracking-[0.2em] uppercase mb-2 group-hover:text-zinc-300 transition-colors duration-500">
                {cat.label}
              </span>
              {/* Línea decorativa animada */}
              <div className="h-[1px] w-8 bg-white/30 group-hover:w-16 group-hover:bg-zinc-300 transition-all duration-500"></div>
            </div>

          </div>
        ))}

      </div>
    </div>
  );
};

export default Bienvenido;  