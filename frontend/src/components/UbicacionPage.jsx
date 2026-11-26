// src/components/UbicacionPage.jsx
// 📍 "¿Cómo llegar?" — imagen con los 4 pasos + botones de Waze y Google Maps.
// ⚠️ Estilos en index.css (sección "UBICACIÓN", clases ub-*). La imagen va en src/assets (no en public/: Cloudflare).
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaMapMarkerAlt, FaWaze, FaWhatsapp } from "react-icons/fa";
import comoLlegar from "../assets/ubicacion/como-llegar.webp";
import { DIRECCION_TIENDA, ZONA_TIENDA, WAZE_TIENDA, MAPS_TIENDA } from "../utils/tiendaFisica";

export default function UbicacionPage() {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <main className="ub">
      <button type="button" className="ub-back" onClick={() => navigate("/")}>
        <FaChevronLeft size={11} /> Volver al catálogo
      </button>

      <header className="ub-head">
        <span className="ub-eyebrow">Tienda física</span>
        <h1>¿Cómo llegar?</h1>
        <p><FaMapMarkerAlt /> {DIRECCION_TIENDA}, {ZONA_TIENDA}</p>
      </header>

      <div className="ub-actions">
        <a className="ub-btn is-waze" href={WAZE_TIENDA} target="_blank" rel="noopener noreferrer">
          <FaWaze /> Abrir en Waze
        </a>
        <a className="ub-btn" href={MAPS_TIENDA} target="_blank" rel="noopener noreferrer">
          <FaMapMarkerAlt /> Google Maps
        </a>
      </div>

      <img className="ub-img" src={comoLlegar} alt="Cómo llegar a ChemaSport ER: 1) ubicá la estación Delta, 2) avanzá 50 metros al oeste, 3) girá a la izquierda en la entrada, 4) ya estás aquí" width="1024" height="1536" />

      <a className="ub-wa" href="https://wa.me/50660369857?text=Hola!%20Quiero%20visitar%20la%20tienda" target="_blank" rel="noopener noreferrer">
        <FaWhatsapp /> ¿Te perdiste? Escribinos
      </a>
    </main>
  );
}
