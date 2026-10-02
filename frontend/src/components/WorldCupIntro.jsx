import React, { useState, useEffect } from 'react';

const IntroLoader = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [fadeIntro, setFadeIntro] = useState(false);
  // Usaremos decimales para que el cálculo visual sea sub-píxel perfecto
  const [progress, setProgress] = useState(0); 
  
  // 🔥 FASES FANTASMA: 0=Levitando, 1=Invocación (Brazos arriba), 2=Impacto CHEMA, 3=Impacto ER
  const [cinePhase, setCinePhase] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // 1. Barra de progreso sincronizada a los fotogramas del dispositivo (60/120fps)
    let animationFrameId;
    const startTime = performance.now();
    const duration = 2000; // 2 segundos exactos para llegar a 100%

    const updateProgress = (currentTime) => {
      const elapsed = currentTime - startTime;
      const currentProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(currentProgress);

      if (currentProgress < 100) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);
    
    // 2. TIMELINE PARANORMAL
    const t1 = setTimeout(() => setCinePhase(1), 1800); // Se detiene y levanta los brazos
    const t2 = setTimeout(() => setCinePhase(2), 2200); // Aparece CHEMA SPORT
    const t3 = setTimeout(() => setCinePhase(3), 2500); // Aparece ER
    
    // 3. Salida y cierre (Total: ~3.8 segundos)
    const fadeTimer = setTimeout(() => setFadeIntro(true), 3200); 
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      if (onFinished) onFinished();
    }, 3900);

    return () => {
      document.body.style.overflow = 'auto';
      cancelAnimationFrame(animationFrameId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onFinished]);

  if (!visible) return null;

  const startX = 15;
  // Avanza hasta el 50% y ahí se queda flotando
  const stickmanPosition = Math.min(startX + (progress * 0.45), 50);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between px-6 py-12 transition-opacity duration-[700ms] ease-out ${
        fadeIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } bg-black overflow-hidden`} 
    >
      <style>
        {`
          /* ⭐ IMPACTOS GLITCH Y SANGRE ⭐ */
          @keyframes textSlam {
            0% { transform: scale(2.5) translateY(20px); opacity: 0; filter: blur(8px) drop-shadow(0 0 20px #dc2626); color: #dc2626; }
            40% { transform: scale(0.9); opacity: 1; filter: blur(0px) drop-shadow(0 0 0px transparent); color: #fff; }
            50% { transform: scale(1.05); color: #ea580c; } 
            100% { transform: scale(1); opacity: 1; color: #fff; }
          }
          .animate-slam { animation: textSlam 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          
          @keyframes glitchEffect {
             0% { opacity: 1; transform: translate(0); filter: hue-rotate(0deg); }
             20% { opacity: 0.8; transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
             40% { opacity: 1; transform: translate(2px, -2px); filter: hue-rotate(-90deg); }
             60% { opacity: 0.9; transform: translate(-2px, -2px); filter: hue-rotate(180deg); color: #dc2626; }
             80% { opacity: 1; transform: translate(2px, 2px); filter: hue-rotate(0deg); }
             100% { opacity: 1; transform: translate(0); color: #fff; }
          }
          .animate-glitch { animation: glitchEffect 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }

          /* ⭐ ANIMACIONES DEL ESCENARIO ⭐ */
          @keyframes cobwebSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(3deg); } }
          .animate-cobweb { animation: cobwebSway 6s infinite alternate ease-in-out; transform-origin: top right; }

          @keyframes batsFly {
            0% { transform: translate(-10px, 10px) scale(0.9); opacity: 0; }
            30% { opacity: 0.6; }
            100% { transform: translate(30px, -20px) scale(1.05); opacity: 0.6; }
          }
          .animate-bats { animation: batsFly 4s ease-out forwards; }

          /* ⭐ LEVITACIÓN FANTASMAL (Flota arriba y abajo) ⭐ */
          @keyframes ghostHover { 
            0%, 100% { transform: translateY(-10px) rotate(5deg); } 
            50% { transform: translateY(-25px) rotate(8deg); } 
          }
          
          /* Brazos y piernas colgando sin vida */
          @keyframes dangleArm1 { 0%, 100% { transform: rotate(15deg); } 50% { transform: rotate(20deg); } }
          @keyframes dangleArm2 { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(-5deg); } }
          @keyframes dangleLeg1 { 0%, 100% { transform: rotate(10deg); } 50% { transform: rotate(15deg); } }
          @keyframes dangleLeg2 { 0%, 100% { transform: rotate(25deg); } 50% { transform: rotate(30deg); } }
          
          /* Animación de la Bola de Alma Fatuo */
          @keyframes ghostFloat { 0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.8; } 50% { transform: translate(-2px, -8px) scale(1.1); opacity: 1; filter: drop-shadow(0 0 5px #ea580c); } }

          /* ⭐ ANIMACIÓN DE INVOCACIÓN (Susto) ⭐ */
          @keyframes scarePose { 0% { transform: translateY(-15px) rotate(5deg) scale(1); } 100% { transform: translateY(-30px) rotate(-5deg) scale(1.15); filter: drop-shadow(0 0 8px #dc2626); } }
          @keyframes armsUp { 0% { transform: rotate(15deg); } 100% { transform: rotate(-150deg); } }
          
          @keyframes shootGhost {
            0% { transform: translate(0px, 0px) scale(1); opacity: 1; background: #ea580c; }
            80% { transform: translate(15px, -240px) scale(4); opacity: 1; background: #dc2626; filter: blur(2px); }
            100% { transform: translate(15px, -260px) scale(8); opacity: 0; filter: blur(10px); }
          }

          /* ⭐ ESTRUCTURA CSS DEL FANTASMA ⭐ */
          .stickman-wrapper { position: relative; width: 20px; height: 42px; }
          /* Ahora el fantasma brilla un poco en la oscuridad */
          .sm-head { position: absolute; top: 2px; left: 6px; width: 14px; height: 14px; border: 2.5px solid #fff; border-radius: 50%; background: #000; z-index: 10; box-shadow: 0 0 6px rgba(255,255,255,0.4); }
          .sm-body { position: absolute; top: 13px; left: 9px; width: 2.5px; height: 16px; background: #fff; z-index: 5; box-shadow: 0 0 4px rgba(255,255,255,0.4); }
          .sm-arm-1 { position: absolute; top: 14px; left: 9px; width: 2.5px; height: 14px; background: #fff; transform-origin: top center; z-index: 6; }
          .sm-arm-2 { position: absolute; top: 14px; left: 9px; width: 2.5px; height: 14px; background: #fff; transform-origin: top center; z-index: 4; }
          .sm-leg-1 { position: absolute; top: 27px; left: 9px; width: 2.5px; height: 15px; background: #fff; transform-origin: top center; z-index: 6; }
          .sm-leg-2 { position: absolute; top: 27px; left: 9px; width: 2.5px; height: 15px; background: #fff; transform-origin: top center; z-index: 4; }
          .sm-ball { position: absolute; bottom: -10px; right: -10px; width: 10px; height: 10px; background: #ea580c; border-radius: 50%; z-index: 10; box-shadow: 0 0 8px #ea580c; }

          /* ESTADOS DEL FANTASMA PRINCIPAL */
          .state-levitating { animation: ghostHover 1.5s infinite ease-in-out; filter: drop-shadow(0 0 4px rgba(255,255,255,0.3)); }
          .state-levitating .sm-body { transform: rotate(10deg); } /* Inclinado hacia adelante */
          .state-levitating .sm-arm-1 { animation: dangleArm1 1.5s infinite alternate ease-in-out; }
          .state-levitating .sm-arm-2 { animation: dangleArm2 1.5s infinite alternate ease-in-out; }
          .state-levitating .sm-leg-1 { animation: dangleLeg1 1.5s infinite alternate ease-in-out; }
          .state-levitating .sm-leg-2 { animation: dangleLeg2 1.5s infinite alternate ease-in-out; }
          .state-levitating .sm-ball  { animation: ghostFloat 1s infinite alternate ease-in-out; }

          .state-summoning { animation: scarePose 0.3s forwards; }
          .state-summoning .sm-head { transform: rotate(-10deg); box-shadow: inset 0 0 6px #dc2626, 0 0 10px #dc2626; }
          .state-summoning .sm-arm-1 { animation: armsUp 0.3s forwards; }
          .state-summoning .sm-arm-2 { animation: armsUp 0.3s forwards; }
          .state-summoning .sm-leg-1 { transform: rotate(15deg); }
          .state-summoning .sm-leg-2 { transform: rotate(25deg); }
          .state-summoning .sm-ball  { animation: shootGhost 0.4s forwards cubic-bezier(0.25, 0.46, 0.45, 0.94); }

          .state-faded { opacity: 0.3; filter: blur(2px); transform: translateY(-30px) rotate(-5deg) scale(1.15); }
          .state-faded .sm-head { transform: rotate(-10deg); }
          .state-faded .sm-arm-1 { transform: rotate(-150deg); }
          .state-faded .sm-arm-2 { transform: rotate(-150deg); }
          .state-faded .sm-leg-1 { transform: rotate(15deg); }
          .state-faded .sm-leg-2 { transform: rotate(25deg); }
          .state-faded .sm-ball  { opacity: 0; }
        `}
      </style>

      {/* --- SUPERIOR --- */}
      <div className="w-full flex justify-between items-center opacity-30 text-xs tracking-widest uppercase font-mono text-neutral-400 z-10 relative">
        <span>ChemaSport ER</span>
        <span>Maldición 2026</span>
      </div>

      {/* --- CENTRO: LOGO TIPOGRÁFICO --- */}
      <div className="flex flex-col items-center justify-center my-auto w-full text-center min-h-[220px]">
        {cinePhase >= 2 && (
          <div className="animate-slam flex flex-col items-center relative z-20">
            <h1 className="text-white text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter uppercase leading-none drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">
              CHEMA
            </h1>
            <h1 className="text-white text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter uppercase leading-none -mt-2 sm:-mt-4 md:-mt-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">
              SPORT
            </h1>
          </div>
        )}
        {cinePhase >= 3 && (
          <div className="animate-glitch mt-4 md:mt-6 z-20">
            <div className="flex items-center justify-center gap-4">
              <div className="h-[2px] w-8 md:w-16 bg-red-600 shadow-[0_0_8px_#dc2626]"></div>
              <span className="text-red-500 font-black text-xl sm:text-2xl md:text-4xl tracking-[0.3em] uppercase drop-shadow-[0_0_5px_#dc2626]">
                ER 
              </span>
              <div className="h-[2px] w-8 md:w-16 bg-red-600 shadow-[0_0_8px_#dc2626]"></div>
            </div>
          </div>
        )}
      </div>

      {/* --- INFERIOR: BARRA DE PROGRESO Y FANTASMA --- */}
      <div className="w-full max-w-xl flex flex-col gap-2 relative pb-6">
        
        {/* EL FANTASMA PRINCIPAL */}
        <div 
          className="absolute bottom-20 origin-bottom z-10 will-change-[left,transform]"
          style={{ left: `${stickmanPosition}%`, transform: 'translateX(-50%) scale(2.6)' }}
        >
          <div className={`stickman-wrapper ${
            cinePhase === 0 ? 'state-levitating' : 
            cinePhase === 1 ? 'state-summoning' : 'state-faded'
          }`}>
            <div className="sm-head"></div>
            <div className="sm-body"></div>
            <div className="sm-arm-1"></div>
            <div className="sm-arm-2"></div>
            <div className="sm-leg-1"></div>
            <div className="sm-leg-2"></div>
            <div className="sm-ball"></div> {/* El alma / fuego fatuo que lo sigue */}
          </div>
        </div>

        <div className="flex justify-between items-end text-xs md:text-sm font-medium uppercase tracking-widest text-neutral-500 mt-8 z-20">
          <span>{cinePhase < 2 ? 'Invocando espíritus...' : 'Maldición completada.'}</span>
          <span className="font-mono text-orange-500 font-bold text-base drop-shadow-[0_0_3px_#ea580c]">{Math.floor(progress)}%</span>
        </div>

        <div className="w-full h-[3px] bg-neutral-900 overflow-hidden relative rounded-full z-20">
          <div 
            className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-orange-600 to-red-600 shadow-[0_0_8px_#dc2626] will-change-[width]"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

    </div>
  );
};

export default IntroLoader;