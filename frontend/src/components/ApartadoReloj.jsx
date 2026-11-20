import { FaClock } from "react-icons/fa";
import { useCuentaAtras, mmss } from "../cart/useCart";

// ⏳ Contador del apartado (arranca al entrar al checkout, ver CartContext.apartarCarrito). ⚠️ Estilos en index.css (sección "CARRITO", clases ct-timer*).

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
