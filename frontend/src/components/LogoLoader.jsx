// src/components/LogoLoader.jsx
// ⏳ Pantalla de espera con el logo de ChemaSport y un anillo girando. Tapa toda la pantalla:
// mientras está, no se puede tocar nada (evita dobles clics en acciones lentas como anular una venta).
// ⚠️ Estilos en index.css (sección "LOGO LOADER", clases ll-*).
import { createPortal } from "react-dom";
import logo from "../assets/logo.png";

export default function LogoLoader({ mensaje = "Procesando…", detalle = "" }) {
  return createPortal(
    <div className="ll-overlay" role="alertdialog" aria-busy="true" aria-live="assertive" aria-label={mensaje}>
      <div className="ll-box">
        <div className="ll-spinner" aria-hidden="true">
          <span className="ll-ring" />
          <span className="ll-ring is-red" />
          <span className="ll-logo">
            <img src={logo} alt="" />
          </span>
        </div>
        <p className="ll-msg">{mensaje}</p>
        {detalle && <p className="ll-detail">{detalle}</p>}
      </div>
    </div>,
    document.body
  );
}
