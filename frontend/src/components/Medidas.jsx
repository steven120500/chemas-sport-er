import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaWhatsapp, FaSearchPlus, FaSearchMinus } from "react-icons/fa";

// ⚠️ Estilos en index.css (sección "GUÍA DE TALLAS", clases gt-*).

/* =========================================================================
   🔥 CATÁLOGO DE MEDIDAS 🔥  (imágenes en /public/medidas)
========================================================================= */
const CATALOG = [
  // --- VERSIONES ESTÁNDAR ---
  { id: "player", tags: ["Player"], label: "Player", img: "/medidas/Player.jpeg", subtitle: "Corte ajustado, pegado al cuerpo" },
  { id: "fan", tags: ["Fan"], label: "Fan", img: "/medidas/Fan.jpeg", subtitle: "Corte recto y cómodo" },
  { id: "retro", tags: ["Retro"], label: "Retro", img: "/medidas/Retro.jpeg", subtitle: "Corte clásico holgado" },
  { id: "nacional", tags: ["Nacional"], label: "Nacional", img: "/medidas/Nacional.jpeg", subtitle: "Selección Nacional adulto" },

  // --- MUJER ---
  { id: "mujer", tags: ["Mujer"], label: "Mujer", img: "/medidas/Mujer.jpeg", subtitle: "Corte con silueta femenina" },
  { id: "mujer-nacional", tags: ["Mujer", "Nacional"], label: "Nacional Mujer", img: "/medidas/Nacional_Mujer.jpeg", subtitle: "Selección Nacional corte femenino" },

  // --- NIÑO ---
  { id: "nino-futbol", tags: ["Niño"], label: "Niño", img: "/medidas/Nino.jpeg", subtitle: "Fútbol, corte estándar para niños" },
  { id: "nino-nacional", tags: ["Niño", "Nacional"], label: "Nacional Niño", img: "/medidas/Nacional_Nino.jpeg", subtitle: "Selección Nacional para niños" },
  { id: "nino-nba", tags: ["Niño", "NBA"], label: "NBA Niño", img: "/medidas/NBA_Nino.jpeg", subtitle: "Baloncesto para niños" },
  { id: "mamelucos", tags: ["Niño"], label: "Mamelucos", img: "/medidas/Mamelucos.jpeg", subtitle: "Tallas para bebés" },

  // --- OTROS DEPORTES ---
  { id: "nba", tags: ["NBA"], label: "NBA", img: "/medidas/NBA.jpeg", subtitle: "Baloncesto adulto" },
  { id: "nfl", tags: ["NFL"], label: "NFL", img: "/medidas/NFL.jpeg", subtitle: "Fútbol americano" },
  { id: "mlb", tags: ["MLB"], label: "MLB", img: "/medidas/MLB.jpeg", subtitle: "Camisolas de béisbol" },
  { id: "f1", tags: ["F1"], label: "Fórmula 1", img: "/medidas/F1.jpeg", subtitle: "Corte casual F1" },

  // --- ABRIGOS Y CONJUNTOS ---
  { id: "abrigo-full", tags: ["Abrigos"], label: "Abrigo Full Zip", img: "/medidas/Abrigo_Pantalon.jpeg", subtitle: "Chaqueta completa y pantalón" },
  { id: "abrigo-media", tags: ["Abrigos"], label: "Media Cremallera", img: "/medidas/AbrigoMedia_Pantalon.jpeg", subtitle: "Chaqueta de media cremallera y pantalón" },
];

const STEPS = [
  { n: 1, title: "Tomá una camiseta tuya", text: "Una que te quede como te gusta, extendida sobre una superficie plana." },
  { n: 2, title: "Medí el pecho", text: "De axila a axila, en línea recta. Ese es el valor de “Pecho”." },
  { n: 3, title: "Compará con la tabla", text: "Si quedás entre dos tallas, elegí la más grande. La versión Player es más ajustada." },
];

const WHATSAPP = "https://wa.me/50660369857?text=" + encodeURIComponent("Hola! Tengo una duda con las tallas 🙌");

export default function Medidas({ open, onClose, currentType = "Todos" }) {
  // Las guías que aplican a la categoría actual van primero
  const ordered = useMemo(() => {
    const match = CATALOG.filter((c) => c.tags.includes(currentType));
    const rest = CATALOG.filter((c) => !c.tags.includes(currentType));
    return { list: [...match, ...rest], matchCount: match.length };
  }, [currentType]);

  const [activeId, setActiveId] = useState(ordered.list[0]?.id);
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  const active = CATALOG.find((c) => c.id === activeId) || ordered.list[0];

  useEffect(() => {
    if (!open) return;
    setActiveId(ordered.list[0]?.id);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setZoomed(false);
    setImgError(false);
  }, [activeId]);

  const modal = (
    <AnimatePresence>
      {open && (
        <div className="gt-layer" role="dialog" aria-modal="true" aria-label="Guía de tallas">
          <motion.div
            className="gt-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="gt-modal"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Encabezado */}
            <div className="gt-head">
              <div>
                <span className="gt-eyebrow">Guía de tallas</span>
                <h2 className="gt-title">Encontrá tu talla</h2>
              </div>
              <button type="button" className="gt-close" onClick={onClose} aria-label="Cerrar">
                <FaTimes />
              </button>
            </div>

            {/* Tabs de tipo de prenda */}
            <div className="gt-tabs" role="tablist">
              {ordered.list.map((c, i) => {
                const isActive = c.id === active?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`gt-tab ${isActive ? "is-active" : ""} ${i < ordered.matchCount ? "is-match" : ""}`}
                    onClick={() => setActiveId(c.id)}
                  >
                    {isActive && (
                      <motion.span layoutId="gt-tab-pill" className="gt-tab-pill" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                    )}
                    <span className="gt-tab-label">{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cuerpo */}
            <div className="gt-body">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active?.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="gt-chart-head">
                    <div>
                      <h3>{active?.label}</h3>
                      <p>{active?.subtitle}</p>
                    </div>
                    {!imgError && (
                      <button type="button" className="gt-zoom-btn" onClick={() => setZoomed((z) => !z)}>
                        {zoomed ? <FaSearchMinus /> : <FaSearchPlus />}
                        <span>{zoomed ? "Reducir" : "Ampliar"}</span>
                      </button>
                    )}
                  </div>

                  <div className={`gt-chart ${zoomed ? "is-zoomed" : ""}`}>
                    {imgError ? (
                      <p className="gt-chart-error">Imagen en mantenimiento</p>
                    ) : (
                      <img
                        src={active?.img}
                        alt={`Tabla de medidas ${active?.label}`}
                        onClick={() => setZoomed((z) => !z)}
                        onError={() => setImgError(true)}
                        draggable={false}
                      />
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Cómo medir */}
              <div className="gt-howto">
                <h4>¿Cómo medir?</h4>
                <ol>
                  {STEPS.map((s, i) => (
                    <motion.li
                      key={s.n}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                    >
                      <span className="gt-step-n">{s.n}</span>
                      <div>
                        <strong>{s.title}</strong>
                        <p>{s.text}</p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </div>

              <a className="gt-help" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp />
                <span>
                  ¿Todavía con dudas? <b>Escribinos y te ayudamos</b>
                </span>
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
