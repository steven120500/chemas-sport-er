import { FaClock } from "react-icons/fa";
import { useCuentaAtras, mmss } from "../cart/useCart";

// ⏳ Contadores del apartado de 10 min del carrito. ⚠️ Estilos en index.css (sección "CARRITO", clases ct-timer*).

/** Aviso grande: "Tus camisetas están apartadas por 8:42" (usa el apartado que vence primero) */
export function ApartadoAviso({ venceAt, className = "" }) {
  const seg = useCuentaAtras(venceAt);
  if (seg === null) return null;
  const urgente = seg <= 120;
  return (
    <div className={`ct-timer ${urgente ? "is-urgent" : ""} ${className}`} role="status">
      <FaClock />
      <span>
        {urgente ? "¡Apurate! " : ""}Te apartamos {seg === 0 ? "las camisetas" : "las camisetas por"} <b>{seg > 0 ? mmss(seg) : "un instante más"}</b>.
        <small> Si no pagás antes, se liberan para otros clientes.</small>
      </span>
    </div>
  );
}

/** Chip chico por línea: "⏳ 8:42" */
export function ApartadoChip({ venceAt }) {
  const seg = useCuentaAtras(venceAt);
  if (seg === null) return null;
  return (
    <span className={`ct-timer-chip ${seg <= 120 ? "is-urgent" : ""}`} title="Tiempo que te queda apartada">
      <FaClock /> {mmss(seg)}
    </span>
  );
}
