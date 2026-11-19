import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMinus, FaPlus, FaTrashAlt, FaShoppingBag, FaLock, FaWhatsapp, FaTruck } from "react-icons/fa";
import { useCart, colones, cldThumb, textoDorsal, lineasConStock } from "../cart/useCart";
import { ShoppingCart } from "lucide-react";
import { ApartadoAviso, ApartadoChip } from "./ApartadoReloj";

// 🛒 Panel lateral del carrito. ⚠️ Estilos en index.css (sección "CARRITO", clases ct-*).

export default function CartDrawer({ products = [] }) {
  const { items, open, cerrar, cambiarCantidad, quitar, MAX_POR_LINEA, otrasApartadas, proximoVence } = useCart();
  const navigate = useNavigate();

  // Bloquear scroll del fondo + Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, cerrar]);

  // 🔄 Stock y precio en vivo del catálogo (socket), sin lo que otros clientes tienen apartado
  const lineas = useMemo(() => lineasConStock(items, products, otrasApartadas), [items, products, otrasApartadas]);

  const subtotal = lineas.reduce((s, l) => s + (l.agotado ? 0 : l.cantidad * (Number(l.precio) || 0)), 0);
  const ahorro = lineas.reduce(
    (s, l) => s + (!l.agotado && l.precioAntes > l.precio ? (l.precioAntes - l.precio) * l.cantidad : 0),
    0
  );
  const unidades = lineas.reduce((s, l) => s + (l.agotado ? 0 : l.cantidad), 0);
  const hayProblemas = lineas.some((l) => l.agotado || l.excede);

  const whatsappUrl = useMemo(() => {
    const filas = lineas
      .filter((l) => !l.agotado)
      .map((l, i) => {
        const dorsal = l.dorsal ? ` · Dorsal: ${textoDorsal(l.dorsal)}` : "";
        return `${i + 1}. *${l.name}*\n   Talla: ${l.talla === "U" ? "Única" : l.talla}${dorsal}\n   ${l.cantidad} x ${colones(l.precio)} = ${colones(l.cantidad * l.precio)}`;
      })
      .join("\n\n");
    const msg = `¡Hola! Quiero hacer este pedido:\n\n${filas}\n\n*Total:* ${colones(subtotal)}`;
    return `https://wa.me/50660369857?text=${encodeURIComponent(msg)}`;
  }, [lineas, subtotal]);

  const irAPagar = () => {
    cerrar();
    navigate("/checkout");
  };

  const verProducto = (id) => {
    cerrar();
    navigate(`/producto/${id}`);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="ct-layer" role="dialog" aria-modal="true" aria-label="Carrito de compras">
          <motion.div
            className="ct-backdrop"
            onClick={cerrar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="ct-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            {/* ---- Encabezado ---- */}
            <div className="ct-head">
              <div>
                <span className="ct-eyebrow">Tu pedido</span>
                <h2 className="ct-title">
                  Carrito <span className="ct-title-count">{unidades}</span>
                </h2>
              </div>
              <button type="button" className="ct-close" onClick={cerrar} aria-label="Cerrar carrito">
                <FaTimes />
              </button>
            </div>

            {lineas.length === 0 ? (
              /* ---- Vacío ---- */
              <div className="ct-empty">
                <span className="ct-empty-icon"><ShoppingCart size={30} strokeWidth={1.8} /></span>
                <h3>Tu carrito está vacío</h3>
                <p>Agregá camisetas desde el catálogo y aparecen acá.</p>
                <button
                  type="button"
                  className="ct-btn is-dark"
                  onClick={() => {
                    cerrar();
                    navigate("/");
                  }}
                >
                  Ver catálogo
                </button>
              </div>
            ) : (
              <>
                {/* ⏳ Apartado de 10 min */}
                <ApartadoAviso venceAt={proximoVence} />

                {/* ---- Líneas ---- */}
                <ul className="ct-list">
                  <AnimatePresence initial={false}>
                    {lineas.map((l) => (
                      <motion.li
                        key={l.key}
                        layout
                        className={`ct-item ${l.agotado ? "is-out" : ""}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                      >
                        <button type="button" className="ct-thumb" onClick={() => verProducto(l.productId)} aria-label={`Ver ${l.name}`}>
                          {l.image ? <img src={cldThumb(l.image)} alt="" loading="lazy" /> : <FaShoppingBag />}
                        </button>

                        <div className="ct-info">
                          <button type="button" className="ct-name" onClick={() => verProducto(l.productId)}>
                            {l.name}
                          </button>
                          <div className="ct-meta">
                            <span className="ct-chip">Talla {l.talla === "U" ? "única" : l.talla}</span>
                            {l.dorsal && <span className="ct-chip is-dorsal">{textoDorsal(l.dorsal)}</span>}
                            <ApartadoChip venceAt={l.venceAt} />
                          </div>

                          {l.agotado && <p className="ct-warn">Se agotó esta talla</p>}
                          {l.excede && <p className="ct-warn">Solo quedan {l.disponible}</p>}

                          <div className="ct-row">
                            <div className="ct-qty" aria-label="Cantidad">
                              <button
                                type="button"
                                onClick={() => cambiarCantidad(l.key, l.cantidad - 1)}
                                aria-label="Quitar uno"
                              >
                                <FaMinus />
                              </button>
                              <span>{l.cantidad}</span>
                              <button
                                type="button"
                                onClick={() => cambiarCantidad(l.key, l.cantidad + 1)}
                                disabled={l.agotado || l.cantidad >= MAX_POR_LINEA || (l.disponible !== null && l.cantidad >= l.disponible)}
                                aria-label="Agregar uno"
                              >
                                <FaPlus />
                              </button>
                            </div>
                            <div className="ct-price">
                              {l.precioAntes > l.precio && <s>{colones(l.precioAntes * l.cantidad)}</s>}
                              <strong>{colones(l.precio * l.cantidad)}</strong>
                            </div>
                          </div>
                        </div>

                        <button type="button" className="ct-remove" onClick={() => quitar(l.key)} aria-label={`Quitar ${l.name}`}>
                          <FaTrashAlt />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                {/* ---- Resumen ---- */}
                <div className="ct-foot">
                  <div className="ct-ship">
                    <FaTruck /> Envío a todo el país · se calcula al pagar
                  </div>
                  {ahorro > 0 && (
                    <div className="ct-line is-save">
                      <span>Ahorrás</span>
                      <span>−{colones(ahorro)}</span>
                    </div>
                  )}
                  <div className="ct-line is-total">
                    <span>Subtotal</span>
                    <span>{colones(subtotal)}</span>
                  </div>

                  <button type="button" className="ct-btn is-dark" onClick={irAPagar} disabled={hayProblemas || unidades === 0}>
                    <FaLock /> Ir a pagar
                  </button>
                  {hayProblemas && <p className="ct-hint">Ajustá las camisetas marcadas para continuar.</p>}

                  <a
                    href={unidades > 0 ? whatsappUrl : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ct-btn is-wa"
                  >
                    <FaWhatsapp /> Prefiero pedir por WhatsApp
                  </a>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
