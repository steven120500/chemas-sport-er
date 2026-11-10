import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SantaHat from './SantaHat';

// 🎄 INTRO NAVIDEÑA "GOL NAVIDEÑO" (motion graphics con framer-motion)
// Estilos en index.css (sección "INTRO NAVIDEÑA", clases xi-*).
// Se muestra una vez por sesión (sessionStorage.chemasport_intro_shown).

const SESSION_KEY = 'chemasport_intro_shown';

// Línea de tiempo (ms)
const T = {
  kick: 1500,   // remate: el balón sale hacia la cámara
  logo: 1950,   // explosión + aparece CHEMA SPORT
  er: 2600,     // badge ER
  greet: 2850,  // Feliz Navidad
  exit: 4300,   // empieza la salida
};
const EXIT_MS = 600;
const TOTAL_MS = T.exit + EXIT_MS;

const COLORS = ['#dc2626', '#16a34a', '#F5C400', '#ffffff'];

// Random determinístico para que la nieve no "salte" entre renders
const seeded = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/* ---------- Piezas SVG ---------- */
const PENTA = (cx, cy, r, rot = -90) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rot + k * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

function SoccerBall() {
  const outer = Array.from({ length: 5 }, (_, k) => {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    return { x: 50 + 46 * Math.cos(a), y: 50 + 46 * Math.sin(a), vx: 50 + 17 * Math.cos(a), vy: 50 + 17 * Math.sin(a), ox: 50 + 33 * Math.cos(a), oy: 50 + 33 * Math.sin(a), rot: -90 + k * 72 + 180 };
  });
  return (
    <svg viewBox="0 0 100 100" className="xi-ball-svg" aria-hidden="true">
      <defs>
        <clipPath id="xi-ball-clip"><circle cx="50" cy="50" r="47" /></clipPath>
        <radialGradient id="xi-ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#9ca3af" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#xi-ball-shade)" />
      <g clipPath="url(#xi-ball-clip)" fill="#111" stroke="#111" strokeWidth="2" strokeLinejoin="round">
        <polygon points={PENTA(50, 50, 16)} />
        {outer.map((o, i) => (
          <g key={i}>
            <line x1={o.vx} y1={o.vy} x2={o.ox} y2={o.oy} />
            <polygon points={PENTA(o.x, o.y, 15, o.rot)} />
          </g>
        ))}
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#111" strokeWidth="2.5" />
    </svg>
  );
}

function Star({ color }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill={color} />
    </svg>
  );
}

/* ---------- Guirnalda de luces ---------- */
function Garland() {
  const SWAGS = 4;
  const BULBS_PER_SWAG = 6;
  const SAG = 46; // px de caída de cada curva

  const wire = Array.from({ length: SWAGS }, (_, s) => {
    const x0 = (s / SWAGS) * 1000;
    const x1 = ((s + 1) / SWAGS) * 1000;
    return `M${x0},4 Q${(x0 + x1) / 2},${SAG * 2 - 4} ${x1},4`;
  }).join(' ');

  const bulbs = [];
  for (let s = 0; s < SWAGS; s++) {
    for (let b = 1; b < BULBS_PER_SWAG; b++) {
      const f = b / BULBS_PER_SWAG;
      // curva cuadrática: y = 4 + 2*(SAG*2-8)*f*(1-f)
      const y = 4 + 2 * (SAG * 2 - 8) * f * (1 - f);
      bulbs.push({ left: ((s + f) / SWAGS) * 100, top: y, color: COLORS[(s * BULBS_PER_SWAG + b) % 4], i: bulbs.length });
    }
  }

  return (
    <motion.div
      className="xi-garland"
      initial={{ y: -110 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 90, damping: 12, delay: 0.1 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="xi-garland-wire">
        <path d={wire} fill="none" stroke="#1f2937" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {bulbs.map((b) => (
        <span
          key={b.i}
          className="xi-bulb"
          style={{ left: `${b.left}%`, top: `${b.top}px`, '--bulb': b.color, animationDelay: `${(b.i % 5) * 0.28}s` }}
        />
      ))}
    </motion.div>
  );
}

/* ---------- Nieve en 3 capas (parallax) ---------- */
function Snow() {
  const flakes = useMemo(() => {
    const rnd = seeded(7);
    const layers = [
      { count: 26, size: [2, 3], dur: [9, 13], blur: 1, opacity: 0.45 },
      { count: 18, size: [3, 5], dur: [6, 9], blur: 0, opacity: 0.75 },
      { count: 8, size: [6, 9], dur: [4, 6], blur: 2, opacity: 0.9 },
    ];
    return layers.flatMap((l, li) =>
      Array.from({ length: l.count }, (_, i) => {
        const size = l.size[0] + rnd() * (l.size[1] - l.size[0]);
        const dur = l.dur[0] + rnd() * (l.dur[1] - l.dur[0]);
        return {
          key: `${li}-${i}`,
          left: rnd() * 100,
          size,
          dur,
          delay: -rnd() * dur, // negativo: ya está nevando al abrir
          drift: (rnd() - 0.5) * 80,
          blur: l.blur,
          opacity: l.opacity,
        };
      })
    );
  }, []);

  return (
    <div className="xi-snow" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.key}
          className="xi-flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            filter: f.blur ? `blur(${f.blur}px)` : undefined,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Explosión de estrellas ---------- */
function Burst() {
  const parts = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: 30 }, (_, i) => {
      const angle = (i / 30) * Math.PI * 2 + rnd() * 0.3;
      const dist = 140 + rnd() * 260;
      return {
        i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 8 + rnd() * 14,
        rotate: rnd() * 360,
        color: COLORS[i % 4],
        star: i % 3 !== 0,
        delay: rnd() * 0.08,
      };
    });
  }, []);

  return (
    <div className="xi-burst" aria-hidden="true">
      <motion.span
        className="xi-ring"
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 7, opacity: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
      {parts.map((p) => (
        <motion.span
          key={p.i}
          className="xi-particle"
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: [0, 1.2, 0], rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: 1.1, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        >
          {p.star ? <Star color={p.color} /> : <i className="xi-dot" style={{ background: p.color }} />}
        </motion.span>
      ))}
    </div>
  );
}

/* ---------- Texto letra por letra ---------- */
const lettersParent = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const letter = {
  hidden: { y: 70, opacity: 0, rotateX: -90 },
  show: { y: 0, opacity: 1, rotateX: 0, transition: { type: 'spring', stiffness: 380, damping: 22 } },
};

function Word({ text, className }) {
  return (
    <motion.span className={`xi-word ${className || ''}`} variants={lettersParent} initial="hidden" animate="show" aria-hidden="true">
      {text.split('').map((ch, i) => (
        <motion.span key={i} variants={letter} className="xi-letter">
          {ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

/* =================================================================== */
const IntroLoader = ({ onFinished }) => {
  const reduceMotion = useReducedMotion();
  const [visible] = useState(() => {
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState(0); // 0 caída · 1 remate · 2 logo · 3 ER · 4 saludo · 5 salida

  // Guardamos onFinished en un ref: App lo pasa inline y no queremos reiniciar los timers en cada render
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    document.body.style.overflow = '';
    onFinishedRef.current?.();
  };

  useEffect(() => {
    if (!visible || reduceMotion) {
      finish();
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch {
      /* modo privado: no pasa nada */
    }
    document.body.style.overflow = 'hidden';

    const timers = [
      setTimeout(() => setPhase(1), T.kick),
      setTimeout(() => setPhase(2), T.logo),
      setTimeout(() => setPhase(3), T.er),
      setTimeout(() => setPhase(4), T.greet),
      setTimeout(() => setPhase(5), T.exit),
      setTimeout(finish, TOTAL_MS + 100), // respaldo por si no dispara onAnimationComplete
    ];

    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible || reduceMotion) return null;

  const skip = () => setPhase(5);

  return (
    <motion.div
      className="xi-root"
      role="dialog"
      aria-label="ChemaSport ER te desea feliz Navidad"
      initial={{ opacity: 0 }}
      animate={phase === 5 ? { opacity: 0, scale: 1.04, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: phase === 5 ? EXIT_MS / 1000 : 0.4, ease: 'easeInOut' }}
      onAnimationComplete={() => {
        if (phase === 5) finish();
      }}
    >
      <div className="xi-bg" aria-hidden="true" />
      <Snow />
      <Garland />

      {/* Halo dorado detrás del logo */}
      <motion.div
        className="xi-halo"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="xi-stage">
        {/* ⚽ BALÓN CON GORRO: cae, rebota y sale disparado */}
        {phase < 2 && (
          <>
            <motion.span
              className="xi-shadow"
              aria-hidden="true"
              initial={{ scaleX: 0.2, opacity: 0 }}
              animate={
                phase === 0
                  ? { scaleX: [0.2, 1, 0.55, 1, 0.85, 1], opacity: [0, 0.5, 0.25, 0.5, 0.4, 0.5] }
                  : { scaleX: 0.2, opacity: 0 }
              }
              transition={phase === 0 ? { duration: 1.3, delay: 0.15, times: [0, 0.3, 0.5, 0.68, 0.82, 0.92] } : { duration: 0.2 }}
            />
            {/* Contenedor: caída con rebotes (squash & stretch) */}
            <motion.div
              className="xi-ball"
              initial={{ y: -480, scaleX: 0.92, scaleY: 1.1 }}
              animate={
                phase === 0
                  ? {
                      y: [-480, 0, -130, 0, -38, 0],
                      scaleY: [1.1, 0.78, 1.06, 0.88, 1, 1],
                      scaleX: [0.92, 1.2, 0.96, 1.1, 1, 1],
                    }
                  : { y: 0, scaleX: 1, scaleY: 1 }
              }
              transition={
                phase === 0
                  ? { duration: 1.3, delay: 0.15, times: [0, 0.3, 0.5, 0.68, 0.82, 0.92], ease: ['easeIn', 'easeOut', 'easeIn', 'easeOut', 'easeIn'] }
                  : { duration: 0 }
              }
            >
              {/* Balón: gira al caer y sale disparado hacia la cámara en el remate */}
              <motion.div
                className="xi-ball-core"
                initial={{ rotate: -40 }}
                animate={
                  phase === 0
                    ? { rotate: [-40, 0, 20, 30, 36, 36] }
                    : { y: -60, scale: 14, rotate: 400, opacity: [1, 1, 0] }
                }
                transition={
                  phase === 0
                    ? { duration: 1.3, delay: 0.15, times: [0, 0.3, 0.5, 0.68, 0.82, 0.92] }
                    : { duration: 0.5, ease: [0.7, 0, 0.84, 0] }
                }
              >
                <SoccerBall />
              </motion.div>

              {/* Gorro de Santa: sale volando con el remate */}
              <motion.div
                className="xi-hat"
                initial={{ rotate: -14 }}
                animate={phase === 1 ? { x: 160, y: -320, rotate: 260, opacity: 0 } : { x: 0, y: 0, rotate: -14 }}
                transition={phase === 1 ? { duration: 0.8, ease: 'easeOut' } : { duration: 0 }}
              >
                <SantaHat className="xi-hat-svg" />
              </motion.div>
            </motion.div>
          </>
        )}

        {/* 💥 Destello + explosión */}
        {phase >= 2 && (
          <>
            <motion.div
              className="xi-flash"
              aria-hidden="true"
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
            <Burst />
          </>
        )}

        {/* 🔤 LOGO */}
        {phase >= 2 && (
          <div className="xi-logo">
            <Word text="CHEMA" className="xi-word--red" />
            <Word text="SPORT" />
            <span className="sr-only">ChemaSport ER</span>

            {phase >= 3 && (
              <motion.span
                className="xi-er"
                initial={{ scale: 0, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: -4, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14 }}
              >
                ER
              </motion.span>
            )}

            {phase >= 4 && (
              <motion.p
                className="xi-greet"
                initial={{ opacity: 0, letterSpacing: '0.9em', y: 10 }}
                animate={{ opacity: 1, letterSpacing: '0.32em', y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                ✦ Feliz Navidad ✦
              </motion.p>
            )}
          </div>
        )}
      </div>

      {/* Barra de progreso + saltar */}
      <div className="xi-footer">
        <div className="xi-progress" aria-hidden="true">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: T.exit / 1000, ease: 'linear' }}
          />
        </div>
        <button type="button" className="xi-skip" onClick={skip}>
          Saltar intro
        </button>
      </div>
    </motion.div>
  );
};

export default IntroLoader;
