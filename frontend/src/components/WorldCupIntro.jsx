import React, { useState, useEffect } from 'react';

const IntroLoader = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [fadeIntro, setFadeIntro] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cinePhase, setCinePhase] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    let animationFrameId;
    const startTime = performance.now();
    const duration = 2000;

    const updateProgress = (currentTime) => {
      const elapsed = currentTime - startTime;
      const currentProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(currentProgress);

      if (currentProgress < 100) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);
    
    // TIMELINE DE LA JUGADA Y EL GOL
    const t1 = setTimeout(() => setCinePhase(1), 1700); // Remate al arco
    const t2 = setTimeout(() => setCinePhase(2), 2050); // ¡Gol! Impacto en la red y aparece CHEMA SPORT
    const t3 = setTimeout(() => setCinePhase(3), 2300); // Aparece ER
    
    const fadeTimer = setTimeout(() => setFadeIntro(true), 3100); 
    const endTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = 'auto';
      if (onFinished) onFinished();
    }, 3800);

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

  const startX = 12;
  const playerPosition = Math.min(startX + (progress * 0.38), 50);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between px-6 py-10 transition-all duration-700 ease-out select-none ${
        fadeIntro ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      } bg-white text-black overflow-hidden font-sans`} 
    >
      <style>
        {`
          @keyframes pulsePitch {
            0%, 100% { opacity: 0.03; transform: scale(1); }
            50% { opacity: 0.07; transform: scale(1.02); }
          }
          .pitch-lines { animation: pulsePitch 4s infinite ease-in-out; }

          /* ⭐ ANIMACIÓN DE LA RED DE LA PORTERÍA AL RECIBIR EL GOL ⭐ */
          @keyframes netImpact {
            0% { transform: scale(1); }
            30% { transform: scale(1.04) translateY(-4px); filter: drop-shadow(0 15px 10px rgba(0,0,0,0.15)); }
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
            0% { transform: scale(0.2); opacity: 0.7; border-width: 6px; }
            100% { transform: scale(3.5); opacity: 0; border-width: 1px; }
          }
          .animate-shockwave { animation: shockwave 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          @keyframes badgeSlide {
            0% { opacity: 0; transform: translateY(15px) scale(0.9); letter-spacing: 0.8em; }
            100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.35em; }
          }
          .animate-badge { animation: badgeSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          /* Biomecánica de carrera */
          @keyframes bodyBounce {
            0%, 100% { transform: translateY(0px) rotate(12deg); }
            50% { transform: translateY(-4px) rotate(16deg); }
          }
          @keyframes runArmLeft {
            0%, 100% { transform: rotate(-40deg); }
            50% { transform: rotate(45deg); }
          }
          @keyframes runArmRight {
            0%, 100% { transform: rotate(45deg); }
            50% { transform: rotate(-40deg); }
          }
          @keyframes runLegLeft {
            0%, 100% { transform: rotate(-50deg); }
            50% { transform: rotate(40deg); }
          }
          @keyframes runLegRight {
            0%, 100% { transform: rotate(40deg); }
            50% { transform: rotate(-50deg); }
          }
          @keyframes ballDribbleReal {
            0%, 100% { transform: translate(-2px, 0px) rotate(0deg) scale(0.95); }
            25% { transform: translate(2px, -3px) rotate(90deg) scale(1); }
            50% { transform: translate(-1px, 1px) rotate(180deg) scale(0.95); }
            75% { transform: translate(4px, -2px) rotate(270deg) scale(1.02); }
          }

          @keyframes realKickBody {
            0% { transform: translateY(0) rotate(12deg); }
            25% { transform: translateY(2px) rotate(25deg); } 
            60% { transform: translateY(-8px) rotate(-10deg); } 
            100% { transform: translateY(-4px) rotate(-5deg); }
          }
          @keyframes realKickLeg {
            0% { transform: rotate(20deg); }
            25% { transform: rotate(75deg); } 
            55% { transform: rotate(-130deg); } 
            100% { transform: rotate(-90deg); }
          }
          @keyframes supportLegPlant {
            0% { transform: rotate(-10deg); }
            30% { transform: rotate(25deg); filter: drop-shadow(2px 0 0 rgba(0,0,0,0.2)); } 
            100% { transform: rotate(20deg); }
          }
          @keyframes armsStrikeBalance {
            0% { transform: rotate(0deg); }
            30% { transform: rotate(20deg); } 
            100% { transform: rotate(-40deg); }
          }
          @keyframes ballRocketShot {
            0% { transform: translate(0px, 0px) scale(1); filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
            40% { transform: translate(10px, -80px) scale(1.6); filter: blur(0.5px); } 
            100% { transform: translate(25px, -280px) scale(4.5); opacity: 0; filter: blur(8px); } 
          }

          .player-rig { position: relative; width: 26px; height: 48px; }
          .p-head { 
            position: absolute; top: -1px; left: 6px; width: 13px; height: 13px; 
            border: 2.5px solid #000; border-radius: 50%; background: #fff; z-index: 10;
            box-shadow: 0 0 6px rgba(0,0,0,0.15);
          }
          .p-torso { 
            position: absolute; top: 11px; left: 10px; width: 3.5px; height: 17px; 
            background: #000; border-radius: 2px; z-index: 5; transform-origin: top center;
          }
          .p-arm-l, .p-arm-r { 
            position: absolute; top: 12px; left: 10px; width: 2.5px; height: 13px; 
            background: #3f3f46; border-radius: 2px; transform-origin: top center; 
          }
          .p-leg-l, .p-leg-r { 
            position: absolute; top: 26px; left: 10px; width: 3.2px; height: 17px; 
            background: #000; border-radius: 2px; transform-origin: top center; 
          }
          .p-ball { 
            position: absolute; bottom: 2px; right: -8px; width: 10px; height: 10px; 
            background: #000; border: 2px solid #fff; border-radius: 50%; z-index: 15;
            box-shadow: 0 0 6px rgba(0,0,0,0.3);
          }

          .state-dribbling { animation: bodyBounce 0.28s infinite ease-in-out; }
          .state-dribbling .p-arm-l { animation: runArmLeft 0.28s infinite ease-in-out; z-index: 7; }
          .state-dribbling .p-arm-r { animation: runArmRight 0.28s infinite ease-in-out; z-index: 3; opacity: 0.7; }
          .state-dribbling .p-leg-l { animation: runLegLeft 0.28s infinite ease-in-out; z-index: 7; }
          .state-dribbling .p-leg-r { animation: runLegRight 0.28s infinite ease-in-out; z-index: 3; opacity: 0.7; }
          .state-dribbling .p-ball  { animation: ballDribbleReal 0.28s infinite ease-in-out; }

          .state-shooting { animation: realKickBody 0.4s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
          .state-shooting .p-arm-l { animation: armsStrikeBalance 0.4s forwards; }
          .state-shooting .p-arm-r { transform: rotate(45deg); }
          .state-shooting .p-leg-l { animation: realKickLeg 0.4s forwards cubic-bezier(0.1, 0.9, 0.2, 1); z-index: 10; }
          .state-shooting .p-leg-r { animation: supportLegPlant 0.4s forwards; }
          .state-shooting .p-ball  { animation: ballRocketShot 0.42s forwards cubic-bezier(0.1, 1, 0.2, 1); }

          .state-after-goal { opacity: 0.15; filter: blur(1px); transform: translateY(-4px) rotate(-5deg) scale(0.95); transition: all 0.5s ease; }
          .state-after-goal .p-leg-l { transform: rotate(-90deg); }
          .state-after-goal .p-leg-r { transform: rotate(20deg); }
          .state-after-goal .p-arm-l { transform: rotate(-40deg); }
          .state-after-goal .p-ball  { opacity: 0; }
        `}
      </style>

      {/* --- LÍNEAS DE CANCHA EN EL FONDO --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none pitch-lines">
        <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full border-2 border-gray-300 flex items-center justify-center relative">
          <div className="w-3 h-3 bg-black rounded-full"></div>
          <div className="absolute w-[150vw] h-[2px] bg-gray-300"></div>
        </div>
      </div>

      {/* --- BARRA SUPERIOR --- */}
      <div className="w-full max-w-5xl flex justify-between items-center text-[11px] sm:text-xs tracking-[0.25em] uppercase font-bold text-gray-400 z-10 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-black"></span>
          <span className="text-black font-black">CHEMA SPORT ER</span>
        </div>
        <span>PAGINA OFICIAL</span>
      </div>

      {/* --- CENTRO: MARCO DE LA PORTERÍA Y TÍTULO --- */}
      <div className={`flex flex-col items-center justify-center my-auto w-full text-center relative transition-all duration-300 ${cinePhase >= 2 ? 'animate-net-goal' : ''}`}>
        
        {/* 🔥 EL MARCO DE LA PORTERÍA (Aparece y enmarca la marca al hacer gol) 🔥 */}
        <div className={`absolute w-[280px] sm:w-[420px] md:w-[560px] h-[160px] sm:h-[220px] border-[6px] sm:border-[8px] border-black rounded-t-xl bg-gray-black backdrop-blur-[2px] pointer-events-none flex items-center justify-center transition-all duration-500 shadow-2xl ${
          cinePhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}>
          {/* Simulación visual sutil de la red dentro del marco */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px]"></div>
        </div>

        {cinePhase >= 2 && (
          <div className="absolute w-32 h-32 rounded-full border border-black pointer-events-none animate-shockwave"></div>
        )}

        {cinePhase >= 2 && (
          <div className="animate-goal-slam flex flex-col items-center relative z-20">
            <h1 className="text-black text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter uppercase leading-none drop-shadow-md">
              CHEMA
            </h1>
            <h1 className="text-transparent bg-clip-text bg-gradient-to-b from-black to-gray-500 text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter uppercase leading-none -mt-1 sm:-mt-3 md:-mt-4">
              SPORT
            </h1>
          </div>
        )}

        {cinePhase >= 3 && (
          <div className="animate-badge mt-4 md:mt-5 z-20">
            <div className="inline-flex items-center justify-center gap-4 bg-black text-white px-6 py-1.5 sm:px-8 sm:py-2 rounded-full shadow-lg">
              <span className="font-black text-lg sm:text-2xl md:text-3xl tracking-[0.35em] uppercase pl-[0.35em]">
                ER
              </span>
            </div>
          </div>
        )}
      </div>

      {/* --- INFERIOR: JUGADOR Y BARRA DE CARGA --- */}
      <div className="w-full max-w-xl flex flex-col gap-2 relative pb-4 z-20">
        <div 
          className="absolute bottom-16 origin-bottom z-10 will-change-[left,transform]"
          style={{ left: `${playerPosition}%`, transform: 'translateX(-50%) scale(2.4)' }}
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
          <span>
            {cinePhase === 0 && 'Saltando a la cancha...'}
            {cinePhase === 1 && '¡Zapatazo al arco!'}
            {cinePhase >= 2 && '¡GOL! Catálogo listo'}
          </span>
          <span className="font-mono text-black font-black text-sm sm:text-base">
            {Math.floor(progress)}%
          </span>
        </div>

        <div className="w-full h-[4px] bg-gray-200 overflow-hidden relative rounded-full border border-gray-300">
          <div 
            className="absolute top-0 left-0 bottom-0 rounded-full bg-black will-change-[width]"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default IntroLoader;