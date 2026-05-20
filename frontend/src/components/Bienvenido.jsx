import React, { useState, useEffect } from 'react';

const Bienvenido = ({ onNavigate }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [introMergedComplete, setIntroMergedComplete] = useState(false);
  const mundialFilter = 'Mundial 2026';

  useEffect(() => {
    const introTimer = setTimeout(() => {
      setIntroMergedComplete(true); 
    }, 4500);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(introTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleFilter = () => {
    if (onNavigate) onNavigate(mundialFilter);
    setTimeout(() => {
      const section = document.getElementById('products-section') || document.getElementById('filter-bar');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }; 

  return (
    <div className="relative w-full h-[360px] md:h-[85vh] overflow-hidden flex flex-col justify-center items-center font-sans pb-16">
      
      <style>
        {`
          /* 🔥 BOTÓN MORADO 🔥 */
          @keyframes btnPurplePulse {
            0%   { background-color: #6d28d9; box-shadow: 0 0 15px rgba(109, 40, 217, 0.5); border-color: #6d28d9; } 
            50%  { background-color: #8b5cf6; box-shadow: 0 0 30px rgba(139, 92, 246, 0.8); border-color: #8b5cf6; } 
            100% { background-color: #6d28d9; box-shadow: 0 0 15px rgba(109, 40, 217, 0.5); border-color: #6d28d9; }
          }
          .animate-btn-purple { animation: btnPurplePulse 3s ease-in-out infinite; }

          @keyframes fadeMoradoOnce {
            0%   { opacity: 0; }
            100% { opacity: 1; }
          }
          .animate-fade-morado { animation: fadeMoradoOnce 2s ease-in-out 0.5s both; }

          /* 🔥🔥 ANIMACIONES DE ENTRADA (DESDE DIFERENTES DIRECCIONES) 🔥🔥 */
          
          /* Entra volando desde la izquierda */
          @keyframes flyFromLeft {
            0% { opacity: 0; transform: translateX(-200px) rotate(-20deg) scale(0.5); filter: blur(5px); }
            100% { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); filter: blur(0); }
          }
          .animate-fly-left { animation: flyFromLeft 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }

          /* Entra volando desde la derecha dando vueltas */
          @keyframes flyFromRight {
            0% { opacity: 0; transform: translate(200px, -100px) rotate(180deg) scale(0.5); }
            100% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          }
          .animate-fly-right { animation: flyFromRight 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }

          /* Entra desde abajo recta */
          @keyframes flyFromBottom {
            0% { opacity: 0; transform: translateY(150px) scale(0.8); filter: blur(5px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }
          .animate-fly-bottom { animation: flyFromBottom 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both; }


          /* 🔥🔥 ANIMACIONES DE FLOTACIÓN (INFINITAS) 🔥🔥 */
          @keyframes floatMain {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          .animate-float-main { animation: floatMain 4s ease-in-out infinite; }

          @keyframes floatCup {
            0%, 100% { transform: translate(0, 0) rotate(-2deg); }
            50% { transform: translate(-5px, -10px) rotate(2deg); }
          }
          .animate-float-cup { animation: floatCup 6s ease-in-out infinite; }

          @keyframes floatBall {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            50% { transform: translate(0, -15px) rotate(8deg); }
          }
          .animate-float-ball { animation: floatBall 3.5s ease-in-out infinite; }
        `}
      </style>

      {/* 🖼️ CAPA BASE: Fase 1 (Aplica para Móvil y Compu) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none"
        style={{ backgroundImage: `url(${isMobile ? '/FondoMovil_Fase1.png' : '/FondoCompu_Fase1.png'})` }}
      ></div>
      
      {/* 🖼️ CAPA SUPERIOR MORADA: Fase 2 (Ahora aparece en Móvil y Compu) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 animate-fade-morado pointer-events-none"
        style={{ backgroundImage: `url(${isMobile ? '/FondoMovil_Fase2.png' : '/FondoCompu_Fase2.png'})` }}
      ></div>
      
      <div className={`absolute inset-0 ${isMobile ? 'bg-black/40' : 'bg-black/65'} z-20 pointer-events-none`}></div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-30 flex-grow flex flex-col justify-center items-center w-full max-w-4xl px-4 mt-6 md:mt-0">
        
        {/* CONTENEDOR MAESTRO DE LAS IMÁGENES */}
        <div className="relative w-[220px] md:w-[450px] flex justify-center items-center">
          
          {/* 🏆 COPA: Viene de la Izquierda */}
          {/* 🔥 POSICIÓN 🔥 -> Mueve "left-[-30%]" o "top-[-5%]" o cambia su tamaño "w-[85%]" */}
          <div className="absolute z-1 w-36 md:w-60 md:-left-6 left-3  top-[-5%] animate-fly-left">
            <img src="/CopaMundial.png" className="w-full h-auto object-contain opacity-100  drop-shadow-md" alt="Copa"/>
          </div>
          
          {/* 👕 CAMISETA: Viene de Abajo (Centro) */}
          {/* 🔥 POSICIÓN 🔥 -> Está centrada con "w-full", si quieres hacerla más pequeña reduce el w-[220px] del Contenedor Maestro de arriba */}
          <div className="relative z-10 w-46 animate-fly-bottom">
            <img src="/Mundial.png" className="w-full h-auto object-contain  drop-shadow-[0_35px_60px_rgba(0,0,0,0.9)]" alt="Camiseta Mundial"/>
          </div>

          {/* ⚽ BOLA: Viene de la Derecha */}
          {/* 🔥 POSICIÓN 🔥 -> Mueve "right-[-10%]" o "bottom-[0%]" o el tamaño "w-[40%]" */}
          <div className="absolute z-20 w-40 md:w-56 md:-bottom-6 bottom-0 right-10 md:right-6 animate-fly-right">
            <img src="/Bola.png" className="w-full h-auto object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)]" alt="Bola"/>
          </div>

        </div>
        
        {/* BOTÓN FLOTANTE */}
        <button
          onClick={handleFilter}
          className={`
            absolute z-50 bg-purple-700
            bottom-2 md:bottom-0
            px-8 py-3 md:px-12 md:py-4 
            rounded-full font-black text-sm sm:text-lg md:text-xl 
            transition-transform duration-300 hover:scale-110 border-2
            text-white animate-btn-purple animate-fly-bottom
          `}
          style={{ animationDelay: '1s' }} // Aparece de último
        >
          Ver colección del mundial
        </button>

      </div>
    </div>
  );
};

export default Bienvenido;