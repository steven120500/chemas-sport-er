import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import {
  FaArrowLeft, FaLock, FaTruck, FaStore, FaCreditCard, FaUser, FaMapMarkerAlt, FaCheck, FaShieldAlt, FaMotorcycle, FaChevronDown, FaWhatsapp, FaCheckCircle,
} from "react-icons/fa";
import { useCart, colones, cldThumb, textoDorsal, lineasConStock } from "../cart/useCart";
import { toast as toastHOT } from "react-hot-toast";
import UBICACIONES from "../utils/crUbicaciones.json"; // 🗺️ provincias → cantones → distritos (catálogo oficial)
import { hayMensajero, COSTO_MENSAJERO } from "../utils/coberturaMensajero";
import { planEnvio, cuandoTexto } from "../utils/fechasEnvio"; // 📦 cuándo sale / cuándo llega
import { ApartadoAviso } from "./ApartadoReloj";

// 💳 Checkout (MAQUETA). ⚠️ Estilos en index.css (sección "CHECKOUT", clases co-*).
// Próximo paso: "Pagar" manda el pedido al backend, que recalcula precios/stock desde la BD,
// crea la orden y devuelve la URL de pago de Tilopay. Las llaves de Tilopay viven solo en api/.env.

// 🚧 Por confirmar con el dueño
const COSTO_ENVIO_CORREOS = 3500;
// 🏪 Tienda física (retiro): ficha de Google Maps "CHEMASPORT ER"
const DIRECCION_TIENDA = "Grecia, Alajuela";
const MAPS_TIENDA = "https://maps.google.com/?cid=9503301042483866711";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";
const WHATSAPP_TIENDA = "50660369857";

const BORRADOR_KEY = "chemasport_checkout_borrador"; // solo comodidad: si recarga no pierde lo escrito
const ORDEN_PENDIENTE_KEY = "chemasport_orden_pendiente"; // { orderNumber, token } por si Tilopay no devuelve returnData

const FORM_INICIAL = {
  cedula: "", nombre: "", apellidos: "", telefono: "", correo: "",
  // 📍 Primero la ubicación; con el distrito escogido aparecen las formas de entrega para esa zona
  provincia: "", canton: "", distrito: "",
  entrega: "", // "" (sin escoger) | mensajero (solo dentro de la cobertura) | correos | retiro
  senas: "",
  notas: "",
  pago: "tarjeta", // tarjeta (Tilopay) | whatsapp (coordina el pago por chat)
  facturaElectronica: false, // 🧾 marcado → factura electrónica (Hacienda); sin marcar → ticket interno
};

const leerBorrador = () => {
  try {
    const f = { ...FORM_INICIAL, ...(JSON.parse(localStorage.getItem(BORRADOR_KEY) || "{}") || {}) };
    // Borradores viejos (cantón/distrito escritos a mano): si no están en el catálogo se limpian
    const prov = UBICACIONES.find((p) => p.n === f.provincia);
    const cant = prov?.c.find((c) => c.n === f.canton);
    if (!prov) Object.assign(f, { provincia: "", canton: "", distrito: "" });
    else if (!cant) Object.assign(f, { canton: "", distrito: "" });
    else if (!cant.d.includes(f.distrito)) f.distrito = "";
    if (!["mensajero", "correos", "retiro"].includes(f.entrega)) f.entrega = ""; // borradores de la versión anterior
    delete f.metodoEnvio;
    return f;
  } catch {
    return FORM_INICIAL;
  }
};

// La entrega escogida solo vale si hay distrito y, si es mensajero, si la zona está cubierta
const entregaEfectiva = (f) => {
  if (!f.distrito) return "";
  if (f.entrega === "mensajero" && !hayMensajero(f.provincia, f.canton, f.distrito)) return "";
  return f.entrega;
};

// ✉️ Errores típicos en el dominio del correo (ahí llegan la guía y la factura): "gamil.com" → "gmail.com"
const DOMINIOS_TIPICOS = {
  "gamil.com": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.es": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com", "homail.com": "hotmail.com",
  "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outlook.co": "outlook.com", "outlook.con": "outlook.com", "otlook.com": "outlook.com",
  "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "icloud.co": "icloud.com", "iclod.com": "icloud.com",
};
const sugerirCorreo = (correo = "") => {
  const [usuario, dominio] = String(correo).trim().toLowerCase().split("@");
  const bueno = usuario && dominio ? DOMINIOS_TIPICOS[dominio] : null;
  return bueno ? `${usuario}@${bueno}` : "";
};

const validar = (f) => {
  const e = {};
  // Cédula CR: física 9 dígitos, jurídica 10, DIMEX 11–12
  if (!/^\d{9,12}$/.test(f.cedula.replace(/\D/g, ""))) e.cedula = "Cédula de 9 a 12 dígitos, sin guiones";
  if (!f.nombre.trim()) e.nombre = "Escribí tu nombre";
  if (!f.apellidos.trim()) e.apellidos = "Escribí tus apellidos";
  if (!/^[2-8]\d{7}$/.test(f.telefono.replace(/\D/g, ""))) e.telefono = "Teléfono de 8 dígitos";
  // Correo siempre obligatorio: ahí llega la guía de Correos de CR (rastreo) y el comprobante de pago
  const correo = f.correo.trim();
  if (!correo) e.correo = "Escribí tu correo";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) e.correo = "Revisá el correo, parece que tiene un error";
  if (!f.provincia) e.provincia = "Elegí la provincia";
  if (!f.canton) e.canton = "Requerido";
  if (!f.distrito) e.distrito = "Requerido";
  const entrega = entregaEfectiva(f);
  if (f.distrito && !entrega) e.entrega = "Elegí cómo querés recibir tu pedido";
  if ((entrega === "mensajero" || entrega === "correos") && f.senas.trim().length < 10) e.senas = "Contanos cómo llegar (mín. 10 letras)";
  return e;
};

export default function CheckoutPage({ products = [] }) {
  const navigate = useNavigate();
  const { items, abrir: abrirCarrito, otrasApartadas, proximoVence, carritoId } = useCart();
  const [form, setForm] = useState(leerBorrador);
  const [errores, setErrores] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [verItems, setVerItems] = useState(false); // resumen plegable en celular
  const [enviando, setEnviando] = useState(false); // conectando con Tilopay
  const [cedulaInfo, setCedulaInfo] = useState({ estado: "idle" }); // idle | buscando | encontrado | no | error
  const autollenado = useRef({ nombre: "", apellidos: "" }); // lo último que llenamos solos (para no pisar lo escrito a mano)

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // 💾 Borrador del formulario
  useEffect(() => {
    try {
      localStorage.setItem(BORRADOR_KEY, JSON.stringify(form));
    } catch {
      /* sin storage: no pasa nada */
    }
  }, [form]);

  // 🔍 Cédula → nombre y apellidos (TSE / Hacienda vía nuestro backend), con debounce
  const cedulaDigitos = form.cedula.replace(/\D/g, "");
  useEffect(() => {
    if (!/^\d{9,12}$/.test(cedulaDigitos)) {
      setCedulaInfo({ estado: "idle" });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCedulaInfo({ estado: "buscando" });
      try {
        const r = await fetch(`${API_BASE}/api/checkout/cedula/${cedulaDigitos}`, { signal: ctrl.signal });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "error");
        if (!data.encontrado) {
          setCedulaInfo({ estado: "no" });
          return;
        }
        setForm((f) => {
          const prev = autollenado.current;
          // Solo llena si el campo está vacío o todavía tiene lo que llenamos nosotros
          const nombre = !f.nombre.trim() || f.nombre === prev.nombre ? data.nombre : f.nombre;
          const apellidos = !f.apellidos.trim() || f.apellidos === prev.apellidos ? data.apellidos : f.apellidos;
          autollenado.current = { nombre: data.nombre, apellidos: data.apellidos };
          return { ...f, nombre, apellidos };
        });
        setCedulaInfo({ estado: "encontrado", fuente: data.fuente });
      } catch (err) {
        if (err.name !== "AbortError") setCedulaInfo({ estado: "error" });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cedulaDigitos]);

  // Revalidar en vivo solo después del primer intento
  useEffect(() => {
    if (intentado) setErrores(validar(form));
  }, [form, intentado]);

  const lineas = useMemo(() => lineasConStock(items, products, otrasApartadas), [items, products, otrasApartadas]);
  const validas = lineas.filter((l) => !l.agotado);
  const hayProblemas = lineas.some((l) => l.agotado || l.excede);
  const unidades = validas.reduce((s, l) => s + l.cantidad, 0);
  const subtotal = validas.reduce((s, l) => s + l.cantidad * (Number(l.precio) || 0), 0);
  const ahorro = validas.reduce((s, l) => s + (l.precioAntes > l.precio ? (l.precioAntes - l.precio) * l.cantidad : 0), 0);
  // 🛵 Mensajero solo si la dirección está en la cobertura; si no, va por Correos
  const cubreMensajero = hayMensajero(form.provincia, form.canton, form.distrito);
  const entrega = entregaEfectiva(form);
  // 📦 Si compra hoy: mensajero recoge L-V 3 pm y entrega al día siguiente; Correos abre L-V
  const planMensajero = planEnvio("mensajero");
  const planCorreos = planEnvio("correos");
  const esDomicilio = entrega === "mensajero" || entrega === "correos";
  const envio = entrega === "mensajero" ? COSTO_MENSAJERO : entrega === "correos" ? COSTO_ENVIO_CORREOS : 0;
  const cantonesDe = UBICACIONES.find((p) => p.n === form.provincia)?.c || [];
  const distritosDe = cantonesDe.find((c) => c.n === form.canton)?.d || [];
  const total = subtotal + envio;

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const pagar = async (e) => {
    e?.preventDefault();
    setIntentado(true);
    const errs = validar(form);
    setErrores(errs);
    if (Object.keys(errs).length) {
      // Llevar al primer campo con error
      const primero = document.querySelector(`[name="${Object.keys(errs)[0]}"]`);
      primero?.scrollIntoView({ behavior: "smooth", block: "center" });
      primero?.focus({ preventScroll: true });
      return;
    }
    if (hayProblemas || unidades === 0) return;

    // 💬 Pago por WhatsApp: arma el pedido completo y abre el chat de la tienda
    if (form.pago === "whatsapp") {
      const url = `https://wa.me/${WHATSAPP_TIENDA}?text=${encodeURIComponent(mensajeWhatsapp())}`;
      const win = window.open(url, "_blank", "noopener");
      if (!win) window.location.href = url; // si el navegador bloquea la pestaña nueva
      return;
    }

    // 💳 Tarjeta: el backend recalcula todo, crea la orden y devuelve la página de pago de Tilopay
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: { cedula: form.cedula.replace(/\D/g, ""), nombre: form.nombre.trim(), apellidos: form.apellidos.trim(), telefono: form.telefono.replace(/\D/g, ""), correo: form.correo.trim() },
          entrega: { tipo: entrega, provincia: form.provincia, canton: form.canton, distrito: form.distrito, senas: esDomicilio ? form.senas.trim() : "" },
          items: validas.map((l) => ({ productId: l.productId, talla: l.talla, dorsal: l.dorsal, cantidad: l.cantidad })),
          notas: form.notas.trim(),
          carritoId, // ⏳ las camisetas apartadas siguen apartadas mientras paga
          facturaElectronica: Boolean(form.facturaElectronica),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.url) throw new Error(data.error || "No pudimos iniciar el pago.");
      try {
        localStorage.setItem(ORDEN_PENDIENTE_KEY, JSON.stringify({ orderNumber: data.orderNumber, token: data.token }));
      } catch { /* sin storage: igual vuelve con returnData */ }
      window.location.href = data.url; // 👉 página segura de Tilopay
    } catch (err) {
      setEnviando(false);
      toastHOT.error(err.message || "No pudimos iniciar el pago.", { duration: 6000, style: { borderRadius: "12px", background: "#000", color: "#fff" } });
    }
  };

  const mensajeWhatsapp = () => {
    const filas = validas
      .map((l, i) => {
        const dorsal = l.dorsal ? ` · Dorsal: ${textoDorsal(l.dorsal)}` : "";
        return `${i + 1}. *${l.name}*\n   Talla: ${l.talla === "U" ? "Única" : l.talla}${dorsal}\n   ${l.cantidad} x ${colones(l.precio)} = ${colones(l.cantidad * l.precio)}`;
      })
      .join("\n\n");
    const txtEntrega = esDomicilio
      ? `${entrega === "mensajero" ? "Mensajero privado" : "Envío por Correos"}\n${form.provincia}, ${form.canton.trim()}, ${form.distrito.trim()}\n${form.senas.trim()}`
      : "Retiro en tienda";
    const datos = [
      `*Cédula:* ${form.cedula.replace(/\D/g, "")}`,
      `*Nombre:* ${form.nombre.trim()} ${form.apellidos.trim()}`,
      `*Teléfono:* ${form.telefono.replace(/\D/g, "")}`,
      `*Correo:* ${form.correo.trim()}`,
      `*Factura electrónica:* ${form.facturaElectronica ? "Sí" : "No"}`,
    ].filter(Boolean).join("\n");
    return [
      "¡Hola! Quiero hacer este pedido desde la página 🛒",
      filas,
      `*Subtotal:* ${colones(subtotal)}\n*Envío:* ${envio ? colones(envio) : "Gratis"}\n*TOTAL:* ${colones(total)}`,
      datos,
      `*Entrega:* ${txtEntrega}`,
      form.notas.trim() && `*Notas:* ${form.notas.trim()}`,
      "¿Cómo hago el pago?",
    ].filter(Boolean).join("\n\n");
  };

  const porWhatsapp = form.pago === "whatsapp";

  /* ---------- Carrito vacío ---------- */
  if (items.length === 0) {
    return (
      <div className="co-page">
        <div className="co-empty">
          <span className="co-empty-icon"><ShoppingCart size={34} strokeWidth={1.8} /></span>
          <h1>Tu carrito está vacío</h1>
          <p>Agregá camisetas para continuar con la compra.</p>
          <button type="button" className="co-btn is-dark" onClick={() => navigate("/")}>Ver catálogo</button>
        </div>
      </div>
    );
  }

  // ⚠️ Se llama como función (no <Campo/>) para que el input no se remonte y pierda el foco al escribir
  const campo = ({ name, label, opcional, children }) => (
    <label className={`co-field ${errores[name] ? "has-error" : ""}`}>
      <span className="co-label">
        {label} {opcional && <em>(opcional)</em>}
      </span>
      {children}
      {errores[name] && <span className="co-error">{errores[name]}</span>}
    </label>
  );

  return (
    <div className="co-page">
      <div className="co-wrap">
        {/* ---- Encabezado + pasos ---- */}
        <div className="co-top">
          <button type="button" className="co-back" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Seguir comprando
          </button>
          <h1 className="co-title">Finalizar compra</h1>
          <ol className="co-steps" aria-label="Pasos">
            <li className="is-done"><span><FaCheck /></span>Carrito</li>
            <li className="is-active"><span>2</span>Datos</li>
            <li><span>3</span>Pago</li>
          </ol>
        </div>

        <form className="co-grid" onSubmit={pagar} noValidate>
          {/* =============== FORMULARIO =============== */}
          <div className="co-main">
            {/* Contacto */}
            <section className="co-card">
              <h2 className="co-card-title"><span className="co-num">1</span><FaUser /> Tus datos</h2>
              <div className="co-fields">
                {campo({ name: "cedula", label: "Cédula", children: (
                  <>
                    <div className={`co-cedula is-${cedulaInfo.estado}`}>
                      <input name="cedula" className="co-input" value={form.cedula} onChange={set("cedula")} inputMode="numeric" maxLength={14} placeholder="Ej: 112345678" autoComplete="off" />
                      {cedulaInfo.estado === "buscando" && <span className="co-cedula-icon co-spin" aria-label="Buscando" />}
                      {cedulaInfo.estado === "encontrado" && <FaCheckCircle className="co-cedula-icon" aria-label="Encontrada" />}
                    </div>
                    {!errores.cedula && cedulaInfo.estado === "encontrado" && (
                      <span className="co-hint is-ok">Datos tomados del {cedulaInfo.fuente === "hacienda" ? "registro de Hacienda" : "TSE"}. Revisalos.</span>
                    )}
                    {!errores.cedula && cedulaInfo.estado === "no" && (
                      <span className="co-hint">No la encontramos. Escribí tu nombre y apellidos.</span>
                    )}
                    {!errores.cedula && cedulaInfo.estado === "error" && (
                      <span className="co-hint">No pudimos consultar ahora. Escribí tus datos.</span>
                    )}
                  </>
                ) })}
                <div className="co-two">
                  {campo({ name: "nombre", label: "Nombre", children: (
                    <input name="nombre" className="co-input" value={form.nombre} onChange={set("nombre")} autoComplete="given-name" placeholder="Ej: María" />
                  ) })}
                  {campo({ name: "apellidos", label: "Apellidos", children: (
                    <input name="apellidos" className="co-input" value={form.apellidos} onChange={set("apellidos")} autoComplete="family-name" placeholder="Ej: Rodríguez Mora" />
                  ) })}
                </div>
                <div className="co-two">
                  {campo({ name: "telefono", label: "Teléfono / WhatsApp", children: (
                    <div className="co-affix">
                      <span>+506</span>
                      <input name="telefono" className="co-input" value={form.telefono} onChange={set("telefono")} inputMode="tel" autoComplete="tel-national" placeholder="8888 8888" maxLength={9} />
                    </div>
                  ) })}
                  {campo({ name: "correo", label: "Correo", children: (
                    <>
                      <input name="correo" type="email" className="co-input" value={form.correo} onChange={set("correo")} autoComplete="email" inputMode="email" placeholder="tucorreo@gmail.com" />
                      {sugerirCorreo(form.correo) ? (
                        <span className="co-hint is-warn">
                          ¿Quisiste decir <b>{sugerirCorreo(form.correo)}</b>?{" "}
                          <button type="button" className="co-fix" onClick={() => setForm((f) => ({ ...f, correo: sugerirCorreo(f.correo) }))}>Corregir</button>
                        </span>
                      ) : (
                        !errores.correo && <span className="co-hint">Ahí te llega la guía de Correos para rastrear tu paquete.</span>
                      )}
                    </>
                  ) })}
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="co-card">
              <h2 className="co-card-title"><span className="co-num">2</span><FaMapMarkerAlt /> Entrega</h2>
              <div className="co-fields">
                {campo({ name: "provincia", label: "Provincia", children: (
                  <select
                    name="provincia"
                    className="co-input"
                    value={form.provincia}
                    onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value, canton: "", distrito: "" }))}
                  >
                    <option value="">Elegí…</option>
                    {UBICACIONES.map((p) => <option key={p.n} value={p.n}>{p.n}</option>)}
                  </select>
                ) })}
                <div className="co-two">
                  {campo({ name: "canton", label: "Cantón", children: (
                    <select
                      name="canton"
                      className="co-input"
                      value={form.canton}
                      disabled={!form.provincia}
                      onChange={(e) => setForm((f) => ({ ...f, canton: e.target.value, distrito: "" }))}
                    >
                      <option value="">{form.provincia ? "Elegí…" : "Primero la provincia"}</option>
                      {cantonesDe.map((c) => <option key={c.n} value={c.n}>{c.n}</option>)}
                    </select>
                  ) })}
                  {campo({ name: "distrito", label: "Distrito", children: (
                    <select name="distrito" className="co-input" value={form.distrito} disabled={!form.canton} onChange={set("distrito")}>
                      <option value="">{form.canton ? "Elegí…" : "Primero el cantón"}</option>
                      {distritosDe.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) })}
                </div>

                {!form.distrito && (
                  <p className="co-hint co-ship-wait">
                    <FaMapMarkerAlt /> Elegí tu ubicación y te mostramos las formas de entrega disponibles.
                  </p>
                )}

                {/* 🚚 Formas de entrega para esa ubicación */}
                <AnimatePresence initial={false}>
                  {form.distrito && (
                    <motion.div
                      key={`${form.provincia}|${form.canton}|${form.distrito}`}
                      className={`co-ship-methods co-reveal ${errores.entrega ? "has-error" : ""}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span className="co-label">¿Cómo querés recibirlo en {form.distrito}?</span>
                      <div className="co-options is-stack" role="radiogroup" aria-label="Forma de entrega" name="entrega" tabIndex={-1}>
                        {[
                          cubreMensajero && { v: "mensajero", icon: FaMotorcycle, t: "Mensajero privado", badge: "Tu zona", d: `Te llega ${cuandoTexto(planMensajero.entrega)} · a domicilio en la GAM`, p: colones(COSTO_MENSAJERO) },
                          { v: "correos", icon: FaTruck, t: "Correos de Costa Rica", d: `Sale a Correos ${cuandoTexto(planCorreos.despacho)} · llega en 2 a 4 días hábiles · con rastreo`, p: colones(COSTO_ENVIO_CORREOS) },
                          { v: "retiro", icon: FaStore, t: "Retiro en tienda", d: "Te avisamos por WhatsApp cuando esté lista", p: "Gratis" },
                        ].filter(Boolean).map((o, i) => (
                          <motion.button
                            key={o.v}
                            type="button"
                            role="radio"
                            aria-checked={entrega === o.v}
                            className={`co-option ${entrega === o.v ? "is-active" : ""}`}
                            onClick={() => setForm((f) => ({ ...f, entrega: o.v }))}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 + i * 0.06 }}
                          >
                            <span className="co-radio" />
                            <o.icon className="co-option-icon" />
                            <span className="co-option-text">
                              <strong>{o.t}{o.badge && <em className="co-badge">{o.badge}</em>}</strong>
                              <small>{o.d}</small>
                            </span>
                            <span className="co-option-price">{o.p}</span>
                          </motion.button>
                        ))}
                      </div>
                      {errores.entrega && <span className="co-error">{errores.entrega}</span>}
                      {!cubreMensajero && !errores.entrega && (
                        <span className="co-hint">El mensajero privado no llega a este distrito.</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Señas: solo si va a domicilio */}
                <AnimatePresence initial={false}>
                  {esDomicilio && (
                    <motion.div
                      key="senas"
                      className="co-reveal"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {campo({ name: "senas", label: "Dirección exacta (otras señas)", children: (
                        <textarea name="senas" className="co-input" rows={3} value={form.senas} onChange={set("senas")} placeholder="Ej: 200 m norte de la iglesia, casa verde de portón negro" />
                      ) })}
                    </motion.div>
                  )}
                  {entrega === "retiro" && (
                    <motion.div
                      key="retiro"
                      className="co-pickup co-reveal"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <FaMapMarkerAlt />
                      <div>
                        <strong>ChemaSport ER</strong>
                        <p>{DIRECCION_TIENDA}</p>
                        <a className="co-maps" href={MAPS_TIENDA} target="_blank" rel="noopener noreferrer">
                          <FaMapMarkerAlt /> Ver ubicación en Google Maps
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Pago */}
            <section className="co-card">
              <h2 className="co-card-title"><span className="co-num">3</span><FaCreditCard /> Pago</h2>
              <div className="co-options" role="radiogroup" aria-label="Método de pago">
                {[
                  { v: "tarjeta", icon: FaCreditCard, t: "Tarjeta de crédito o débito", d: "Visa · Mastercard · Amex · pago seguro con Tilopay" },
                  { v: "whatsapp", icon: FaWhatsapp, t: "Coordinar por WhatsApp", d: "SINPE Móvil, transferencia o efectivo" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={form.pago === o.v}
                    className={`co-option ${form.pago === o.v ? "is-active" : ""} ${o.v === "whatsapp" ? "is-wa" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, pago: o.v }))}
                  >
                    <span className="co-radio" />
                    <o.icon className="co-option-icon" />
                    <span className="co-option-text">
                      <strong>{o.t}</strong>
                      <small>{o.d}</small>
                    </span>
                  </button>
                ))}
              </div>
              {porWhatsapp ? (
                <p className="co-secure is-wa">
                  <FaWhatsapp /> Te llevamos a WhatsApp con tu pedido ya escrito. Ahí coordinamos el pago y la entrega.
                </p>
              ) : (
                <p className="co-secure">
                  <FaShieldAlt /> Vas a pagar en la página segura de <b>Tilopay</b>. Nosotros nunca vemos los datos de tu tarjeta.
                </p>
              )}

              {/* 🧾 Factura electrónica (Hacienda) o ticket interno */}
              <label className={`co-check ${form.facturaElectronica ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  name="facturaElectronica"
                  checked={Boolean(form.facturaElectronica)}
                  onChange={(e) => setForm((f) => ({ ...f, facturaElectronica: e.target.checked }))}
                />
                <span className="co-check-box" aria-hidden="true"><FaCheck /></span>
                <span className="co-check-text">
                  <strong>Quiero factura electrónica</strong>
                  <small>
                    {form.facturaElectronica
                      ? `Te llega a ${form.correo.trim() || "tu correo"} a nombre de la cédula ${form.cedula.replace(/\D/g, "") || "que pusiste"}.`
                      : "Si no la marcás, te enviamos un comprobante de compra (ticket) al correo."}
                  </small>
                </span>
              </label>

              {campo({ name: "notas", label: "Notas del pedido", opcional: true, children: (
                <textarea name="notas" className="co-input" rows={2} value={form.notas} onChange={set("notas")} placeholder="¿Algo que debamos saber?" />
              ) })}
            </section>
          </div>

          {/* =============== RESUMEN =============== */}
          <aside className="co-side">
            <div className="co-card co-summary">
              <button type="button" className="co-summary-toggle" onClick={() => setVerItems((v) => !v)} aria-expanded={verItems}>
                <span><ShoppingCart size={16} strokeWidth={2.4} /> Tu pedido · {unidades} {unidades === 1 ? "artículo" : "artículos"}</span>
                <FaChevronDown className={verItems ? "is-open" : ""} />
              </button>

              <ul className={`co-items ${verItems ? "is-open" : ""}`}>
                {lineas.map((l) => (
                  <li key={l.key} className={l.agotado ? "is-out" : ""}>
                    <span className="co-thumb">
                      {l.image && <img src={cldThumb(l.image)} alt="" loading="lazy" />}
                      <b>{l.cantidad}</b>
                    </span>
                    <span className="co-item-info">
                      <strong>{l.name}</strong>
                      <small>
                        Talla {l.talla === "U" ? "única" : l.talla}
                        {l.dorsal ? ` · ${textoDorsal(l.dorsal)}` : ""}
                      </small>
                      {l.agotado && <em>Se agotó</em>}
                      {l.excede && <em>Solo quedan {l.disponible}</em>}
                    </span>
                    <span className="co-item-price">{colones(l.precio * l.cantidad)}</span>
                  </li>
                ))}
              </ul>

              <button type="button" className="co-edit" onClick={abrirCarrito}>Editar carrito</button>

              {!porWhatsapp && <ApartadoAviso venceAt={proximoVence} className="is-checkout" />}

              <div className="co-totals">
                <div><span>Subtotal</span><span>{colones(subtotal)}</span></div>
                {ahorro > 0 && <div className="is-save"><span>Ahorrás</span><span>−{colones(ahorro)}</span></div>}
                <div>
                  <span>Envío{entrega === "mensajero" ? " · mensajero" : entrega === "correos" ? " · Correos" : entrega === "retiro" ? " · retiro" : ""}</span>
                  <span>{!entrega ? <em className="co-pending">Elegí la entrega</em> : envio ? colones(envio) : "Gratis"}</span>
                </div>
                <div className="is-total"><span>Total</span><span>{colones(total)}</span></div>
              </div>

              {hayProblemas && <p className="co-warn">Hay camisetas agotadas o sin suficiente stock. Editá el carrito para continuar.</p>}

              <button type="submit" className={`co-btn co-pay ${porWhatsapp ? "is-wa" : "is-dark"}`} disabled={hayProblemas || unidades === 0 || enviando}>
                {porWhatsapp ? <><FaWhatsapp /> Enviar pedido por WhatsApp</> : enviando ? <><span className="co-btn-spin" /> Conectando con Tilopay…</> : <><FaLock /> Pagar {colones(total)}</>}
              </button>
              <p className="co-legal">
                {porWhatsapp ? "Se abre WhatsApp con tu pedido listo para enviar." : "Al pagar aceptás que te contactemos por WhatsApp para coordinar la entrega."}
              </p>
            </div>
          </aside>
        </form>
      </div>

      {/* 📱 Barra fija en celular */}
      <div className="co-mobile-bar">
        <div>
          <small>Total</small>
          <strong>{colones(total)}</strong>
        </div>
        <button type="button" className={`co-btn ${porWhatsapp ? "is-wa" : "is-dark"}`} onClick={pagar} disabled={hayProblemas || unidades === 0 || enviando}>
          {porWhatsapp ? <><FaWhatsapp /> Enviar por WhatsApp</> : enviando ? <><span className="co-btn-spin" /> Conectando…</> : <><FaLock /> Pagar</>}
        </button>
      </div>

    </div>
  );
}
