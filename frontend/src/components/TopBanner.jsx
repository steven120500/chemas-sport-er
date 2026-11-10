import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ⚠️ Estilos en index.css (sección "TOP BANNER", clases tb-*).

const messages = [
  "Stock de +7000 chemas",
  "Regalamos chemas los viernes en el ChemaFest",
  "Pagá con SINPE, transferencia, efectivo o tarjeta",
  "Envíos a todo el país",
  "Somos ChemaSport ER",
];

function TopBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIndex((i) => (i + 1) % messages.length), 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="tb" role="status" aria-live="polite">
      <span className="tb-star" aria-hidden="true">✦</span>
      <div className="tb-track">
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            className="tb-msg"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {messages[index]}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="tb-star" aria-hidden="true">✦</span>
    </div>
  );
}

export default TopBanner;
