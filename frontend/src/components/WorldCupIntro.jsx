import React, { useState, useEffect } from 'react';

const IntroLoader = ({ onFinished }) => {
  const [visible, setVisible] = useState(false);
  const [fadeIntro, setFadeIntro] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cinePhase, setCinePhase] = useState(0);

  useEffect(() => {
    // 🔥 VERIFICAR SI YA SE MOSTRÓ EN ESTA SESIÓN (UNA SOLA VEZ) 🔥
    const hasSeenLoader = sessionStorage.getItem('chemasport_intro_shown');
    if (hasSeenLoader) {
      if (onFinished) onFinished();
      return;
    }

    setVisible(true);
    document.body.style.overflow = 'hidden';

    let animationFrameId;
    const startTime = performance.now();
    const duration = 3500; // Recorrido inicial pausado

    const updateProgress = (currentTime) => {
      const elapsed = currentTime - startTime;
      const currentProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(currentProgress);

      if (currentProgress < 100) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);
    
    // TIMELINE DE LA JUGADA Y LAS LETRAS
    const t1 = setTimeout(() => setCinePhase(1), 2400); // Remate al arco
    const t2 = setTimeout(() => setCinePhase(2), 2900); // ¡Gol! Aparece CHEMA SPORT
    const t3 = setTimeout(() => setCinePhase(3), 3300); // Aparece ER y se consolida
    
    // 🔥 EFECTO DE DESVANECIMIENTO GRADUAL (Se empieza a quitar a los 8.5 segundos) 🔥
    const fadeTimer = setTimeout(() => setFadeIntro(true), 8500); 
    
    // Se oculta por completo 1 segundo después
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      sessionStorage.setItem('chemasport_intro_shown', 'true'); 
      if (onFinished) onFinished();
    }, 9500);

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

  const startX = 10;
  const playerPosition = Math.min(startX + (progress * 0.4), 50);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between px-6 py-8 transition-opacity duration-1000 ease-in-out select-none ${
        fadeIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } bg-white text-black overflow-hidden font-sans`} 
    >
      <style>
        {`
          @keyframes pulsePitch {
            0%, 100% { opacity: 0.05; transform: scale(1); }
            50% { opacity: 0.12; transform: scale(1.02); }
          }
          .pitch-lines { animation: pulsePitch 4s infinite ease-in-out; }

          /* ⭐ ANIMACIÓN DE LA NIEVE CAYENDO ⭐ */
          @keyframes snowfall {
            0% { transform: translateY(-10px) translateX(0); opacity: 0; }
            20% { opacity: 0.8; }
            100% { transform: translateY(105vh) translateX(20px); opacity: 0.2; }
          }
          .snowflake {
            position: absolute;
            background: #cbd5e1;
            border-radius: 50%;
            animation: snowfall linear infinite;
          }

          /* ⭐ ANIMACIÓN DE LA RED DE LA PORTERÍA AL RECIBIR EL GOL ⭐ */
          @keyframes netImpact {
            0% { transform: scale(1); }
            30% { transform: scale(1.04) translateY(-4px); filter: drop-shadow(0 15px 15px rgba(220,38,38,0.25)); }
            60% { transform: scale(0.98); }
            100% { transform: scale(1); }
          }
          .animate-net-goal { animation: netImpact 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          @keyframes goalSlam {
            0% { transform: scale(2.8) translateY(10px); opacity: 0; filter: blur(12px); }
            35% { transform: scale(0.94); opacity: 1; filter: blur(0px); }
            60% { transform: scale(1.03); }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-goal-slam { animation: goalSlam 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          @keyframes shockwave {
            0% { transform: scale(0.2); opacity: 0.8; border-width: 6px; }
            100% { transform: scale(3.5); opacity: 0; border-width: 1px; }
          }
          .animate-shockwave { animation: shockwave 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          @keyframes badgeSlide {
            0% { opacity: 0; transform: translateY(15px) scale(0.9); letter-spacing: 0.8em; }
            100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.35em; }
          }
          .animate-badge { animation: badgeSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          /* Biomecánica de carrera pausada y fluida */
          @keyframes bodyBounce {
            0%, 100% { transform: translateY(0px) rotate(8deg); }
            50% { transform: translateY(-3px) rotate(12deg); }
          }
          @keyframes runArmLeft {
            0%, 100% { transform: rotate(-30deg); }
            50% { transform: rotate(35deg); }
          }
          @keyframes runArmRight {
            0%, 100% { transform: rotate(35deg); }
            50% { transform: rotate(-30deg); }
          }
          @keyframes runLegLeft {
            0%, 100% { transform: rotate(-40deg); }
            50% { transform: rotate(30deg); }
          }
          @keyframes runLegRight {
            0%, 100% { transform: rotate(30deg); }
            50% { transform: rotate(-40deg); }
          }
          @keyframes ballDribbleReal {
            0%, 100% { transform: translate(-2px, 0px) rotate(0deg) scale(0.95); }
            25% { transform: translate(2px, -3px) rotate(90deg) scale(1); }
            50% { transform: translate(-1px, 1px) rotate(180deg) scale(0.95); }
            75% { transform: translate(4px, -2px) rotate(270deg) scale(1.02); }
          }

          @keyframes realKickBody {
            0% { transform: translateY(0) rotate(8deg); }
            25% { transform: translateY(2px) rotate(20deg); } 
            60% { transform: translateY(-6px) rotate(-8deg); } 
            100% { transform: translateY(-3px) rotate(-4deg); }
          }
          @keyframes realKickLeg {
            0% { transform: rotate(15deg); }
            25% { transform: rotate(65deg); } 
            55% { transform: rotate(-110deg); } 
            100% { transform: rotate(-80deg); }
          }
          @keyframes supportLegPlant {
            0% { transform: rotate(-8deg); }
            30% { transform: rotate(20deg); filter: drop-shadow(2px 0 0 rgba(0,0,0,0.2)); } 
            100% { transform: rotate(15deg); }
          }
          @keyframes armsStrikeBalance {
            0% { transform: rotate(0deg); }
            30% { transform: rotate(15deg); } 
            100% { transform: rotate(-30deg); }
          }
          @keyframes ballRocketShot {
            0% { transform: translate(0px, 0px) scale(1); filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
            40% { transform: translate(10px, -80px) scale(1.6); filter: blur(0.5px); } 
            100% { transform: translate(25px, -280px) scale(4.5); opacity: 0; filter: blur(8px); } 
          }

          .player-rig { position: relative; width: 30px; height: 50px; }
          
          /* ⭕ CABEZA SOLO CON BORDE NEGRO (SIN RELLENO) ⭕ */
          .p-head { 
            position: absolute; top: -4px; left: 3px; width: 17px; height: 17px; 
            border: 2.5px solid #000; border-radius: 50%; background: transparent; z-index: 10;
          }
          .p-torso { 
            position: absolute; top: 12px; left: 11px; width: 4px; height: 17px; 
            background: #000; border-radius: 2px; z-index: 5; transform-origin: top center;
          }
          .p-arm-l, .p-arm-r { 
            position: absolute; top: 13px; left: 11px; width: 3px; height: 13px; 
            background: #000; border-radius: 2px; transform-origin: top center; 
          }
          .p-leg-l, .p-leg-r { 
            position: absolute; top: 27px; left: 11px; width: 3.5px; height: 17px; 
            background: #000; border-radius: 2px; transform-origin: top center; 
          }
          .p-ball { 
            position: absolute; bottom: 2px; right: -8px; width: 10px; height: 10px; 
            background: #000; border: 2px solid #fff; border-radius: 50%; z-index: 15;
            box-shadow: 0 0 6px rgba(0,0,0,0.3);
          }

          .state-dribbling { animation: bodyBounce 0.45s infinite ease-in-out; }
          .state-dribbling .p-arm-l { animation: runArmLeft 0.45s infinite ease-in-out; z-index: 7; }
          .state-dribbling .p-arm-r { animation: runArmRight 0.45s infinite ease-in-out; z-index: 3; opacity: 0.7; }
          .state-dribbling .p-leg-l { animation: runLegLeft 0.45s infinite ease-in-out; z-index: 7; }
          .state-dribbling .p-leg-r { animation: runLegRight 0.45s infinite ease-in-out; z-index: 3; opacity: 0.7; }
          .state-dribbling .p-ball  { animation: ballDribbleReal 0.45s infinite ease-in-out; }

          .state-shooting { animation: realKickBody 0.6s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
          .state-shooting .p-arm-l { animation: armsStrikeBalance 0.6s forwards; }
          .state-shooting .p-arm-r { transform: rotate(45deg); }
          .state-shooting .p-leg-l { animation: realKickLeg 0.6s forwards cubic-bezier(0.1, 0.9, 0.2, 1); z-index: 10; }
          .state-shooting .p-leg-r { animation: supportLegPlant 0.6s forwards; }
          .state-shooting .p-ball  { animation: ballRocketShot 0.6s forwards cubic-bezier(0.1, 1, 0.2, 1); }

          .state-after-goal { opacity: 0.15; filter: blur(1px); transform: translateY(-4px) rotate(-5deg) scale(0.95); transition: all 0.5s ease; }
          .state-after-goal .p-leg-l { transform: rotate(-90deg); }
          .state-after-goal .p-leg-r { transform: rotate(20deg); }
          .state-after-goal .p-arm-l { transform: rotate(-40deg); }
          .state-after-goal .p-ball  { opacity: 0; }
        `}
      </style>

      {/* --- EFECTO DE NIEVE CAYENDO --- */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {[...Array(25)].map((_, i) => {
          const randomLeft = Math.random() * 100;
          const randomAnimDuration = 2 + Math.random() * 3;
          const randomDelay = Math.random() * 3;
          const randomSize = 4 + Math.random() * 5;
          return (
            <div
              key={i}
              className="snowflake"
              style={{
                left: `${randomLeft}%`,
                width: `${randomSize}px`,
                height: `${randomSize}px`,
                animationDuration: `${randomAnimDuration}s`,
                animationDelay: `${randomDelay}s`,
              }}
            />
          );
        })}
      </div>

      {/* --- LÍNEAS DE CANCHA EN EL FONDO --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none pitch-lines">
        <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full border-2 border-green-700/30 flex items-center justify-center relative">
          <div className="w-3 h-3 bg-red-600 rounded-full shadow-md shadow-red-500/50"></div>
          <div className="absolute w-[150vw] h-[2px] bg-green-700/30"></div>
        </div>
      </div>

      {/* --- BARRA SUPERIOR CON EL MENSAJE NAVIDEÑO FIJO --- */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center text-[11px] sm:text-xs tracking-[0.2em] uppercase font-bold text-gray-400 z-10 border-b border-gray-200 pb-3 gap-2">
        <div className="flex items-center gap-2">
       
          
        </div>
        
        {/* Mensaje fijo arriba */}
        <span className="text-green-600 font-black tracking-widest drop-shadow-sm animate-pulse text-left">
          ChemaSportER te desea una feliz navidad
        </span>

        
      </div>

      {/* --- CENTRO: MARCO DE LA PORTERÍA Y TÍTULO --- */}
      <div className={`flex flex-col items-center justify-center my-auto w-full text-center relative transition-all duration-300 ${cinePhase >= 2 ? 'animate-net-goal' : ''}`}>
        
        <div className={`absolute w-[280px] sm:w-[420px] md:w-[560px] h-[160px] sm:h-[220px] border-[6px] sm:border-[8px] border-red-600 rounded-t-xl bg-white/40 backdrop-blur-[2px] pointer-events-none flex items-center justify-center transition-all duration-500 shadow-2xl shadow-red-600/10 ${
          cinePhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#dc2626_1px,transparent_1px)] [background-size:12px_12px]"></div>
        </div>

        {cinePhase >= 2 && (
          <div className="absolute w-32 h-32 rounded-full border-2 border-red-500 pointer-events-none animate-shockwave"></div>
        )}

        {cinePhase >= 2 && (
          <div className="animate-goal-slam flex flex-col items-center relative z-25">
            <h1 className="text-red-600 text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter uppercase leading-none drop-shadow-sm">
              CHEMA
            </h1>
            <h1 className="text-transparent bg-clip-text bg-gradient-to-b from-black to-green-700 text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter uppercase leading-none -mt-1 sm:-mt-3 md:-mt-4">
              SPORT
            </h1>
          </div>
        )}

        {cinePhase >= 3 && (
          <div className="animate-badge mt-4 md:mt-5 z-25">
            <div className="inline-flex items-center justify-center gap-4 bg-green-700 text-white px-6 py-1.5 sm:px-8 sm:py-2 rounded-full shadow-lg border border-green-600">
              <span className="font-black text-lg sm:text-2xl md:text-3xl tracking-[0.35em] uppercase pl-[0.35em]">
                ER
              </span>
            </div>
          </div>
        )}
      </div>

      {/* --- INFERIOR: JUGADOR CABEZÓN Y BARRA DE CARGA --- */}
      <div className="w-full max-w-xl flex flex-col gap-2 relative pb-4 z-20">
        
        <div 
          className="absolute bottom-16 origin-bottom z-10 will-change-[left,transform]"
          style={{ left: `${playerPosition}%`, transform: 'translateX(-50%) scale(2.2)' }}
        >
          <div className={`player-rig ${
            cinePhase === 0 ? 'state-dribbling' : 
            cinePhase === 1 ? 'state-shooting' : 'state-after-goal'
          }`}>
            <div className="p-head"></div>
            <div className="p-torso"></div>
            <div className="p-arm-l"></div>
            <div className="p-arm-r"></div>
            <div className="p-leg-l"></div>
            <div className="p-leg-r"></div>
            <div className="p-ball"></div>
          </div>
        </div>

        <div className="flex justify-between items-end text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500 mt-10">
          <span className="text-green-700 font-bold">
            {cinePhase === 0 && 'Avanzando con calma...'}
            {cinePhase === 1 && '¡Zapatazo festivo!'}
            {cinePhase >= 2 && '¡GOL! ¡Feliz Navidad!'}
          </span>
          <span className="font-mono text-red-600 font-black text-sm sm:text-base">
            {Math.floor(progress)}%
          </span>
        </div>

        <div className="w-full h-[4px] bg-gray-100 overflow-hidden relative rounded-full border border-gray-200 shadow-inner">
          <div 
            className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-red-600 to-green-700 will-change-[width]"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default IntroLoader;