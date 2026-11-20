import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast as toastHOT } from "react-hot-toast";
import {
  FaSearch, FaSyncAlt, FaFilePdf, FaWhatsapp, FaMotorcycle, FaTruck, FaStore, FaChevronDown, FaChevronLeft, FaChevronRight,
  FaCheck, FaCheckCircle, FaExclamationTriangle, FaClock, FaCreditCard, FaBoxOpen, FaEnvelope, FaIdCard, FaFileInvoice, FaTrashAlt, FaRegFileAlt, FaRegEnvelope, FaRegCommentDots, FaPrint, FaMagic, FaRegCopy,
} from "react-icons/fa";
import { generarPdfMensajero, generarPdfOficialCorreos } from "../utils/guiasPdf";
import { getToken } from "../authFetch";
import { colones, cldThumb, textoDorsal } from "../cart/useCart";
import GuiaPedidoModal from "./GuiaPedidoModal";
import ModalShell from "./ModalShell";
import { juntarGuias } from "../utils/historialCopia";

// 👑 /ventas-web — Panel del súper admin con las ventas de la tienda online (Tilopay).
// ⚠️ Estilos en index.css (sección "VENTAS WEB", clases vw-*). Datos: GET /api/checkout/admin/ordenes.

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const hoyCR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
const haceDias = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
};
// 🗓️ Meses (YYYY-MM): se puede ver cualquier mes pasado con las flechas de los totales
const mesActual = () => hoyCR().slice(0, 7);
const moverMes = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const finDeMes = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
// "2026-11" → "noviembre" (si no es de este año: "noviembre 2025")
const nombreMes = (ym) => {
  if (!ym) return "";
  const n = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("es-CR", { month: "long", timeZone: "UTC" });
  return ym.slice(0, 4) === hoyCR().slice(0, 4) ? n : `${n} ${ym.slice(0, 4)}`;
};

const RANGOS = [
  { v: "hoy", t: "Hoy", desde: hoyCR, hasta: hoyCR },
  { v: "7d", t: "7 días", desde: () => haceDias(6), hasta: hoyCR },
  { v: "mes", t: "Mes", desde: (mes) => `${mes}-01`, hasta: (mes) => (mes === mesActual() ? hoyCR() : finDeMes(mes)) }, // 👈 el mes de las flechas
  { v: "todo", t: "Todo", desde: () => "", hasta: () => "" },
];
const ESTADOS = [
  { v: "pagada", t: "Pagadas" },
  { v: "pendiente", t: "Sin pagar" }, // 👈 incluye las rechazadas y los pedidos por WhatsApp
];

// ❓ Qué pasó con una orden sin pagar
const MIN_PAGANDO = 20; // lo que dura el apartado mientras está en Tilopay
function quePaso(o) {
  if (o.metodoPago === "whatsapp") return { tipo: "wa", texto: "Pidió por WhatsApp: el pago se coordina por chat" };
  if (o.estado === "rechazada") return { tipo: "bad", texto: `Tilopay rechazó el pago${o.tilopay?.description ? `: ${o.tilopay.description}` : ""}` };
  if (Date.now() - new Date(o.createdAt).getTime() < MIN_PAGANDO * 60 * 1000) return { tipo: "wait", texto: "Está en la página de pago de Tilopay ahora mismo" };
  if (o.tilopay?.description) return { tipo: "bad", texto: `Intentó pagar y no pasó: ${o.tilopay.description}` };
  return { tipo: "off", texto: "No terminó de pagar: salió de la página de pago de Tilopay" };
}

const fechaHora = (d) =>
  d ? new Date(d).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "";

const ENTREGA = {
  mensajero: { icon: FaMotorcycle, t: "Mensajero" },
  correos: { icon: FaTruck, t: "Correos" },
  retiro: { icon: FaStore, t: "Retiro en tienda" },
};

export default function VentasWebPage({ isSuperUser, puedeVer = isSuperUser }) {
  // 🏪 puedeVer = súper usuario o perfil tienda; borrar órdenes sigue siendo solo del súper usuario
  const [estado, setEstado] = useState("pagada");
  const [rango, setRango] = useState("mes");
  const [mes, setMes] = useState(mesActual); // 🗓️ mes que se ve (totales + rango "Mes")
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ ordenes: [], totales: null, page: 1, paginas: 1, total: 0 });
  const [page, setPage] = useState(1); // 📄 de 10 en 10 (lo pagina el servidor)
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState(null);
  const [accion, setAccion] = useState(""); // id de la orden con una acción en curso
  const [guiaDe, setGuiaDe] = useState(null); // orden a la que se le hace la guía
  const [facturarDe, setFacturarDe] = useState(null); // orden a facturar (escoger Interno / Hacienda)
  const [confirmarBorrar, setConfirmarBorrar] = useState(""); // id: segundo toque para borrar

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => {
      const nuevo = busqueda.trim();
      setQ((prev) => {
        if (prev !== nuevo) setPage(1); // 👈 búsqueda nueva → página 1
        return nuevo;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = RANGOS.find((x) => x.v === rango);
      const params = new URLSearchParams({ estado, page: String(page), mes });
      if (r.desde(mes)) params.set("desde", r.desde(mes));
      if (r.hasta(mes)) params.set("hasta", r.hasta(mes));
      if (q) params.set("q", q);
      const res = await fetch(`${API_BASE}/api/checkout/admin/ordenes?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setData(json);
    } catch (e) {
      toastHOT.error(e.message || "No se pudieron cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }, [estado, rango, q, page, mes]);

  useEffect(() => {
    if (puedeVer) cargar();
  }, [cargar, puedeVer]);


  // 🗓️ Al entrar un mes nuevo (con el panel abierto en el mes actual) pasa solo al mes nuevo: totales en 0
  const [mesHoy, setMesHoy] = useState(mesActual);
  useEffect(() => {
    if (!puedeVer) return;
    const t = setInterval(() => {
      const ahora = mesActual();
      if (ahora === mesHoy) return;
      if (mes === mesHoy) {
        setMes(ahora);
        setRango("mes");
        setPage(1);
      }
      setMesHoy(ahora);
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [puedeVer, mes, mesHoy]);

  const irAMes = (n) => {
    const nuevo = moverMes(mes, n);
    if (nuevo > mesActual()) return;
    setMes(nuevo);
    setRango("mes");
    setPage(1);
  };

  // 🔔 En vivo: cuando entra un pago nuevo
  useEffect(() => {
    if (!puedeVer) return;
    const socket = io(API_BASE, { transports: ["websocket", "polling"], auth: { token: getToken() } });
    socket.on("ordenWebPagada", (o) => {
      toastHOT.success(`💳 Nueva venta web ${o.orderNumber}: ${colones(o.total)} · ${o.cliente}`, { duration: 8000 });
      cargar();
    });
    socket.on("ordenWebAlerta", (o) => toastHOT.error(`⚠️ ${o.orderNumber}: ${o.mensaje}`, { duration: 12000 }));
    return () => socket.disconnect();
  }, [puedeVer, cargar]);

  // ⏳ Mientras alguna orden se está facturando o generando la guía (corre sola en el servidor), refrescar cada 6 s
  const procesando = (data.ordenes || []).some(
    (o) => o.estado === "pagada" && (
      !o.factura?.estado || o.factura.estado === "facturando" ||
      o.guia?.estado === "generando" ||
      (o.entrega?.tipo !== "retiro" && !o.guia?.estado && !o.guia?.numero && o.factura?.estado !== "omitida" && Date.now() - new Date(o.pagadaAt).getTime() < 10 * 60 * 1000)
    )
  );
  useEffect(() => {
    if (!procesando || !puedeVer) return;
    const t = setTimeout(cargar, 6000);
    return () => clearTimeout(t);
  }, [procesando, puedeVer, cargar, data]);

  // 🖨️ Volver a imprimir la guía (la automática o una hecha a mano que guardó sus datos)
  const imprimirGuia = async (o) => {
    try {
      if (!o.guia?.datos) throw new Error("Esta guía no guardó sus datos para reimprimir. Buscala en /guias.");
      if (o.guia.tipo === "Correos") generarPdfOficialCorreos(o.guia.datos); // descarga sola
      else {
        const { doc, fileName } = await generarPdfMensajero(o.guia.datos);
        doc.save(fileName);
      }
    } catch (e) {
      toastHOT.error(e.message || "No se pudo armar el PDF.");
    }
  };

  const reemplazar = (orden) =>
    setData((d) => ({ ...d, ordenes: d.ordenes.map((o) => (o._id === orden._id ? orden : o)) }));

  // ✅ Check de "ya la alisté" por camiseta (se ve al instante y se guarda en el servidor)
  const alistar = async (orden, index) => {
    const listo = !orden.items[index]?.alistado?.at;
    const local = { ...orden, items: orden.items.map((it, k) => (k === index ? { ...it, alistado: listo ? { por: "", at: new Date().toISOString() } : undefined } : it)) };
    reemplazar(local);
    try {
      const res = await fetch(`${API_BASE}/api/checkout/admin/ordenes/${orden._id}/alistar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, listo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar el check");
      reemplazar(json);
    } catch (e) {
      reemplazar(orden); // se devuelve como estaba
      toastHOT.error(e.message);
    }
  };

  // 📋 "Copiar historial": el mismo texto que "Copiar" en /history (la venta sigue quedando en el historial normal)
  const copiarHistorial = async (orden) => {
    const traerTexto = async () => {
      const res = await fetch(`${API_BASE}/api/checkout/admin/ordenes/${orden._id}/historial`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo traer el historial");
      if (!json.length) throw new Error("Esta orden no tiene registros en el historial");
      return juntarGuias(json);
    };
    try {
      // 👇 Safari solo deja copiar dentro del click: se le pasa la promesa al portapapeles de una vez
      if (window.ClipboardItem && navigator.clipboard?.write) {
        let texto = "";
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "text/plain": traerTexto().then((t) => {
              texto = t;
              return new Blob([t], { type: "text/plain" });
            }),
          }),
        ]).catch(async (e) => {
          if (!texto) texto = await traerTexto().catch(() => { throw e; });
          await navigator.clipboard.writeText(texto);
        });
      } else {
        await navigator.clipboard.writeText(await traerTexto());
      }
      toastHOT.success("Historial copiado. Listo para pegar.", { id: "copia-historial-web" });
    } catch (e) {
      toastHOT.error(e.message || "No se pudo copiar");
    }
  };

  const ejecutar = async (orden, tipo, body) => {
    setAccion(orden._id);
    try {
      const res = await fetch(`${API_BASE}/api/checkout/admin/ordenes/${orden._id}/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      reemplazar(json);
      if (tipo === "guia-auto") {
        json.guia?.estado === "lista"
          ? toastHOT.success(`Guía ${json.guia.numero} lista${json.guia.correoEnviado ? " y enviada al cliente" : ""}`)
          : toastHOT.error(json.guia?.error || "No se pudo generar la guía");
      } else if (tipo === "facturar") {
        json.factura?.estado === "lista" ? toastHOT.success(`Facturada: ${json.factura.consecutivo}`) : toastHOT.error(json.factura?.error || "No se pudo facturar");
      } else {
        toastHOT(json.estado === "pagada" ? "✅ Pago confirmado" : "Sigue sin pagar en Tilopay");
      }
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setAccion("");
    }
  };

  // 🗑️ Borrar venta (devuelve el stock si se había rebajado)
  const borrar = async (orden) => {
    if (confirmarBorrar !== orden._id) {
      setConfirmarBorrar(orden._id);
      setTimeout(() => setConfirmarBorrar((c) => (c === orden._id ? "" : c)), 5000);
      return;
    }
    setConfirmarBorrar("");
    setAccion(orden._id);
    try {
      const res = await fetch(`${API_BASE}/api/checkout/admin/ordenes/${orden._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo borrar");
      setData((d) => ({ ...d, ordenes: d.ordenes.filter((o) => o._id !== orden._id) }));
      setAbierta(null);
      toastHOT.success(
        `Venta ${json.orderNumber} borrada${json.devoluciones?.length ? ` · stock devuelto: ${json.devoluciones.join(", ")}` : ""}`,
        { duration: 7000 }
      );
      if (json.facturaPendiente) {
        toastHOT.error(`Acordate de anular en Alegra la factura ${json.facturaPendiente} (no se anula sola).`, { duration: 12000 });
      }
      cargar(); // totales y rellena la página
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setAccion("");
    }
  };

  const t = data.totales;
  const ordenes = useMemo(() => data.ordenes || [], [data]);

  if (!puedeVer) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen adm-page vw-page">
      <div className="vw-wrap">
        {/* ---- Encabezado ---- */}
        <div className="vw-head">
          <div>
            <span className="ct-eyebrow">Tienda online</span>
            <h1 className="vw-title">Ventas web</h1>
          </div>
          <button type="button" className="vw-icon-btn" onClick={cargar} disabled={cargando} aria-label="Recargar">
            <FaSyncAlt className={cargando ? "vw-spin" : ""} />
          </button>
        </div>

        {/* ---- Filtros ---- */}
        <div className="vw-filters">
          <div className="vw-seg" role="tablist" aria-label="Estado">
            {ESTADOS.map((e) => (
              <button key={e.v} type="button" className={estado === e.v ? "is-active" : ""} onClick={() => { setEstado(e.v); setPage(1); }}>{e.t}</button>
            ))}
          </div>
          <div className="vw-seg" role="tablist" aria-label="Rango">
            {RANGOS.map((r) => (
              <button key={r.v} type="button" className={rango === r.v ? "is-active" : ""} onClick={() => { setRango(r.v); setPage(1); }}>{r.v === "mes" ? (mes === mesActual() ? "Este mes" : nombreMes(mes)) : r.t}</button>
            ))}
          </div>
          <label className="vw-search">
            <FaSearch />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Orden, nombre, cédula, teléfono…" />
          </label>
        </div>

        {/* ---- Totales ---- */}
        {t && (
          <div className="vw-kpis">
            <div className="vw-kpi is-main">
              <div className="vw-mes">
                <button type="button" onClick={() => irAMes(-1)} aria-label="Mes anterior"><FaChevronLeft /></button>
                <small>Vendido · {nombreMes(t.mes)}</small>
                <button type="button" onClick={() => irAMes(1)} disabled={mes >= mesActual()} aria-label="Mes siguiente"><FaChevronRight /></button>
              </div>
              <strong>{colones(t.vendido)}</strong>
            </div>
            <div className="vw-kpi"><small>Órdenes</small><strong>{t.ordenes}</strong></div>
            <div className="vw-kpi"><small>Camisetas</small><strong>{t.camisetas}</strong></div>
            <div className="vw-kpi"><small>Envíos cobrados</small><strong>{colones(t.envios)}</strong></div>
            <div className={`vw-kpi ${t.pendientesFactura ? "is-warn" : ""}`}><small>Sin facturar</small><strong>{t.pendientesFactura}</strong></div>
          </div>
        )}

        {/* ---- Lista ---- */}
        {cargando && ordenes.length === 0 ? (
          <div className="vw-empty"><span className="pr-spinner" /></div>
        ) : ordenes.length === 0 ? (
          <div className="vw-empty">
            <FaBoxOpen />
            <p>No hay ventas en este rango.</p>
          </div>
        ) : (
          <ul className="vw-list">
            {ordenes.map((o) => {
              const E = ENTREGA[o.entrega?.tipo] || ENTREGA.correos;
              // 🚚 Sin guía y el sistema ya no la va a hacer solo (falló, era de prueba u orden vieja): se puede hacer a mano
              const sinGuiaAuto = o.estado === "pagada" && o.entrega?.tipo !== "retiro" && !o.guia?.numero && (
                o.guia?.estado === "error" || o.guia?.estado === "omitida" ||
                (!o.guia?.estado && Date.now() - new Date(o.pagadaAt || o.createdAt).getTime() > 10 * 60 * 1000)
              );
              const abiertaEsta = abierta === o._id;
              const unidades = o.items.reduce((s, i) => s + i.cantidad, 0);
              const tel = String(o.cliente?.telefono || "");
              const porWa = o.metodoPago === "whatsapp";
              const alistadas = o.items.filter((i) => i.alistado?.at).length; // ✅
              const todoAlistado = o.estado === "pagada" && alistadas === o.items.length;
              const paso = o.estado !== "pagada" ? quePaso(o) : null; // ❓ sin pagar: qué pasó
              return (
                <li key={o._id} className={`vw-card is-${o.estado} ${porWa ? "is-wa" : ""} ${todoAlistado ? "is-alistada" : ""}`}>
                  <button type="button" className="vw-card-head" onClick={() => setAbierta(abiertaEsta ? null : o._id)} aria-expanded={abiertaEsta}>
                    <div className="vw-card-main">
                      <div className="vw-row1">
                        <strong className="vw-num">{o.orderNumber}</strong>
                        <span className={`vw-pill is-${o.estado}`}>
                          {o.estado === "pagada" ? <><FaCheckCircle /> Pagada</> : porWa ? <><FaWhatsapp /> WhatsApp</> : o.estado === "pendiente" ? <><FaClock /> Sin pagar</> : "Rechazada"}
                        </span>
                        {o.estado === "pagada" && alistadas > 0 && (
                          <span className={`vw-pill ${todoAlistado ? "is-alistada" : "is-alistando"}`}>
                            {todoAlistado ? <><FaCheckCircle /> Alistada</> : `Alistando ${alistadas}/${o.items.length}`}
                          </span>
                        )}
                        {o.tilopay?.environment && o.tilopay.environment !== "Production" && o.estado === "pagada" && (
                          <span className="vw-pill is-test">{o.tilopay.environment}</span>
                        )}
                      </div>
                      <span className="vw-client">{o.cliente?.nombre} {o.cliente?.apellidos}</span>
                      <span className="vw-meta">
                        {fechaHora(o.pagadaAt || o.createdAt)} · {unidades} {unidades === 1 ? "camiseta" : "camisetas"} · <E.icon /> {E.t}
                      </span>
                      {paso && (
                        <span className={`vw-why is-${paso.tipo}`}>
                          {paso.tipo === "wa" ? <FaWhatsapp /> : paso.tipo === "wait" ? <FaClock /> : <FaExclamationTriangle />} {paso.texto}
                        </span>
                      )}
                    </div>
                    <div className="vw-card-side">
                      <strong className="vw-total">{colones(o.total)}</strong>
                      {o.estado === "pagada" && (
                        <div className="vw-status">
                          <span className={`vw-dot is-${o.factura?.estado === "lista" ? "ok" : o.factura?.estado === "error" ? "bad" : "wait"}`} title="Factura" />
                          <span className={`vw-dot is-${o.stock?.estado === "listo" && !o.stock?.faltantes?.length ? "ok" : o.stock?.estado === "error" || o.stock?.faltantes?.length ? "bad" : "wait"}`} title="Stock" />
                          {o.entrega?.tipo !== "retiro" && (
                            <span className={`vw-dot is-${o.guia?.numero ? "ok" : o.guia?.estado === "error" ? "bad" : "wait"}`} title="Guía" />
                          )}
                        </div>
                      )}
                      <FaChevronDown className={`vw-chev ${abiertaEsta ? "is-open" : ""}`} />
                    </div>
                  </button>

                  {abiertaEsta && (
                    <div className="vw-detail">
                      {/* Camisetas */}
                      <ul className="vw-items">
                        {o.items.map((i, k) => (
                          <li key={k} className={i.alistado?.at ? "is-alistado" : ""}>
                            {o.estado === "pagada" && (
                              <button
                                type="button"
                                className={`vw-tick ${i.alistado?.at ? "is-on" : ""}`}
                                onClick={() => alistar(o, k)}
                                aria-pressed={Boolean(i.alistado?.at)}
                                title={i.alistado?.at ? "Quitar check" : "Ya la alisté"}
                              >
                                <FaCheck />
                              </button>
                            )}
                            <span className="vw-thumb">{i.imageSrc && <img src={cldThumb(i.imageSrc)} alt="" loading="lazy" />}</span>
                            <span className="vw-item-info">
                              <strong>{i.cantidad}× {i.name}</strong>
                              <small>Talla {i.talla === "U" ? "única" : i.talla}{i.dorsal?.name || i.dorsal?.number ? ` · ${textoDorsal(i.dorsal)}` : ""}</small>
                              {i.alistado?.at && (
                                <small className="vw-alistado">✓ Alistada{i.alistado.por ? ` por ${i.alistado.por}` : ""} · {fechaHora(i.alistado.at)}</small>
                              )}
                            </span>
                            <span className="vw-item-price">{colones(i.precio * i.cantidad)}</span>
                          </li>
                        ))}
                        <li className="vw-sum"><span>Envío ({E.t})</span><span>{o.envio ? colones(o.envio) : "Gratis"}</span></li>
                        <li className="vw-sum is-total"><span>Total</span><span>{colones(o.total)}</span></li>
                      </ul>

                      <div className="vw-grid">
                        {/* Cliente */}
                        <section className="vw-box">
                          <h3>Cliente</h3>
                          <p><FaIdCard /> {o.cliente?.cedula}</p>
                          <p><FaEnvelope /> <a href={`mailto:${o.cliente?.correo}`}>{o.cliente?.correo}</a></p>
                          <a className="vw-wa" href={`https://wa.me/506${tel}?text=${encodeURIComponent(`¡Hola ${o.cliente?.nombre}! Te escribimos de ChemaSport ER por tu orden ${o.orderNumber}.`)}`} target="_blank" rel="noopener noreferrer">
                            <FaWhatsapp /> {tel.replace(/(\d{4})(\d{4})/, "$1 $2")}
                          </a>
                        </section>

                        {/* Entrega */}
                        <section className="vw-box">
                          <h3><E.icon /> {E.t}</h3>
                          <p>{[o.entrega?.distrito, o.entrega?.canton, o.entrega?.provincia].filter(Boolean).join(", ")}</p>
                          {o.entrega?.senas && <p className="vw-senas">{o.entrega.senas}</p>}
                          {o.notas && (
                            <p className="vw-notas"><FaRegCommentDots /> <span><b>Observaciones:</b> {o.notas}</span></p>
                          )}
                        </section>

                        {/* Pago / factura / stock */}
                        <section className="vw-box">
                          <h3>{porWa ? <FaWhatsapp /> : <FaCreditCard />} Pago</h3>
                          {o.estado === "pagada" ? (
                            <p>Tilopay {o.tilopay?.card ? `· ${o.tilopay.card}` : ""} {o.tilopay?.last ? `•••• ${o.tilopay.last}` : ""}{o.tilopay?.auth ? ` · Aut. ${o.tilopay.auth}` : ""}</p>
                          ) : (
                            <p className={`vw-why is-${paso.tipo}`}>{paso.texto}</p>
                          )}

                          {o.estado === "pagada" && (
                            <>
                              <p className={`vw-state is-${o.factura?.estado === "lista" ? "ok" : o.factura?.estado === "error" ? "bad" : o.factura?.estado === "omitida" ? "off" : "wait"}`}>
                                <FaRegFileAlt />
                                <span>
                                  {o.factura?.estado === "lista" ? <>Factura {o.factura.tipo === "interno" ? "interna" : "electrónica"} {o.factura.consecutivo}{o.factura.correoEnviado ? " · enviada al correo" : ""}</>
                                    : o.factura?.estado === "error" ? <>Factura falló: {o.factura.error}</>
                                    : o.factura?.estado === "omitida" ? <>{o.factura.error}</>
                                    : "Facturando…"}
                                  <small className="vw-sub">El cliente pidió {o.facturaElectronica ? "factura electrónica" : "ticket interno (sin factura electrónica)"}</small>
                                </span>
                              </p>
                              <p className={`vw-state is-${o.stock?.estado === "listo" && !o.stock?.faltantes?.length ? "ok" : o.stock?.estado === "error" || o.stock?.faltantes?.length ? "bad" : "wait"}`}>
                                <FaBoxOpen />
                                <span>
                                  {o.stock?.estado === "listo"
                                    ? (o.stock.movimientos || []).map((m) => `${m.cantidad} de ${m.ubicacion} (${m.talla})`).join(" · ") || "Stock rebajado"
                                    : o.stock?.estado === "error" ? `Error rebajando stock: ${o.stock.error}`
                                    : o.stock?.estado === "omitido" ? o.stock.error : "Rebajando stock…"}
                                </span>
                              </p>
                              {o.stock?.faltantes?.length > 0 && (
                                <p className="vw-state is-bad"><FaExclamationTriangle /> <span>{o.stock.faltantes.join(" · ")}</span></p>
                              )}
                            </>
                          )}

                          {/* 🚚 Guía (o retiro en tienda: no lleva guía) */}
                          {o.estado === "pagada" && o.entrega?.tipo === "retiro" && (
                            <p className="vw-state is-ok"><FaStore /> <span>Recoger en la tienda</span></p>
                          )}
                          {o.estado === "pagada" && o.entrega?.tipo !== "retiro" && (
                            o.guia?.numero ? (
                              <p className="vw-state is-ok">
                                <FaTruck />
                                <span>
                                  Guía {o.guia.tipo}: <b>{o.guia.numero}</b>{o.guia.auto ? " · automática" : o.guia.por ? ` · por ${o.guia.por}` : ""}
                                </span>
                              </p>
                            ) : o.guia?.estado === "error" ? (
                              <p className="vw-state is-bad"><FaTruck /> <span>La guía {o.guia.tipo ? `de ${o.guia.tipo} ` : ""}falló: {o.guia.error}</span></p>
                            ) : o.guia?.estado === "omitida" ? (
                              <p className="vw-state is-off"><FaTruck /> <span>{o.guia.error}</span></p>
                            ) : sinGuiaAuto ? (
                              <p className="vw-state is-off"><FaTruck /> <span>Sin guía</span></p>
                            ) : (
                              <p className="vw-state is-wait"><FaTruck /> <span>Generando la guía…</span></p>
                            )
                          )}
                          {o.guia?.numero && (o.guia.correoEnviado ? (
                            <p className="vw-state is-ok"><FaRegEnvelope /> <span>Guía enviada al correo del cliente</span></p>
                          ) : o.guia.correoError ? (
                            <p className="vw-state is-bad"><FaRegEnvelope /> <span>Correo de la guía no enviado: {o.guia.correoError}</span></p>
                          ) : null)}
                          {o.estado === "pagada" && o.factura?.estado === "lista" && (o.entrega?.tipo === "retiro" || o.guia?.numero) && (
                            <p className="vw-ready"><FaBoxOpen /> {todoAlistado
                              ? <>Todo alistado{o.entrega?.tipo === "retiro" ? ": listo para que la recojan" : ": solo falta pegar la guía"}.</>
                              : <>Todo listo: solo falta alistar {unidades === 1 ? "la camiseta" : `las ${unidades} camisetas`}{o.entrega?.tipo === "retiro" ? " para que la recojan" : " y pegar la guía"}.</>}</p>
                          )}

                          <div className="vw-actions">
                            {(o.stock?.movimientos || []).some((m) => m.historyId) && (
                              <button type="button" className="vw-btn" onClick={() => copiarHistorial(o)}>
                                <FaRegCopy /> Copiar historial
                              </button>
                            )}
                            {o.factura?.pdfUrl && (
                              <a className="vw-btn" href={o.factura.pdfUrl} target="_blank" rel="noopener noreferrer"><FaFilePdf /> PDF</a>
                            )}
                            {o.guia?.numero && o.guia?.datos && (
                              <button type="button" className="vw-btn is-dark" onClick={() => imprimirGuia(o)}>
                                <FaPrint /> Imprimir guía
                              </button>
                            )}
                            {/* Solo si va a domicilio y todavía no tiene guía (la automática falló o era de prueba) */}
                            {sinGuiaAuto && (
                              <button type="button" className="vw-btn is-dark" disabled={accion === o._id} onClick={() => ejecutar(o, "guia-auto")}>
                                <FaMagic /> {accion === o._id ? "Generando…" : o.guia?.estado === "error" ? "Reintentar guía" : "Generar guía"}
                              </button>
                            )}
                            {sinGuiaAuto && (
                              <button type="button" className="vw-btn" onClick={() => setGuiaDe(o)}>
                                <FaTruck /> Hacer guía a mano
                              </button>
                            )}
                            {o.estado === "pagada" && (o.factura?.estado === "error" || o.factura?.estado === "omitida" || !o.factura?.estado) && (
                              <button type="button" className="vw-btn" disabled={accion === o._id} onClick={() => setFacturarDe(o)}>
                                <FaFileInvoice />
                                {accion === o._id ? "Facturando…" : o.factura?.estado === "error" ? "Reintentar factura" : "Facturar en Alegra"}
                              </button>
                            )}
                            {isSuperUser && (
                            <button
                              type="button"
                              className={`vw-btn vw-trash ${confirmarBorrar === o._id ? "is-danger" : ""}`}
                              disabled={accion === o._id}
                              onClick={() => borrar(o)}
                              title="Borrar venta"
                            >
                              <FaTrashAlt />
                              {confirmarBorrar === o._id
                                ? (o.stock?.movimientos?.length ? "¿Borrar? Devuelve el stock" : "¿Seguro? Tocá de nuevo")
                                : "Borrar"}
                            </button>
                            )}
                            {((o.estado === "pendiente" && !porWa) || o.stock?.estado === "error") && (
                              <button type="button" className="vw-btn" disabled={accion === o._id} onClick={() => ejecutar(o, "verificar")}>
                                <FaSyncAlt className={accion === o._id ? "vw-spin" : ""} /> {o.estado === "pendiente" ? "Verificar pago" : "Reintentar stock"}
                              </button>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ---- Paginado (10 por página) ---- */}
        {data.paginas > 1 && (
          <nav className="vw-pager" aria-label="Páginas">
            <button type="button" disabled={page <= 1 || cargando} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>‹ Anterior</button>
            <span>Página {data.page} de {data.paginas} · {data.total} {data.total === 1 ? "orden" : "órdenes"}</span>
            <button type="button" disabled={page >= data.paginas || cargando} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Siguiente ›</button>
          </nav>
        )}
      </div>

      {/* 🧾 Facturar: Interno o Hacienda (igual que en la Tienda) */}
      {facturarDe && (
        <ModalShell
          onClose={() => setFacturarDe(null)}
          icon={FaFileInvoice}
          eyebrow={`Orden ${facturarDe.orderNumber}`}
          title="Facturar en Alegra"
          subtitle={`${facturarDe.cliente?.nombre || ""} ${facturarDe.cliente?.apellidos || ""} · ${colones(facturarDe.total)}`}
          size="sm"
        >
          {(close) => (
            <div className="vw-fact">
              <button type="button" className="vw-fact-opt" onClick={() => { const o = facturarDe; close(); ejecutar(o, "facturar", { tipo: "hacienda" }); }}>
                <strong>Factura electrónica</strong>
                <small>Tiquete electrónico ante Hacienda · se envía al correo del cliente</small>
              </button>
              <button type="button" className="vw-fact-opt" onClick={() => { const o = facturarDe; close(); ejecutar(o, "facturar", { tipo: "interno" }); }}>
                <strong>Interno</strong>
                <small>Numeración interna, sin Hacienda</small>
              </button>
            </div>
          )}
        </ModalShell>
      )}

      {guiaDe && (
        <GuiaPedidoModal
          key={guiaDe._id}
          orden={guiaDe}
          onClose={() => setGuiaDe(null)}
          onDone={(orden) => reemplazar(orden)}
        />
      )}
    </div>
  );
}
