// src/components/LoadingOverlay.jsx
// ⚠️ Estilos en index.css (sección "MODALES", clases md-loading*).
export default function LoadingOverlay({ message = "Cargando datos iniciales…" }) {
  return (
    <div className="md-loading" role="status" aria-live="polite">
      <div className="md-loading-box">
        <span className="md-loading-ring" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  );
}
