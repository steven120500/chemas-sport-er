// src/components/ModalShell.jsx
// 🔥 Contenedor común de modales: fondo difuminado, tarjeta, encabezado, cuerpo con scroll y pie fijo.
// ⚠️ Estilos en index.css (sección "MODALES", clases md-*).
// - Móvil: bottom sheet que sube desde abajo. Desktop: tarjeta centrada.
// - Escape, click en el fondo y la X cierran con animación de salida.
// - Se renderiza con createPortal: el backdrop-filter / transform de un padre recortaría el position: fixed.
// - `children` y `footer` pueden ser funciones que reciben `close` (cierra con animación).
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FaTimes } from "react-icons/fa";

function useIsMobile() {
  const query = "(max-width: 639px)";
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isMobile;
}

export default function ModalShell({
  onClose,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  size = "md", // sm | md | lg
  footer,
  children,
  closeOnBackdrop = true,
  hideClose = false,
  dismissible = true, // false: sin X, sin Escape y sin click en el fondo (obliga a elegir una opción)
  className = "",
  bodyClassName = "",
}) {
  const [visible, setVisible] = useState(true);
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();

  // 👈 Cierra con animación; onClose se llama al terminar la salida
  const close = useCallback(() => setVisible(false), []);

  // Bloquear scroll del fondo (restaura el valor anterior, por si hay modales anidados)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, dismissible]);

  const cardMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : {
        initial: { opacity: 0, y: 24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.98 },
      };

  const render = (slot) => (typeof slot === "function" ? slot(close) : slot);

  return createPortal(
    <AnimatePresence onExitComplete={() => onClose?.()}>
      {visible && (
        <div className="md-layer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
          <motion.div
            className="md-backdrop"
            onClick={dismissible && closeOnBackdrop ? close : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className={`md-card md-${size} ${className}`}
            {...cardMotion}
            transition={reduce ? { duration: 0.15 } : { type: "spring", damping: 30, stiffness: 340 }}
          >
            <span className="md-grabber" aria-hidden="true" />

            {(title || eyebrow) && (
              <header className="md-head">
                {Icon && (
                  <span className="md-head-icon" aria-hidden="true">
                    <Icon />
                  </span>
                )}
                <div className="md-head-text">
                  {eyebrow && <span className="md-eyebrow">{eyebrow}</span>}
                  {title && <h2 className="md-title">{title}</h2>}
                  {subtitle && <p className="md-subtitle">{subtitle}</p>}
                </div>
                {dismissible && !hideClose && (
                  <button type="button" className="md-close" onClick={close} aria-label="Cerrar">
                    <FaTimes />
                  </button>
                )}
              </header>
            )}

            <div className={`md-body ${bodyClassName}`}>{render(children)}</div>

            {footer && <footer className="md-foot">{render(footer)}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
