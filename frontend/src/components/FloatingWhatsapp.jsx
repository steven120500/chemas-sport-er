import { FaWhatsapp } from 'react-icons/fa';

// ⚠️ Estilos en index.css (clase .fw-btn).
export default function FloatingWhatsapp({ show = true }) {
  if (!show) return null;

  return (
    <a
      href="https://wa.me/50660369857"
      target="_blank"
      rel="noopener noreferrer"
      className="fw-btn"
      title="Escribinos por WhatsApp"
      aria-label="Escribinos por WhatsApp"
    >
      <FaWhatsapp />
      <span className="fw-label">¿Dudas? Escribinos</span>
    </a>
  );
}
