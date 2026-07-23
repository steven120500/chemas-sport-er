import React, { useState, useEffect } from 'react';

const IntroLoader = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [fadeIntro, setFadeIntro] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // 🔥 FASES CINEMATOGRÁFICAS: 0=Corriendo, 1=Pateando, 2=Impacto/Texto, 3=Subtítulo
  const [cinePhase, setCinePhase] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // 1. Barra de progreso fluida (de 0 a 100% en ~2.6 seg)
    const intervalProgress = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalProgress);
          return 100;
        }
        const increment = Math.random() > 0.6 ? 3 : 2;
        return Math.min(prev + increment, 100);
      });
    }, 35);
    
    // 2. TIMELINE DE LA CINEMATOGRÁFICA
    const t1 = setTimeout(() => setCinePhase(1), 1300); // 1.3s: Se frena y PATEA EL BALÓN
    const t2 = setTimeout(() => setCinePhase(2), 1600); // 1.6s: El balón golpea el centro y SALE "CHEMA SPORT"
    const t3 = setTimeout(() => setCinePhase(3), 1900); // 1.9s: Sale "PREMIUM ER COLLECTION" y celebra
    
    // 3. Salida y cierre (Total: 3.3 segundos para apreciar toda la escena)
    const fadeTimer = setTimeout(() => setFadeIntro(true), 2700); 
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      if (onFinished) onFinished();
    }, 3400);

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

  // Calculamos la posición del monigote: Corre hasta el centro (50%) y ahí se queda para patear
  const stickmanPosition = Math.min(progress, 50);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-white px-6 py-12 transition-opacity duration-[700ms] ease-out ${
        fadeIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <style>
        {`
          /* ⭐ ANIMACIONES DE IMPACTO PARA EL TEXTO (SLAMS DESDE EL CENTRO) ⭐ */
          @keyframes textSlam {
            0% { transform: scale(2.5); opacity: 0; filter: blur(4px); }
            100% { transform: scale(1); opacity: 1; filter: blur(0px); }
          }
          .animate-slam {
            animation: textSlam 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          /* ⭐ ANIMACIONES DEL MONIGOTE CORRIENDO ⭐ */
          @keyframes runArm1 { 0%, 100% { transform: rotate(-35deg); } 50% { transform: rotate(35deg); } }
          @keyframes runArm2 { 0%, 100% { transform: rotate(35deg); } 50% { transform: rotate(-35deg); } }
          @keyframes runLeg1 { 0%, 100% { transform: rotate(-40deg); } 50% { transform: rotate(40deg); } }
          @keyframes runLeg2 { 0%, 100% { transform: rotate(40deg); } 50% { transform: rotate(-40deg); } }
          @keyframes bobbing { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-3px); } }
          @keyframes ballBounce { 0%, 100% { transform: translateY(0px) scaleX(1); } 50% { transform: translateY(-8px) scaleX(0.95); } }

          /* ⭐ ANIMACIÓN DE LA PATADA Y CELEBRACIÓN ⭐ */
          @keyframes kickLeg { 0% { transform: rotate(0deg); } 30% { transform: rotate(-50deg); } 100% { transform: rotate(70deg); } }
          @keyframes celebrateArms { 0% { transform: rotate(0deg); } 100% { transform: rotate(-140deg); } }
          
          /* ⭐ EL DISPARO DEL BALÓN AL CENTRO DE LA PANTALLA ⭐ */
          @keyframes shootBall {
            0% { transform: translate(0px, 0px) scale(1); opacity: 1; }
            80% { transform: translate(10px, -240px) scale(3.5); opacity: 1; }
            100% { transform: translate(10px, -260px) scale(5); opacity: 0; } /* Explota y desaparece en el centro */
          }

          /* ESTRUCTURA CSS BLINDADA DEL MONIGOTE */
          .stickman-wrapper { position: relative; width: 20px; height: 42px; }
          .sm-head { position: absolute; top: 0; left: 3px; width: 14px; height: 14px; border: 2.5px solid #000; border-radius: 50%; background: #fff; z-index: 10; }
          .sm-body { position: absolute; top: 13px; left: 9px; width: 2.5px; height: 16px; background: #000; z-index: 5; }
          .sm-arm-1 { position: absolute; top: 14px; left: 9px; width: 2.5px; height: 13px; background: #000; transform-origin: top center; z-index: 6; }
          .sm-arm-2 { position: absolute; top: 14px; left: 9px; width: 2.5px; height: 13px; background: #000; transform-origin: top center; z-index: 4; }
          .sm-leg-1 { position: absolute; top: 27px; left: 9px; width: 2.5px; height: 15px; background: #000; transform-origin: top center; z-index: 6; }
          .sm-leg-2 { position: absolute; top: 27px; left: 9px; width: 2.5px; height: 15px; background: #000; transform-origin: top center; z-index: 4; }
          .sm-ball { position: absolute; bottom: -2px; right: -12px; width: 10px; height: 10px; background: #000; border-radius: 50%; z-index: 10; }

          /* ESTADOS CONDICIONALES DINÁMICOS */
          .state-running { animation: bobbing 0.2s infinite ease-in-out; }
          .state-running .sm-arm-1 { animation: runArm1 0.35s infinite ease-in-out; }
          .state-running .sm-arm-2 { animation: runArm2 0.35s infinite ease-in-out; }
          .state-running .sm-leg-1 { animation: runLeg1 0.35s infinite ease-in-out; }
          .state-running .sm-leg-2 { animation: runLeg2 0.35s infinite ease-in-out; }
          .state-running .sm-ball  { animation: ballBounce 0.25s infinite alternate ease-in-out; }

          /* Estado pateando */
          .state-kicking .sm-leg-1 { animation: kickLeg 0.3s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .state-kicking .sm-ball  { animation: shootBall 0.3s forwards cubic-bezier(0.25, 0.46, 0.45, 0.94); }

          /* Estado celebrando (brazos arriba) */
          .state-celebrating .sm-arm-1 { animation: celebrateArms 0.4s forwards ease-out; }
          .state-celebrating .sm-arm-2 { animation: celebrateArms 0.4s forwards ease-out; }
          .state-celebrating .sm-ball  { opacity: 0; } /* El balón ya explotó arriba */
        `}
      </style>

      {/* --- SUPERIOR --- */}
      <div className="w-full flex justify-between items-center opacity-40 text-xs tracking-widest uppercase font-mono">
        <span>ChemaSport ER</span>
        <span>Est. 2026</span>
      </div>

      {/* --- CENTRO: LOGO TIPOGRÁFICO (OCULTO HASTA EL IMPACTO DEL BALÓN) --- */}
      <div className="flex flex-col items-center justify-center my-auto w-full text-center min-h-[220px]">
        
        {/* CHEMA SPORT aparece justo cuando el balón golpea (cinePhase >= 2) */}
        {cinePhase >= 2 && (
          <div className="animate-slam flex flex-col items-center">
            <h1 className="text-black text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter uppercase leading-none">
              CHEMA
            </h1>
            <h1 className="text-black text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter uppercase leading-none -mt-2 sm:-mt-4 md:-mt-6">
              SPORT
            </h1>
          </div>
        )}

        {/* ER aparece un instante después (cinePhase >= 3) */}
        {cinePhase >= 3 && (
          <div className="animate-slam mt-4 md:mt-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-[2px] w-8 md:w-16 bg-black"></div>
              {/* 👇 AQUÍ ESTÁ EL AJUSTE: Pasó a text-xl sm:text-2xl md:text-4xl font-black 👇 */}
              <span className="text-black font-black text-xl sm:text-2xl md:text-4xl tracking-[0.3em] uppercase">
                ER 
              </span>
              <div className="h-[2px] w-8 md:w-16 bg-black"></div>
            </div>
          </div>
        )}

      </div>

      {/* --- INFERIOR: BARRA DE PROGRESO CON MONIGOTE --- */}
      <div className="w-full max-w-xl flex flex-col gap-2 relative pb-6">
        
        {/* ⭐ AQUÍ ESTÁ EL TRUCO: agregamos scale(1.6) en el transform para que crezca un 60% más ⭐ */}
        <div 
          className="absolute bottom-20 transition-all duration-75 ease-linear origin-bottom"
          style={{ 
            left: `${stickmanPosition}%`, 
            transform: 'translateX(-50%) scale(2.6)' // 👈 Cambia 1.6 por 1.8 o 2.0 si lo quieres enorme
          }}
        >
          {/* Monigote intacto por dentro */}
          <div className={`stickman-wrapper ${
            cinePhase === 0 ? 'state-running' : 
            cinePhase === 1 ? 'state-kicking' : 'state-celebrating'
          }`}>
            <div className="sm-head"></div>
            <div className="sm-body"></div>
            <div className="sm-arm-1"></div>
            <div className="sm-arm-2"></div>
            <div className="sm-leg-1"></div>
            <div className="sm-leg-2"></div>
            <div className="sm-ball"></div>
          </div>
        </div>

        {/* Textos del indicador */}
        <div className="flex justify-between items-end text-xs md:text-sm font-medium uppercase tracking-widest text-neutral-400">
          <span>{cinePhase < 2 ? 'Preparando disparo...' : '¡Catálogo listo!'}</span>
          <span className="font-mono text-black font-bold text-base">{progress}%</span>
        </div>

        {/* Línea de progreso */}
        <div className="w-full h-[3px] bg-neutral-100 overflow-hidden relative rounded-full">
          <div 
            className="absolute top-0 left-0 bottom-0 bg-black transition-all duration-75 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

    </div>
  );
};

export default IntroLoader;