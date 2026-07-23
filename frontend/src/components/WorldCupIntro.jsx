import React, { useState, useEffect } from 'react';

const IntroLoader = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState(0); 
  const [fadeIntro, setFadeIntro] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Bloqueamos el scroll del cuerpo mientras dura la intro
    document.body.style.overflow = 'hidden';

    // 1. Simulación de barra de progreso fluida (de 0 a 100 en 2.4s)
    const intervalProgress = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalProgress);
          return 100;
        }
        return prev + 2; // Incrementa en pasos suaves
      });
    }, 40);

    // 2. Control de fases escalonadas para revelar el texto
    const t1 = setTimeout(() => setPhase(1), 150);  // Revela CHEMA
    const t2 = setTimeout(() => setPhase(2), 400);  // Revela SPORT
    const t3 = setTimeout(() => setPhase(3), 650);  // Revela ER y barra
    
    // 3. Salida y cierre de la animación (Total: 2.8 segundos)
    const fadeTimer = setTimeout(() => setFadeIntro(true), 2100); 
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      if (onFinished) onFinished();
    }, 2800);

    return () => {
      document.body.style.overflow = 'auto';
      clearInterval(intervalProgress);
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-white px-6 py-12 transition-opacity duration-[700ms] ease-out ${
        fadeIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <style>
        {`
          /* Animación suave para elevar las letras desde una máscara oculta */
          @keyframes textReveal {
            0% { transform: translateY(110%); }
            100% { transform: translateY(0%); }
          }
          .animate-reveal {
            animation: textReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>

      {/* --- ESPACIO SUPERIOR VACÍO (Para balancear el layout) --- */}
      <div className="w-full flex justify-between items-center opacity-40 text-xs tracking-widest uppercase font-mono">
        <span>ChemaSport ER</span>
        <span>© {new Date().getFullYear()}</span>
      </div>

      {/* --- CENTRO: LOGO TIPOGRÁFICO MINIMALISTA --- */}
      <div className="flex flex-col items-center justify-center my-auto">
        
        {/* Contenedor con overflow-hidden para hacer el efecto máscara */}
        <div className="overflow-hidden py-1">
          <h1 
            className="text-black text-6xl sm:text-8xl md:text-[9rem] font-black tracking-tighter uppercase leading-none transform translate-y-full transition-transform duration-700"
            style={{ transform: phase >= 1 ? 'translateY(0)' : 'translateY(110%)' }}
          >
            CHEMA
          </h1>
        </div>

        <div className="overflow-hidden py-1 -mt-2 sm:-mt-4 md:-mt-6">
          <h1 
            className="text-black text-6xl sm:text-8xl md:text-[9rem] font-black tracking-tighter uppercase leading-none transform translate-y-full transition-transform duration-700"
            style={{ transform: phase >= 2 ? 'translateY(0)' : 'translateY(110%)', transitionDelay: '100ms' }}
          >
            SPORT
          </h1>
        </div>

        {/* Detalle pequeño: EL "ER" enmarcado y elegante */}
        <div className="overflow-hidden mt-2 md:mt-4">
          <div 
            className="flex items-center gap-3 transform translate-y-full transition-transform duration-700"
            style={{ transform: phase >= 3 ? 'translateY(0)' : 'translateY(110%)', transitionDelay: '200ms' }}
          >
            <div className="h-[16px] w-8 md:w-16 bg-black"></div>
            <span className="text-black font-extrabold text-sm sm:text-lg md:text-xl tracking-[0.4em] uppercase">
              ER
            </span>
            <div className="h-[2px] w-8 md:w-16 bg-black"></div>
          </div>
        </div>

      </div>

      {/* --- INFERIOR: BARRA DE PROGRESO Y CONTADOR MINIMALISTA --- */}
      <div className="w-full max-w-md flex flex-col gap-3">
        
        {/* Textos del indicador */}
        <div className="flex justify-between items-end text-xs md:text-sm font-medium uppercase tracking-widest text-neutral-400">
          <span className="animate-pulse">Preparando catálogo...</span>
          <span className="font-mono text-black font-bold">{progress}%</span>
        </div>

        {/* Línea de progreso ultra fina (2px) */}
        <div className="w-full h-[2px] bg-neutral-100 overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 bottom-0 bg-black transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

      </div>

    </div>
  );
};

export default IntroLoader;