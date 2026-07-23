
import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [fase, setFase] = useState(1); // Controla si estamos en fase 1, 2 o 3
  const [isHovered, setIsHovered] = useState(false); // Para el efecto hover de la píldora
  const [mobileShowOffer, setMobileShowOffer] = useState(false); // Para alternar en móvil

  useEffect(() => {
    // Control de responsive para fondos
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);

    // Temporizador para alternar entre las 3 fases automáticamente
    const intervalFases = setInterval(() => {
      setFase((prevFase) => (prevFase === 3 ? 1 : prevFase + 1));
    }, 4000); // Cambia de fase cada 4 segundos

    // Temporizador exclusivo para móvil que alterna el texto del botón cada 2.5 segundos
    const intervalMobile = setInterval(() => {
      if (window.innerWidth < 768) {
        setMobileShowOffer((prev) => !prev);
      }
    }, 2500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(intervalFases);
      clearInterval(intervalMobile);
    };
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

  // Si pones el mouse en compu O si el temporizador de móvil está activo, muestra "VER OFERTAS"
  const showCallToAction = isHovered || (isMobile && mobileShowOffer);

  return (
    // 🔥 Aumentamos la altura en desktop (md:h-[90vh]) para bajar el contenido hasta el límite del corte 🔥
    <div className="relative w-full h-[360px] md:h-[85vh] overflow-hidden flex flex-col justify-center items-center font-sans pb-32">
      
      <style>
        {`
          /* 🔥 BOTÓN BLANCO ANIMADO CON BRILLO 🔥 */
          @keyframes btnWhitePulse {
            0%   { background-color: #ffffff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.3); } 
            50%  { background-color: #f8fafc; box-shadow: 0 0 25px rgba(255, 255, 255, 0.7); } 
            100% { background-color: #ffffff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.3); }
          }
          .animate-btn-white { animation: btnWhitePulse 3s ease-in-out infinite; }

          /* Animación suave para cuando rotan las fases de las camisetas */
          @keyframes phaseZoomIn {
            0% { opacity: 0; transform: scale(0.93) translateY(8px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-phase { animation: phaseZoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        `}
      </style>

      {/* 🖼️ CAPA BASE: Fondo dinámico (Móvil vs Desktop) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${isMobile ? '/FondoMovil.png' : '/FondoDes.png'})` }}
      ></div>
      
      {/* Capa de oscurecimiento para resaltar las prendas */}
      <div className={`absolute inset-0 ${isMobile ? 'bg-black/30' : 'bg-black/50'} z-10 pointer-events-none`}></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-20 flex flex-col justify-end items-center w-full max-w-4xl px-4">

        {/* 🔥 CONTENEDOR DINÁMICO DE FASES (CAMISETAS) 🔥 */}
        <div className=" relative z-20 min-h-[220px] md:min-h-[320px] flex flex-col justify-center items-center mt-16 md:mt-28 mb-2">
          
          {/* --- FASE 1: 1 Camiseta --- */}
          {fase === 1 && (
            <div className="flex flex-col items-center animate-phase">
              <div className="pb-8 w-60 md:w-80 relative z-10">
                <img src="/Mundial.png" className="w-full h-auto object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.9)]" alt="1 Camiseta"/>
              </div>
            </div>
          )}

          {/* --- FASE 2: 2 Camisetas --- */}
          {fase === 2 && (
            <div className="flex flex-col items-center animate-phase">
              <div className="flex justify-center items-center w-60 md:w-80 relative z-10">
                <img src="/Mundial.png" className="w-80 md:w-80 h-auto object-contain -mr-16 md:-mr-20 z-20 drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)]" alt="Camiseta 1"/>
                <img src="/Fan2.png" className="w-80 md:w-80 h-auto object-contain z-10 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] scale-95 transform translate-y-1" alt="Camiseta 2"/>
              </div>
            </div>
          )}

          {/* --- FASE 3: 3 Camisetas --- */}
          {fase === 3 && (
            <div className="flex flex-col items-center animate-phase">
              <div className="flex justify-center items-center w-68 md:w-[400px] relative z-10">
                {/* Camiseta 1: Mantenemos w-80 y la pegamos al centro con -mr-32 md:-mr-48 */}
                <img src="/Mundial.png" className="w-60 md:w-80 h-auto object-contain -mr-32 md:-mr-48 z-30 drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)]" alt="Camiseta 1"/>
                
                {/* Camiseta 2: Se queda en el centro intacta con w-80 */}
                <img src="/Fan2.png" className="w-60 md:w-80 h-auto object-contain z-20 drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] scale-95 transform -translate-y-2" alt="Camiseta 2"/>
                
                {/* Camiseta 3: Ajustada a w-80 y pegada hacia la izquierda con -ml-32 md:-ml-48 */}
                <img src="/Player2.png" className="w-60 md:w-80 h-auto object-contain -ml-32 md:-ml-48 z-10 drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)] scale-90 transform translate-y-1" alt="Camiseta 3"/>
              </div>
            </div>
          )}

        </div>
        
        {/* 🔥 PÍLDORA INTERACTIVA 2 EN 1 (MÁS COMPACTA EN MÓVIL, GIGANTE EN DESKTOP) 🔥 */}
        <div className="relative z-30 mt-8 md:mt-16 flex flex-col items-center">
          
          <button
            onClick={handleOfertas}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            // 👇 AQUÍ AJUSTAMOS EL TAMAÑO: h-14 en móvil (md:h-28), min-w-[250px] en móvil (md:min-w-[540px]), px-8 py-3 en móvil 👇
            className="group bg-white text-gray-950 border-2 border-gray-100 px-8 py-3 md:px-24 md:py-8 rounded-full font-black text-base sm:text-lg md:text-4xl transition-all duration-300 hover:scale-105 animate-btn-white uppercase tracking-wider shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-center min-w-[250px] md:min-w-[540px] h-14 md:h-28 cursor-pointer select-none"
          >
            {/* Si el mouse está encima (o en móvil el temporizador activa la llamada), muestra VER OFERTAS */}
            {showCallToAction ? (
              <span className="flex items-center gap-2 md:gap-4 text-black animate-fade-in font-extrabold tracking-widest text-lg md:text-4xl">
                <span>VER OFERTAS </span>
              </span>
            ) : (
              <span className="flex items-center gap-2 md:gap-5 transition-opacity duration-300">
                {fase === 1 && (
                  <>
                    <span className="text-gray-500 font-bold text-base md:text-3xl">1 POR</span>
                    <span className="font-black text-black tracking-tighter text-xl md:text-5xl">₡15.000</span>
                  </>
                )}
                {fase === 2 && (
                  <>
                    <span className="text-gray-500 font-bold text-base md:text-3xl">2 POR</span>
                    <span className="font-black text-black tracking-tighter text-xl md:text-5xl">₡27.000</span>
                  </>
                )}
                {fase === 3 && (
                  <>
                    <span className="text-gray-500 font-bold text-base md:text-3xl">3 POR</span>
                    <span className="font-black text-black tracking-tighter text-xl md:text-5xl">₡35.000</span>
                  </>
                )}
              </span>
            )}
          </button>

        </div>
      </div>

      {/* 🔥 INDICADORES DE FASE FIJOS HASTA EL BORDE INFERIOR 🔥 */}
      <div className="absolute bottom-4 md:bottom-8 left-0 right-0 flex gap-3 z-40 items-center justify-center">
        {[1, 2, 3].map((num) => (
          <button
            key={num}
            onClick={() => setFase(num)}
            className={`h-[2px] rounded-full transition-all duration-500 ${
              fase === num 
                ? 'w-10 bg-gray-300 shadow-[0_0_8px_rgba(255,255,255,0.6)]' 
                : 'w-4 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Ver oferta ${num}`}
          />
        ))}
      </div>

    </div>
  );
};

export default Bienvenido;