import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCheck, FaTimes, FaWhatsapp, FaRedo, FaMotorcycle, FaTruck, FaStore } from "react-icons/fa";
import { useCart, colones, textoDorsal } from "../cart/useCart";

// 💳 /checkout/resultado — Tilopay devuelve al cliente acá con ?order=&code=&returnData=...
// ⚠️ El `code` de la URL NO se cree: se le pregunta al backend, que confirma con Tilopay (consult).
// Estilos: index.css, sección "CHECKOUT" (clases co-*/pr-*).

const API_BASE = "https://chemas-sport-er-backend.onrender.com";
const ORDEN_PENDIENTE_KEY = "chemasport_orden_pendiente";
const BORRADOR_KEY = "chemasport_checkout_borrador";
const WHATSAPP_TIENDA = "50660369857";
const REINTENTOS = 5;
const MAPS_TIENDA = "https://maps.google.com/?cid=9503301042483866711"; // 🏪 CHEMASPORT ER en Google Maps // si la URL dice aprobado pero Tilopay aún no lo refleja en consult

const leerOrden = (params) => {
  // 1) returnData = base64("CSW000123:token")
  try {
    const raw = params.get("returnData");
    if (raw) {
      const [orderNumber, token] = atob(decodeURIComponent(raw)).split(":");
      if (orderNumber && token) return { orderNumber, token };
    }
  } catch { /* returnData raro */ }
  // 2) respaldo: lo que guardó el checkout antes de ir a Tilopay
  try {
    const g = JSON.parse(localStorage.getItem(ORDEN_PENDIENTE_KEY) || "null");
    const order = params.get("order");
    // Tilopay puede devolver el número con prefijo del comercio: "PFC021519-CSW000002"
    if (g?.orderNumber && g?.token && (!order || order === g.orderNumber || order.endsWith(`-${g.orderNumber}`))) return g;
  } catch { /* sin storage */ }
  return null;
};

export default function PagoResultado() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { vaciar } = useCart();
  const [estado, setEstado] = useState("verificando"); // verificando | pagada | confirmando | rechazada | error
  const [orden, setOrden] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const yaVacio = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const ref = leerOrden(params);
    if (!ref) {
      setEstado("error");
      setMensaje("No encontramos los datos de tu orden. Si se te cobró, escribinos por WhatsApp.");
      return;
    }
    const urlDiceAprobado = params.get("code") === "1";
    let cancelado = false;
    let intento = 0;

    const verificar = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/checkout/orden/${encodeURIComponent(ref.orderNumber)}?t=${encodeURIComponent(ref.token)}`);
        const data = await r.json().catch(() => ({}));
        if (cancelado) return;
        if (!r.ok) throw new Error(data.error || "No pudimos verificar el pago.");
        setOrden(data);
        if (data.estado === "pagada") {
          setEstado("pagada");
          if (!yaVacio.current) {
            yaVacio.current = true;
            vaciar();
            try {
              localStorage.removeItem(ORDEN_PENDIENTE_KEY);
              localStorage.removeItem(BORRADOR_KEY);
            } catch { /* sin storage */ }
          }
          return;
        }
        // Tilopay dice aprobado pero consult todavía no lo refleja → reintentar unos segundos
        if (urlDiceAprobado && intento < REINTENTOS) {
          intento += 1;
          setTimeout(verificar, 3000);
          return;
        }
        // Tilopay dijo aprobado pero todavía no lo vemos confirmado: no asustar al cliente con "rechazado"
        if (urlDiceAprobado) {
          setEstado("confirmando");
          return;
        }
        setEstado("rechazada");
        setMensaje(data.motivo || params.get("description") || "");
      } catch (err) {
        if (cancelado) return;
        setEstado("error");
        setMensaje(err.message);
      }
    };
    verificar();
    return () => {
      cancelado = true;
    };
  }, [params, vaciar]);

  const iconoEntrega = orden?.entrega === "mensajero" ? FaMotorcycle : orden?.entrega === "retiro" ? FaStore : FaTruck;
  const IconoEntrega = iconoEntrega;
  const textoEntrega =
    orden?.entrega === "mensajero" ? `${orden.envioTexto || "Te lo lleva nuestro mensajero."} Te escribimos por WhatsApp para coordinar.`
    : orden?.entrega === "retiro" ? "Te avisamos por WhatsApp cuando esté listo para retirar."
    : `${orden?.envioTexto || "Lo enviamos por Correos de Costa Rica."} La guía para rastrearlo te llega al correo.`;

  const waAyuda = `https://wa.me/${WHATSAPP_TIENDA}?text=${encodeURIComponent(
    `¡Hola! Tengo una consulta sobre mi orden ${orden?.orderNumber || params.get("order") || ""}.`
  )}`;

  return (
    <div className="co-page">
      <div className="pr-wrap">
        {estado === "verificando" && (
          <div className="co-card pr-card">
            <span className="pr-spinner" aria-hidden="true" />
            <h1 className="pr-title">Verificando tu pago…</h1>
            <p className="pr-text">Estamos confirmando con Tilopay. No cierres esta página.</p>
          </div>
        )}

        {estado === "pagada" && orden && (
          <motion.div className="co-card pr-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <motion.span
              className="pr-icon is-ok"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
            >
              <FaCheck />
            </motion.span>
            <span className="ct-eyebrow">Orden {orden.orderNumber}</span>
            <h1 className="pr-title">¡Gracias, {orden.nombre}!</h1>
            <p className="pr-text">Tu pago fue aprobado. Guardá tu número de orden; te escribimos por WhatsApp para coordinar.</p>

            <ul className="pr-items">
              {orden.items.map((i, k) => (
                <li key={k}>
                  <span>
                    <b>{i.cantidad}×</b> {i.name}
                    <small>Talla {i.talla === "U" ? "única" : i.talla}{i.dorsal?.name || i.dorsal?.number ? ` · ${textoDorsal(i.dorsal)}` : ""}</small>
                  </span>
                  <span>{colones(i.precio * i.cantidad)}</span>
                </li>
              ))}
              <li className="is-sub"><span>Envío</span><span>{orden.envio ? colones(orden.envio) : "Gratis"}</span></li>
              <li className="is-total"><span>Total pagado</span><span>{colones(orden.total)}</span></li>
            </ul>

            <div className="pr-next">
              <IconoEntrega />
              <p>
                {textoEntrega}
                {orden.entrega === "retiro" && (
                  <> <a className="co-maps" href={MAPS_TIENDA} target="_blank" rel="noopener noreferrer">Ver ubicación de la tienda</a></>
                )}
              </p>
            </div>

            <button type="button" className="co-btn is-dark pr-btn" onClick={() => navigate("/")}>Seguir comprando</button>
            <a className="pr-link" href={waAyuda} target="_blank" rel="noopener noreferrer"><FaWhatsapp /> ¿Dudas? Escribinos</a>
          </motion.div>
        )}

        {estado === "confirmando" && (
          <motion.div className="co-card pr-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="pr-spinner" aria-hidden="true" />
            <h1 className="pr-title">Estamos confirmando tu pago</h1>
            <p className="pr-text">
              Tilopay aprobó la transacción y la estamos registrando. Puede tardar unos minutos;
              no hace falta que pagues de nuevo.
            </p>
            <button type="button" className="co-btn is-dark pr-btn" onClick={() => window.location.reload()}>
              <FaRedo /> Revisar de nuevo
            </button>
            <a className="co-btn is-wa pr-btn" href={waAyuda} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp /> Escribinos por WhatsApp
            </a>
          </motion.div>
        )}

        {(estado === "rechazada" || estado === "error") && (
          <motion.div className="co-card pr-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="pr-icon is-bad"><FaTimes /></span>
            <h1 className="pr-title">{estado === "rechazada" ? "El pago no se completó" : "No pudimos verificar el pago"}</h1>
            <p className="pr-text">
              {estado === "rechazada"
                ? "No se hizo ningún cobro. Tu carrito sigue guardado, podés intentarlo de nuevo con otra tarjeta o pedir por WhatsApp."
                : mensaje}
            </p>
            {estado === "rechazada" && mensaje && <p className="pr-motivo">Motivo: {mensaje}</p>}
            <button type="button" className="co-btn is-dark pr-btn" onClick={() => navigate("/checkout")}>
              <FaRedo /> Intentar de nuevo
            </button>
            <a className="co-btn is-wa pr-btn" href={waAyuda} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp /> Pedir ayuda por WhatsApp
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
