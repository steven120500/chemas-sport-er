// src/components/GuiaPedidoModal.jsx
// 🚚 Atajo "Hacer guía" desde un pedido que ya llegó.
// Jala nombre, teléfono, camisetas y saldo del pedido; solo se escoge Correos o Mensajero y se pone la dirección.
// Hace exactamente lo mismo que las pantallas de /guias:
//   - Mensajero → POST /api/guias (queda en la lista de guías de mensajero) + PDF 4x6
//   - Correos   → POST /api/correos/generar-guia (guía REAL en Correos, queda en su historial) + PDF oficial
// y al final anota el número de guía en el pedido (PUT /api/pedidos/:id/guia).
// 🛒 También se usa desde Ventas web con `orden` (orden de la tienda online): jala sus datos y dirección,
//    anota la guía en la orden (POST /api/checkout/admin/ordenes/:id/guia) y, si es Correos, manda el PDF al correo del cliente.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast as toastHOT } from "react-hot-toast";
import { FaTruck, FaCheck, FaMotorcycle, FaEnvelope } from "react-icons/fa";
import ModalShell from "./ModalShell";
import LoadingOverlay from "./LoadingOverlay";
import { API_BASE } from "../authFetch";
import { generarPdfMensajero, generarPdfOficialCorreos } from "../utils/guiasPdf";
import { saldoDe, textoRecogerRaspa } from "../utils/pedidosPago";

// Mismas opciones que el formulario de GuiasPage (mensajero)
const PROVINCIAS_MENSAJERO = ["Alajuela", "Cartago", "Heredia", "San José"];
const COMENTARIOS = ["Sin comentario", "ENTREGAR MISMO DIA", "PAQUETE PARA JOHAN", "Otro comentario..."];

const soloDigitos = (v, max) => String(v || "").replace(/\D/g, "").slice(0, max);
const normNombre = (s = "") => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const detalleOrden = (o) => {
  const n = (o?.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  return n ? `${n} ${n === 1 ? "camiseta" : "camisetas"}` : "Paquete";
};
const fechaLocalYMD = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Catálogos geográficos de Correos (misma caché de sesión que GuiasCorreos) */
async function catalogoCCR(cacheKey, path) {
  try {
    const c = sessionStorage.getItem(cacheKey);
    if (c) return JSON.parse(c);
  } catch { /* sin caché */ }
  const res = await fetch(`${API_BASE}/api/correos/${path}`).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!data.exito || !data.datos) throw new Error("No se pudo conectar con Correos CR");
  try { sessionStorage.setItem(cacheKey, JSON.stringify(data.datos)); } catch { /* sin caché */ }
  return data.datos;
}

async function postJSON(url, body, method = "POST") {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export default function GuiaPedidoModal({ pedido, orden, onClose, onDone }) {
  const esOrden = Boolean(orden); // 🛒 orden de la tienda online (ya pagada: no debe nada)
  const p = pedido || {};
  const ent = orden?.entrega || {};
  const saldo = esOrden ? 0 : saldoDe(p); // adelanto + abonos
  const recogerRaspa = esOrden ? "" : textoRecogerRaspa(p);
  const guiaActual = esOrden ? orden.guia : p.guia;
  const [tipo, setTipo] = useState(guiaActual?.tipo || (esOrden && ent.tipo === "mensajero" ? "Mensajero" : "Correos"));
  const [nombre, setNombre] = useState(esOrden ? `${orden.cliente?.nombre || ""} ${orden.cliente?.apellidos || ""}`.trim() : p.cliente?.nombre || "");
  const [telefono, setTelefono] = useState(soloDigitos((esOrden ? orden.cliente : p.cliente)?.telefono, 8));
  const [detalle, setDetalle] = useState(esOrden ? detalleOrden(orden) : "Paquete"); // predeterminado; se puede cambiar
  const [enviarCorreo, setEnviarCorreo] = useState(true); // solo órdenes web + Correos
  const [generando, setGenerando] = useState(false);
  const [pasoCarga, setPasoCarga] = useState(""); // texto del loading mientras se genera
  const comentarioOrden = esOrden ? [`Orden ${orden.orderNumber}`, ent.senas].filter(Boolean).join(" · ") : "";

  // --- Mensajero ---
  const [msj, setMsj] = useState({
    provincia: esOrden && PROVINCIAS_MENSAJERO.includes(ent.provincia) ? ent.provincia : "",
    canton: esOrden ? ent.canton || "" : "",
    distrito: esOrden ? ent.distrito || "" : "",
    debe: saldo > 0 ? "Sí" : "No", monto: saldo > 0 ? String(saldo) : "",
    meterRaspa: esOrden ? "Sí" : "No", // 🎟️ ventas web: siempre se mete raspa
    // 🎟️ Si el pedido usó raspa, el mensajero la tiene que recoger para que valga el precio
    comentarioSelect: recogerRaspa || comentarioOrden ? "Otro comentario..." : "Sin comentario",
    comentarioCustom: recogerRaspa || comentarioOrden,
  });

  // --- Correos ---
  const [ccr, setCcr] = useState({ tipoEnvio: "DOM", provincia: "", canton: "", distrito: "", direccion: esOrden ? ent.senas || "" : "", codigoSucursal: "" });
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [errorCCR, setErrorCCR] = useState("");
  const [intento, setIntento] = useState(0);
  const falloCCR = (e) => setErrorCCR(e.message);

  useEffect(() => {
    if (tipo !== "Correos" || provincias.length) return;
    setErrorCCR("");
    catalogoCCR("ccr_provincias", "provincias").then(setProvincias).catch(falloCCR);
  }, [tipo, provincias.length, intento]);
  // 🛡️ En cada carga se ignora la respuesta si mientras tanto cambiaron provincia/cantón (si no, la lista vieja tapa la nueva)
  useEffect(() => {
    setCantones([]);
    let vigente = true;
    if (ccr.provincia) catalogoCCR(`ccr_cantones_${ccr.provincia}`, `cantones/${ccr.provincia}`).then((d) => vigente && setCantones(d)).catch((e) => vigente && falloCCR(e));
    return () => { vigente = false; };
  }, [ccr.provincia]);
  useEffect(() => {
    setDistritos([]);
    setSucursales([]);
    let vigente = true;
    if (ccr.provincia && ccr.canton) {
      catalogoCCR(`ccr_distritos_${ccr.provincia}_${ccr.canton}`, `distritos/${ccr.provincia}/${ccr.canton}`).then((d) => vigente && setDistritos(d)).catch((e) => vigente && falloCCR(e));
    }
    return () => { vigente = false; };
  }, [ccr.provincia, ccr.canton]);
  useEffect(() => {
    let vigente = true;
    if (ccr.tipoEnvio === "SUC" && ccr.provincia && ccr.canton) {
      catalogoCCR(`ccr_sucursales_${ccr.provincia}_${ccr.canton}`, `sucursales/${ccr.provincia}/${ccr.canton}`).then((d) => vigente && setSucursales(d)).catch((e) => vigente && falloCCR(e));
    }
    return () => { vigente = false; };
  }, [ccr.tipoEnvio, ccr.provincia, ccr.canton]);

  // 🛒 Orden web: escoger sola la provincia/cantón/distrito de Correos que coincide por nombre (una vez cada uno)
  const autoCCR = useRef({ provincia: false, canton: false, distrito: false });
  useEffect(() => {
    if (!esOrden || autoCCR.current.provincia || !provincias.length) return;
    autoCCR.current.provincia = true;
    const m = provincias.find((x) => normNombre(x.nombre) === normNombre(ent.provincia));
    if (m) setCcr((s) => ({ ...s, provincia: String(m.codigo), canton: "", distrito: "" }));
  }, [esOrden, provincias, ent.provincia]);
  useEffect(() => {
    if (!esOrden || autoCCR.current.canton || !cantones.length) return;
    autoCCR.current.canton = true;
    const m = cantones.find((x) => normNombre(x.nombre) === normNombre(ent.canton));
    if (m) setCcr((s) => ({ ...s, canton: String(m.codigo), distrito: "" }));
  }, [esOrden, cantones, ent.canton]);
  useEffect(() => {
    if (!esOrden || autoCCR.current.distrito || !distritos.length) return;
    autoCCR.current.distrito = true;
    const m = distritos.find((x) => normNombre(x.nombre) === normNombre(ent.distrito));
    if (m) setCcr((s) => ({ ...s, distrito: String(m.codigo) }));
  }, [esOrden, distritos, ent.distrito]);

  const nombreDe = (lista, cod) => (lista.find((x) => String(x.codigo) === String(cod))?.nombre || "").trim();
  const codigoPostal = useMemo(
    () => distritos.find((d) => String(d.codigo) === String(ccr.distrito))?.codigoPostal || "",
    [distritos, ccr.distrito]
  );

  /* ---------- Generar ---------- */
  const hacerMensajero = async () => {
    const m = msj;
    if (!m.provincia || !m.canton.trim() || !m.distrito.trim()) throw new Error("Falta provincia, cantón o distrito.");
    const monto = Number(soloDigitos(m.monto, 9)) || 0;
    if (m.debe === "Sí" && monto <= 0) throw new Error("Poné el monto que debe el cliente.");
    if (m.comentarioSelect === "Otro comentario..." && !m.comentarioCustom.trim()) throw new Error("Escribí el comentario.");
    const comentario = m.comentarioSelect === "Otro comentario..." ? m.comentarioCustom.trim() : m.comentarioSelect;

    // Mismo formato que GuiasPage.handleSubmit
    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaFormateada = ahora.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
    const guia = {
      numeroGuia: `CS-${String(Date.now()).slice(-6)}`,
      nombre: nombre.trim(),
      provincia: m.provincia,
      canton: m.canton.trim(),
      distrito: m.distrito.trim(),
      telefono: telefono.trim(),
      debe: m.debe,
      monto: m.debe === "Sí" ? String(monto) : "0",
      meterRaspa: m.meterRaspa,
      esMayorista: "No",
      nombreMayorista: "",
      comentarios: comentario === "Sin comentario" ? "" : comentario,
      fechaEntrega: esOrden ? ent.fechaEntrega || "" : "", // 🛵 el día que escogió el cliente en la web, calcado
      fechaYMD: fechaLocalYMD(ahora),
      fecha: `${fechaFormateada} ${horaFormateada}`,
    };
    const { res, data } = await postJSON("/api/guias", guia);
    if (!res.ok) throw new Error(data.error || "No se pudo guardar la guía");

    const { doc, fileName } = await generarPdfMensajero(guia);
    doc.save(fileName);
    return { numero: guia.numeroGuia, datos: guia };
  };

  const hacerCorreos = async () => {
    const c = ccr;
    if (telefono.length !== 8) throw new Error("El teléfono debe tener 8 dígitos.");
    if (!c.provincia || !c.canton || !c.distrito) throw new Error("Falta provincia, cantón o distrito.");
    if (c.tipoEnvio === "SUC" && !c.codigoSucursal) throw new Error("Escogé la sucursal.");
    if (c.tipoEnvio === "DOM" && !c.direccion.trim()) throw new Error("Poné la dirección exacta (señas).");
    if (!detalle.trim()) throw new Error("Poné qué lleva el paquete.");

    // Mismo formato de dirección que GuiasCorreos.handleSubmit
    const prefijo = [nombreDe(provincias, c.provincia), nombreDe(cantones, c.canton), nombreDe(distritos, c.distrito)].filter(Boolean).join(", ");
    const destDireccion = c.tipoEnvio === "SUC"
      ? `${prefijo}, Sucursal ${c.codigoSucursal}: ${nombreDe(sucursales, c.codigoSucursal)}`
      : `${prefijo}, ${c.direccion.trim()}`;
    const payload = {
      destNombre: nombre.trim(),
      destDireccion,
      destTelefono: telefono,
      destZip: codigoPostal || "10101",
      peso: 500,
      observaciones: detalle.trim(),
      tipoDestino: c.tipoEnvio,
      codigoSucursal: c.tipoEnvio === "SUC" ? c.codigoSucursal : "",
      fechaYyyyMmDd: new Date().toISOString().split("T")[0],
      fechaFormateada: new Date().toLocaleDateString("es-CR"),
    };
    const { res, data } = await postJSON("/api/correos/generar-guia", payload);
    if (!res.ok || !data.exito) throw new Error(data.mensaje || data.error || "Correos no aceptó la guía");

    const numero = data.datos?.enviold || data.datos?.envioId || data.guiaGuardada?.enviold;
    const datos = data.guiaGuardada || {
      enviold: numero,
      nombre: payload.destNombre,
      telefono: payload.destTelefono,
      tipoEnvio: payload.tipoDestino === "SUC" ? "Sucursal" : "Domicilio",
      direccion: payload.destDireccion,
      detalleEnvio: payload.observaciones,
      codigoPostal: payload.destZip,
      codigoSucursal: payload.codigoSucursal,
      fechaYyyyMmDd: payload.fechaYyyyMmDd,
      fechaFormateada: payload.fechaFormateada,
    };
    const doc = generarPdfOficialCorreos(datos);
    return { numero, doc, datos };
  };

  const generar = async (close) => {
    if (generando) return;
    if (!nombre.trim()) return toastHOT.error("Falta el nombre.");
    if (!telefono.trim()) return toastHOT.error("Falta el teléfono.");
    setGenerando(true);
    setPasoCarga(tipo === "Correos" ? "Generando la guía en Correos de Costa Rica…" : "Guardando la guía del mensajero…");
    const toastId = toastHOT.loading(tipo === "Correos" ? "Generando guía en Correos CR…" : "Guardando guía de mensajero…");
    try {
      const r = tipo === "Correos" ? await hacerCorreos() : await hacerMensajero();
      const numero = r.numero;
      if (esOrden) {
        // 🛒 Orden web: anotar la guía y (Correos) mandar el PDF al correo del cliente
        const mandar = tipo === "Correos" && enviarCorreo;
        setPasoCarga(mandar ? "Enviando la guía al correo del cliente…" : "Anotando la guía en la orden…");
        let pdfBase64 = "";
        try { if (mandar && r.doc) pdfBase64 = r.doc.output("datauristring"); } catch { /* sin PDF: va solo el número */ }
        const { res, data } = await postJSON(`/api/checkout/admin/ordenes/${orden._id}/guia`, { numero, tipo, pdfBase64, enviarCorreo: mandar, datos: r.datos });
        if (res.ok) {
          onDone(data);
          if (mandar && !data.guia?.correoEnviado) toastHOT.error(`La guía se hizo, pero no se pudo mandar el correo: ${data.guia?.correoError || ""}`, { duration: 9000 });
        } else toastHOT.error(`La guía ${numero} se hizo, pero no se pudo anotar en la orden: ${data.error || ""}`);
        toastHOT.success(`Guía ${numero} lista${mandar && res.ok && data.guia?.correoEnviado ? " y enviada al cliente" : ""}`, { id: toastId });
      } else {
        setPasoCarga("Anotando la guía en el pedido…");
        // La guía ya existe y quedó en su lista: si falla anotarla en el pedido, solo se avisa
        const { res, data } = await postJSON(`/api/pedidos/${p._id}/guia`, { numero, tipo }, "PUT");
        if (res.ok) onDone(data);
        else toastHOT.error(`La guía ${numero} se hizo, pero no se pudo anotar en el pedido: ${data.error || ""}`);
        toastHOT.success(`Guía ${numero} lista: PDF descargado y guardada en Guías`, { id: toastId });
      }
      close();
    } catch (e) {
      toastHOT.error(e.message, { id: toastId });
    } finally {
      setGenerando(false);
      setPasoCarga("");
    }
  };

  const setM = (k) => (e) => setMsj((s) => ({ ...s, [k]: e.target.value }));
  const setC = (k) => (e) =>
    setCcr((s) => {
      const v = e.target.value;
      if (k === "provincia") return { ...s, provincia: v, canton: "", distrito: "", codigoSucursal: "" };
      if (k === "canton") return { ...s, canton: v, distrito: "", codigoSucursal: "" };
      return { ...s, [k]: v };
    });

  return (
    <>
    {/* ⏳ Loading encima del modal mientras se genera (Correos puede tardar varios segundos) */}
    {generando && createPortal(<div className="md-loading-top"><LoadingOverlay message={pasoCarga || "Generando guía…"} /></div>, document.body)}
    <ModalShell
      onClose={onClose}
      icon={FaTruck}
      eyebrow={esOrden ? `Orden ${orden.orderNumber}` : `Pedido #${p.numero}`}
      title="Hacer guía"
      subtitle={guiaActual?.numero
        ? `Ya tiene la guía ${guiaActual.numero} (${guiaActual.tipo}). Si hacés otra, se reemplaza en ${esOrden ? "la orden" : "el pedido"}.`
        : esOrden ? `El cliente escogió ${ent.tipo === "mensajero" ? "mensajero" : ent.tipo === "retiro" ? "retiro en tienda" : "Correos"}. Los datos ya vienen puestos.` : "Los datos del pedido ya vienen puestos."}
      closeOnBackdrop={false}
      footer={(close) => (
        <>
          <button type="button" className="md-btn is-ghost" onClick={close}>Cancelar</button>
          <button type="button" className="md-btn is-primary" disabled={generando} onClick={() => generar(close)}>
            {generando ? <span className="md-spinner" /> : <FaCheck />} Generar y descargar
          </button>
        </>
      )}
    >
      <div className="md-seg" role="tablist">
        {[
          { key: "Correos", label: "Correos de CR", icon: <FaEnvelope />, color: "#0f2d5c" },
          { key: "Mensajero", label: "Mensajero", icon: <FaMotorcycle />, color: "#000" },
        ].map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tipo === t.key} className={`md-seg-btn ${tipo === t.key ? "is-active" : ""}`} style={{ "--seg": t.color }} onClick={() => setTipo(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="md-section">
        <span className="md-section-title">Cliente</span>
        <div className="md-row pd-stack-sm">
          <label className="md-field">
            <span className="md-label">Nombre *</span>
            <input className="md-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="md-field">
            <span className="md-label">Teléfono *</span>
            <input className="md-input" type="tel" inputMode="numeric" value={telefono} onChange={(e) => setTelefono(soloDigitos(e.target.value, 8))} placeholder="88888888" />
          </label>
        </div>
      </div>

      {tipo === "Mensajero" ? (
        <>
          <div className="md-section">
            <span className="md-section-title">Dirección</span>
            <label className="md-field">
              <span className="md-label">Provincia *</span>
              <select className="md-input" value={msj.provincia} onChange={setM("provincia")}>
                <option value="" disabled>Escogé provincia</option>
                {PROVINCIAS_MENSAJERO.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <div className="md-row pd-stack-sm">
              <label className="md-field">
                <span className="md-label">Cantón *</span>
                <input className="md-input" value={msj.canton} onChange={setM("canton")} />
              </label>
              <label className="md-field">
                <span className="md-label">Distrito *</span>
                <input className="md-input" value={msj.distrito} onChange={setM("distrito")} />
              </label>
            </div>
          </div>
          <div className="md-section">
            <span className="md-section-title">Cobro y detalles</span>
            <div className="md-row pd-stack-sm">
              <label className="md-field">
                <span className="md-label">¿Debe?</span>
                <select className="md-input" value={msj.debe} onChange={(e) => setMsj((s) => ({ ...s, debe: e.target.value, monto: e.target.value === "No" ? "" : s.monto || String(saldo || "") }))}>
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </label>
              {msj.debe === "Sí" && (
                <label className="md-field">
                  <span className="md-label">Monto a cobrar</span>
                  <div className="md-affix">
                    <span className="md-affix-sign">₡</span>
                    <input className="md-input is-money" inputMode="numeric" value={msj.monto} onChange={(e) => setMsj((s) => ({ ...s, monto: soloDigitos(e.target.value, 9) }))} />
                  </div>
                </label>
              )}
              <label className="md-field">
                <span className="md-label">Raspa</span>
                <select className="md-input" value={msj.meterRaspa} onChange={setM("meterRaspa")}>
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </label>
            </div>
            <label className="md-field">
              <span className="md-label">Comentario</span>
              <select className="md-input" value={msj.comentarioSelect} onChange={setM("comentarioSelect")}>
                {COMENTARIOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            {msj.comentarioSelect === "Otro comentario..." && (
              <label className="md-field">
                <span className="md-label">Otro comentario *</span>
                <textarea className="md-input" rows={2} value={msj.comentarioCustom} onChange={setM("comentarioCustom")} />
              </label>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="md-section is-blue">
            <span className="md-section-title">Dirección (Correos)</span>
            <div className="md-seg">
              {[{ key: "DOM", label: "A domicilio" }, { key: "SUC", label: "A sucursal" }].map((t) => (
                <button key={t.key} type="button" className={`md-seg-btn ${ccr.tipoEnvio === t.key ? "is-active" : ""}`} style={{ "--seg": "#0f2d5c" }} onClick={() => setCcr((s) => ({ ...s, tipoEnvio: t.key, codigoSucursal: "" }))}>
                  {t.label}
                </button>
              ))}
            </div>
            <label className="md-field">
              <span className="md-label">Provincia *</span>
              <select className="md-input" value={ccr.provincia} onChange={setC("provincia")}>
                <option value="">{provincias.length ? "Escogé provincia" : errorCCR ? "Sin conexión con Correos" : "Cargando…"}</option>
                {provincias.map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
              </select>
            </label>
            <div className="md-row pd-stack-sm">
              <label className="md-field">
                <span className="md-label">Cantón *</span>
                <select className="md-input" value={ccr.canton} onChange={setC("canton")} disabled={!ccr.provincia}>
                  <option value="">Escogé cantón</option>
                  {cantones.map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
                </select>
              </label>
              <label className="md-field">
                <span className="md-label">Distrito *</span>
                <select className="md-input" value={ccr.distrito} onChange={setC("distrito")} disabled={!ccr.canton}>
                  <option value="">Escogé distrito</option>
                  {distritos.map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
                </select>
              </label>
            </div>
            {errorCCR && (
              <p className="pd-note is-red">
                {errorCCR}.{" "}
                <button type="button" className="pd-link" onClick={() => { setProvincias([]); setIntento((n) => n + 1); }}>Reintentar</button>
              </p>
            )}
            {ccr.tipoEnvio === "SUC" ? (
              <label className="md-field">
                <span className="md-label">Sucursal *</span>
                <select className="md-input" value={ccr.codigoSucursal} onChange={setC("codigoSucursal")} disabled={!ccr.canton}>
                  <option value="">{ccr.canton && !sucursales.length ? "Sin sucursales / cargando…" : "Escogé sucursal"}</option>
                  {sucursales.map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
                </select>
              </label>
            ) : (
              <label className="md-field">
                <span className="md-label">Dirección exacta (señas) *</span>
                <textarea className="md-input" rows={2} value={ccr.direccion} onChange={setC("direccion")} placeholder="De la iglesia 200 m norte, casa verde…" />
              </label>
            )}
          </div>
          <div className="md-section">
            <span className="md-section-title">Paquete</span>
            <label className="md-field">
              <span className="md-label">Qué lleva *</span>
              <textarea className="md-input" rows={2} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Paquete" />
            </label>
            {saldo > 0 && <p className="pd-note">Ojo: el cliente todavía debe {`₡${saldo.toLocaleString("de-DE")}`}.</p>}
            {esOrden && (
              <label className="vw-check">
                <input type="checkbox" checked={enviarCorreo} onChange={(e) => setEnviarCorreo(e.target.checked)} />
                <span>Mandar la guía (PDF) al correo del cliente: <b>{orden.cliente?.correo || "sin correo"}</b></span>
              </label>
            )}
          </div>
        </>
      )}
    </ModalShell>
    </>
  );
}
