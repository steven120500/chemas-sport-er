// src/components/ComoLlegarHome.jsx
// 📍 Franja "¿Cómo llegar?" en la portada, debajo de Bienvenido: los 4 pasos (recortados de la imagen de /ubicacion),
// dirección y botones de Waze / cómo llegar. ⚠️ Estilos en index.css (sección "CÓMO LLEGAR (portada)", clases cl-*).
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FaMapMarkerAlt, FaWaze, FaArrowRight } from "react-icons/fa";
import paso1 from "../assets/ubicacion/paso1.webp";
import paso2 from "../assets/ubicacion/paso2.webp";
import paso3 from "../assets/ubicacion/paso3.webp";
import paso4 from "../assets/ubicacion/paso4.webp";
import { DIRECCION_TIENDA, ZONA_TIENDA, WAZE_TIENDA } from "../utils/tiendaFisica";

const PASOS = [
  { src: paso1, alt: "Paso 1: ubicá la estación de servicio Delta" },
  { src: paso2, alt: "Paso 2: avanzá 50 metros hacia el oeste" },
  { src: paso3, alt: "Paso 3: girá a la izquierda en la entrada" },
  { src: paso4, alt: "Paso 4: ¡ya estás en ChemaSport ER!" },
];

export default function ComoLlegarHome() {
  const reduce = useReducedMotion();
  // 👇 Solo el texto sube; las fotos solo aparecen (en celular van en una tira con scroll que recortaría el "y")
  const entrada = (i, sube = true) => reduce ? {} : {
    initial: { opacity: 0, y: sube ? 24 : 0 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <section className="cl" aria-labelledby="cl-titulo">
      <div className="cl-card">
        <motion.div className="cl-info" {...entrada(0)}>
          <span className="cl-eyebrow"><FaMapMarkerAlt /> Tienda física · Grecia</span>
          <h2 id="cl-titulo">¿Cómo llegar?</h2>
          <p className="cl-dir">{DIRECCION_TIENDA}, <span>{ZONA_TIENDA}</span></p>
          <div className="cl-actions">
            <a className="cl-btn is-waze" href={WAZE_TIENDA} target="_blank" rel="noopener noreferrer">
              <FaWaze /> Abrir en Waze
            </a>
            <Link className="cl-btn" to="/ubicacion">
              Ver el camino <FaArrowRight />
            </Link>
          </div>
        </motion.div>

        <div className="cl-pasos">
          {PASOS.map((p, i) => (
            <motion.div key={p.src} {...entrada(i + 1, false)}>
              <Link to="/ubicacion" className="cl-paso" aria-label={p.alt}>
                <img src={p.src} alt={p.alt} loading="lazy" width="400" height="390" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
