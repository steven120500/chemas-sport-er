import React, { useState, useEffect } from 'react';

const WorldCupIntro = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState(0); 
  const [fadeIntro, setFadeIntro] = useState(false);

  useEffect(() => {
    // Bloqueamos el scroll
    document.body.style.overflow = 'hidden';

    // Tiempos ajustados: más cómodos de leer, sin ser eternos
    const t1 = setTimeout(() => setPhase(1), 100);   // 1. Sale la Copa casi al inicio
    const t2 = setTimeout(() => setPhase(2), 800);   // 2. Entran CHEMA SPORT ER
    const t3 = setTimeout(() => setPhase(3), 1500);  // 3. Sale "¡Que empiece el mundial!"
    
    const fadeTimer = setTimeout(() => setFadeIntro(true), 3200); // Empezamos a desvanecer
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      if (onFinished) onFinished();
    }, 4000); // A los 4 segundos exactos liberamos la pantalla

    return () => {
      document.body.style.overflow = 'auto';
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onFinished]);

  if (!visible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-[800ms] ease-in-out ${
        fadeIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <style>
        {`
          @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          @keyframes shockwave {
            0% { transform: scale(0.5); opacity: 1; border-width: 15px; }
            100% { transform: scale(3.5); opacity: 0; border-width: 1px; }
          }
        `}
      </style>

      {/* =========================================
          SECCIÓN SUPERIOR: LA COPA
          ========================================= */}
      <div className="relative flex items-center justify-center w-full h-64 md:h-80 mb-12 md:mb-16 mt-[-50px]">
        
        {phase >= 1 && (
          <div 
            className="absolute border-yellow-400 rounded-full z-0"
            style={{
              width: '150px', height: '150px',
              animation: 'shockwave 1s ease-out forwards'
            }}
          ></div>
        )}

        <img 
            src="/CopaMundial.png" 
            alt="Copa del Mundo"
            className="relative z-10 w-48 md:w-64 object-contain drop-shadow-[0_15px_25px_rgba(200,150,0,0.3)]"
            style={{ 
              animation: phase >= 1 ? 'popIn 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none',
              opacity: phase >= 1 ? 1 : 0 
            }}
        />
      </div>

      {/* =========================================
          SECCIÓN INFERIOR: TEXTOS
          ========================================= */}
      <div className="flex flex-col items-center text-center overflow-hidden w-full px-4">
        
        <h1 
          className="text-black text-6xl md:text-8xl font-black tracking-tighter uppercase transition-transform duration-[600ms] ease-out"
          style={{ 
            transform: phase >= 2 ? 'translateX(0)' : 'translateX(-100vw)',
            opacity: phase >= 2 ? 1 : 0 
          }}
        >
            CHEMA
        </h1>
        
        <h1 
          className="text-black text-6xl md:text-8xl font-black tracking-tighter uppercase mt-[-10px] md:mt-[-20px] transition-transform duration-[600ms] ease-out"
          style={{ 
            transform: phase >= 2 ? 'translateX(0)' : 'translateX(100vw)',
            opacity: phase >= 2 ? 1 : 0 
          }}
        >
            SPORT ER
        </h1>

        <p 
          className="mt-8 font-sans font-extrabold text-2xl md:text-4xl tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 drop-shadow-sm transition-all duration-[800ms]"
          style={{ 
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(20px)',
            opacity: phase >= 3 ? 1 : 0 
          }}
        >
            ¡Que empiece el mundial!
        </p>

      </div>
    </div>
  );
};

export default WorldCupIntro;