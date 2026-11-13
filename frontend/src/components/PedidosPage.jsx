// src/components/PedidosPage.jsx
// 🧾 Panel /admin: pedidos por encargo que registran los empleados (clientes de WhatsApp).
// Flujo semanal:
//   1. "Esta semana": los empleados registran pedidos → "Por revisar" (estado Nuevo).
//      Johanna los revisa y toca "Mandar a confirmar" → "Por confirmar": al empleado que lo registró le sale
//      para mandarle la imagen al cliente; cuando el cliente dice que sí, toca "Cliente confirmó" → "Confirmado".
//      Confirmado = entra oficialmente al pedido; desde ahí solo Johanna / súper admin lo editan.
//   2. El viernes el súper admin o Johanna tocan "Cerrar pedido semanal" → se crea el Pedido #N
//      con los pedidos Confirmados (estado Pedido, ya no se editan). Los que faltan se quedan para el próximo.
//      Se exporta a Excel para el proveedor.
//   💵 Abonos: el cliente puede abonar en cualquier momento; el pendiente = total − adelanto − abonos.
//   3. Cuando llega, tocan "Ya llegó" → cada pedido queda listo para avisar.
//   4. Dentro del Pedido #N: botón de WhatsApp por cliente (copia el mensaje, abre su chat → Avisado)
//      botón "Guía" (Correos o mensajero: la dirección se pide hasta aquí) y "Entregado" (→ Completado).
// ⚠️ Estilos en index.css (sección "PEDIDOS", clases pd-*). Los modales usan ModalShell (md-*).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast as toastHOT } from "react-hot-toast";
import {
  FaChevronLeft, FaClipboardList, FaPlus, FaFileExcel, FaSearch, FaWhatsapp,
  FaPen, FaTrash, FaTimes, FaCheck, FaUser, FaTruck, FaChevronRight, FaImage, FaLock, FaBoxOpen, FaUndo,
  FaPaperPlane, FaMoneyBillWave, FaUserCheck,
} from "react-icons/fa";
import ModalShell from "./ModalShell";
import GuiaPedidoModal from "./GuiaPedidoModal";
import { API_BASE } from "../authFetch";
import tallaPorTipo from "../utils/tallaPorTipo";
import { compartirImagenPedido } from "../utils/pedidoImagen";
const esMangaLarga = (it) => it?.manga === "Larga";
import { abonadoDe, pagadoDe, saldoDe, METODOS_ABONO, RASPAS, raspaLabel, precioItemDe, listaRaspas } from "../utils/pedidosPago";

/* ================= CONSTANTES ================= */
const ESTADO_INFO = {
  Nuevo: { label: "Por revisar", color: "#2563eb" },
  "Por confirmar": { label: "Por confirmar", color: "#ea580c" },
  Confirmado: { label: "Confirmado", color: "#0d9488" },
  Pedido: { label: "Pedido al proveedor", color: "#9333ea" },
  "Llegó": { label: "Llegó · por avisar", color: "#d97706" },
  Avisado: { label: "Avisado", color: "#16a34a" },
  Completado: { label: "Completado", color: "#000000" },
};
const VERSIONES = ["Fan", "Player", "Retro", "Mujer", "Niño", "Nacional", "Abrigos", "NBA", "F1", "MLB", "NFL", "Balón"];

/* ================= AYUDAS ================= */
const colones = (n) => `₡${Number(n || 0).toLocaleString("de-DE")}`;

// Nunca mostrar Cloudinary sin transformar (ver CLAUDE.md)
const cld = (url, t) => (url && url.includes("res.cloudinary.com") && url.includes("/upload/") ? url.replace("/upload/", `/upload/${t}/`) : url);
const thumb = (url) => cld(url, "f_auto,q_auto:eco,c_fill,w_160,h_184");
const fotoGrande = (url) => cld(url, "f_auto,q_auto:eco,c_limit,w_1000");

const sinParche = (p) => !p || /^(n\/?a|none|no|sin parche)$/i.test(p);
const yaLlego = (estado) => ["Llegó", "Avisado", "Completado"].includes(estado);

function lineaItem(it) {
  const partes = [it.equipo];
  if (it.version) partes.push(it.version);
  partes.push(`Talla ${it.talla}`);
  if (esMangaLarga(it)) partes.push("Manga larga");
  const dorsal = [it.nombre, it.dorsal ? `#${it.dorsal}` : ""].filter(Boolean).join(" ");
  if (dorsal) partes.push(dorsal);
  if (!sinParche(it.parche)) partes.push(`Parche: ${it.parche}`);
  else if (it.fotoParche) partes.push("Parche (ver foto)");
  if ((it.cantidad || 1) > 1) partes.push(`x${it.cantidad}`);
  if (it.raspa > 0) partes.push(`${raspaLabel(it.raspa)} (${colones(precioItemDe(it))})`);
  return partes.join(" · ");
}

/** 🎟️ Si el pedido usó raspa: el cliente tiene que dársela al mensajero para que valga el precio */
function avisoRaspa(p) {
  const lista = listaRaspas(p); // una raspa por camisa: "2 raspas de 20% y 1 raspa de regalía"
  if (!lista) return [];
  return ["", `🎟️ *Importante:* ocupamos que le entregués ${lista} al mensajero (o en tienda) para que sea válido el precio que te dimos.`];
}

/** Mensaje para avisarle al cliente que su pedido ya llegó */
function mensajeAviso(p) {
  const saldo = saldoDe(p); // ya descuenta los abonos
  const nombre = (p.cliente?.nombre || "").trim().split(/\s+/)[0] || "";
  // La dirección no se pide al registrar el pedido: se pide aquí, cuando ya llegó
  const entrega = "Pasanos tu dirección completa (provincia, cantón, distrito y señas) para enviártelo 📦";
  return [
    `¡Hola${nombre ? ` ${nombre}` : ""}! 👋 Te escribimos de *ChemaSport ER*.`,
    `Tu pedido #${p.numero} ya llegó ⚽🎉`,
    "",
    ...(p.items || []).map((it) => `• ${lineaItem(it)}`),
    "",
    saldo > 0 ? `Saldo pendiente: *${colones(saldo)}*` : "Tu pedido ya está cancelado por completo ✅",
    ...avisoRaspa(p),
    entrega,
    "",
    "¡Gracias por tu compra! 🙌",
  ].join("\n");
}

/** Número de WhatsApp: 8 dígitos de CR → 506XXXXXXXX */
function telefonoWa(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (d.length === 8) return `506${d}`;
  return d;
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Respaldo para navegadores sin permiso de portapapeles
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/api/pedidos${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de conexión");
  return data;
}

async function descargarExcel(query, nombre) {
  const res = await fetch(`${API_BASE}/api/pedidos/exportar?${query}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "No se pudo exportar");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 📲 Copia el mensaje "ya llegó", abre el chat del cliente y marca el pedido como Avisado */
async function avisarCliente(p) {
  const texto = mensajeAviso(p);
  // El chat se abre en el mismo toque (si se espera al portapapeles, Safari bloquea la ventana)
  const copia = copiarTexto(texto);
  const wa = telefonoWa(p.cliente?.telefono);
  if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  else toastHOT("El pedido no tiene teléfono: el mensaje quedó copiado.", { icon: "📋" });
  await copia;
  return api(`/${p._id}/estado`, { method: "PUT", body: { estado: "Avisado" } });
}

function EstadoBadge({ estado }) {
  const info = ESTADO_INFO[estado] || { label: estado, color: "#71717a" };
  return (
    <span className="pd-badge" style={{ "--c": info.color }}>
      <i aria-hidden="true" />
      {info.label}
    </span>
  );
}

/** Botón que pide un segundo toque para confirmar (sin window.confirm) */
function BotonConfirmar({ className, onConfirm, children, confirmText, disabled }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button
      type="button"
      className={`${className} ${armado ? "is-armed" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (!armado) return setArmado(true);
        setArmado(false);
        onConfirm();
      }}
    >
      {armado ? confirmText : children}
    </button>
  );
}

/* ---------- Fila de un pedido (lista) ---------- */
function PedidoRow({ p, onOpen, acciones }) {
  const unidades = p.items.reduce((a, it) => a + (it.cantidad || 1), 0);
  const fotos = p.items.map((it) => it.fotos?.[0]).filter(Boolean).slice(0, 3);
  const saldo = saldoDe(p);
  return (
    <div className="pd-row-wrap">
      <button type="button" className="pd-row" onClick={() => onOpen(p)}>
        <div className="pd-row-thumbs">
          {fotos.length ? fotos.map((f, i) => <img key={i} src={thumb(f)} alt="" loading="lazy" />) : <span className="pd-noimg"><FaImage /></span>}
        </div>
        <div className="pd-row-main">
          <div className="pd-row-top">
            <span className="pd-num">#{p.numero}</span>
            <EstadoBadge estado={p.estado} />
            {p.loteNumero && p.estado !== "Pedido" && <span className="pd-mini">Semana #{p.loteNumero}</span>}
          </div>
          <strong className="pd-row-client">{p.cliente?.nombre}</strong>
          <span className="pd-row-items">{p.items.map((it) => `${it.equipo} (${it.talla})`).join(" · ")}</span>
          <span className="pd-row-meta">
            {p.fecha} · {unidades} {unidades === 1 ? "camiseta" : "camisetas"}
          </span>
          {/* Quién lo registró = quién le avisa al cliente: bien visible */}
          {p.registradoPor && <span className="pd-row-colab"><FaUser /> {p.registradoPor}</span>}
        </div>
        <div className="pd-row-money">
          <b>{colones(p.total)}</b>
          {saldo > 0 ? <small className="is-red">Pendiente {colones(saldo)}</small> : <small className="is-green">Pagado</small>}
          <FaChevronRight className="pd-row-arrow" />
        </div>
      </button>
      {acciones && <div className="pd-row-actions">{acciones}</div>}
    </div>
  );
}

/* ================= PÁGINA ================= */
export default function PedidosPage({ user }) {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const vista = sp.get("vista") || "semana"; // semana | semanales | buscar
  const loteId = sp.get("lote") || "";
  const irA = (params) => setSp(params, { replace: false });

  const [permisos, setPermisos] = useState({ puedeCerrar: false, isSuperUser: false, id: "", nombre: "" });
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState(null); // { pedido?: obj }
  const [guia, setGuia] = useState(null); // pedido al que se le hace la guía
  const [version, setVersion] = useState(0); // fuerza recarga de las vistas
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!user) return;
    api("/permisos").then(setPermisos).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen adm-page pt-8 sm:pt-10 pb-32 px-4">
        <div className="pd-wrap">
          <div className="pd-card pd-empty">
            <FaClipboardList size={28} />
            <h2>Pedidos</h2>
            <p>Iniciá sesión desde el menú para ver y registrar pedidos.</p>
            <button type="button" className="pd-btn is-dark" onClick={() => navigate("/")}>
              <FaChevronLeft /> Volver al catálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const vistas = [
    { key: "semana", label: "Esta semana" },
    { key: "semanales", label: "Pedidos semanales" },
    { key: "buscar", label: "Buscar" },
  ];

  return (
    <div className="min-h-screen adm-page pt-8 sm:pt-10 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black relative">
      <div className="pd-wrap">
        <button type="button" className="pd-back" onClick={() => navigate("/")}>
          <FaChevronLeft size={11} /> Volver al catálogo
        </button>

        <div className="pd-card pd-hero">
          <div>
            <span className="pd-eyebrow"><FaClipboardList /> Pedidos por encargo</span>
            <h1>ChemaSport ER · Pedidos</h1>
            <p>Registrá los pedidos de la semana; el viernes se cierran y se piden al proveedor.</p>
          </div>
          <div className="pd-hero-actions">
            <button type="button" className="pd-btn is-dark" onClick={() => setForm({})}>
              <FaPlus /> Nuevo pedido
            </button>
          </div>
        </div>

        {!loteId && (
          <div className="pd-views" role="tablist">
            {vistas.map((v) => (
              <button key={v.key} type="button" role="tab" aria-selected={vista === v.key} className={`pd-view ${vista === v.key ? "is-active" : ""}`} onClick={() => irA({ vista: v.key })}>
                {v.label}
              </button>
            ))}
          </div>
        )}

        {loteId ? (
          <VistaLote key={loteId + version} loteId={loteId} permisos={permisos} onBack={() => irA({ vista: "semanales" })} onOpen={setDetalle} onGuia={setGuia} />
        ) : vista === "semanales" ? (
          <VistaSemanales key={version} onOpenLote={(id) => irA({ vista: "semanales", lote: id })} />
        ) : vista === "buscar" ? (
          <VistaBuscar key={version} onOpenLote={(id) => irA({ vista: "semanales", lote: id })} />
        ) : (
          <VistaSemana key={version} permisos={permisos} onOpen={setDetalle} onChanged={recargar} onCerrado={(id) => irA({ vista: "semanales", lote: id })} />
        )}
      </div>

      {detalle && (
        <PedidoDetalle
          key={detalle._id}
          pedido={detalle}
          permisos={permisos}
          onClose={() => setDetalle(null)}
          onChanged={(p) => { setDetalle(p); recargar(); }}
          onDeleted={() => { setDetalle(null); recargar(); }}
          onEdit={() => setForm({ pedido: detalle })}
          onGuia={() => setGuia(detalle)}
        />
      )}

      {guia && (
        <GuiaPedidoModal
          key={guia._id}
          pedido={guia}
          onClose={() => setGuia(null)}
          onDone={(p) => { recargar(); if (detalle?._id === p._id) setDetalle(p); }}
        />
      )}

      {form && (
        <PedidoForm
          inicial={form.pedido}
          vuelveARevision={Boolean(form.pedido && form.pedido.estado === "Por confirmar" && !permisos.puedeCerrar)}
          onClose={() => setForm(null)}
          onSaved={(p, esNuevo) => {
            recargar();
            if (esNuevo && loteId) irA({ vista: "semana" });
            setDetalle(p);
          }}
        />
      )}
    </div>
  );
}

/* ================= ESTA SEMANA (por revisar → por confirmar → confirmados) ================= */
const ETAPAS = [
  { key: "Nuevo", label: "Por revisar", ayuda: "Johanna los revisa y los manda a confirmar." },
  { key: "Por confirmar", label: "Por confirmar", ayuda: "Quien lo registró le manda la imagen al cliente y toca “Cliente confirmó”." },
  { key: "Confirmado", label: "Confirmados", ayuda: "Estos entran al pedido semanal. Solo Johanna los puede editar." },
];

function VistaSemana({ permisos, onOpen, onCerrado, onChanged }) {
  const [pedidos, setPedidos] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [etapa, setEtapa] = useState(null); // null = la que toca según el usuario
  const [ocupado, setOcupado] = useState("");
  const jefa = permisos.puedeCerrar;
  const esMio = useCallback((p) => Boolean(permisos.id && p.registradoPorId === permisos.id), [permisos.id]);

  useEffect(() => {
    api("?estado=Semana&limit=100")
      .then((d) => setPedidos(d.pedidos))
      .catch((e) => { toastHOT.error(e.message); setPedidos([]); });
  }, []);

  // Cada empleado ve en "Por confirmar" solo los suyos (él es quien habla con el cliente); Johanna ve todos
  const grupos = useMemo(() => {
    const g = { Nuevo: [], "Por confirmar": [], Confirmado: [] };
    for (const p of pedidos || []) {
      if (p.estado === "Por confirmar" && !jefa && !esMio(p)) continue;
      g[p.estado]?.push(p);
    }
    return g;
  }, [pedidos, jefa, esMio]);

  const misPorConfirmar = grupos["Por confirmar"].filter(esMio).length;
  const actual = etapa || (jefa ? (grupos.Nuevo.length ? "Nuevo" : grupos["Por confirmar"].length ? "Por confirmar" : "Confirmado") : misPorConfirmar ? "Por confirmar" : "Nuevo");
  const info = ETAPAS.find((e) => e.key === actual);

  const filtrados = useMemo(() => {
    const lista = grupos[actual] || [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) =>
      [p.numero, p.cliente?.nombre, p.cliente?.telefono, p.registradoPor, ...p.items.map((i) => `${i.equipo} ${i.nombre}`)].join(" ").toLowerCase().includes(q)
    );
  }, [grupos, actual, busqueda]);

  const confirmados = grupos.Confirmado;
  const camisetas = confirmados.reduce((a, p) => a + p.items.reduce((b, it) => b + (it.cantidad || 1), 0), 0);
  const quedanAfuera = (pedidos || []).filter((p) => p.estado !== "Confirmado").length;

  const cerrarSemana = async () => {
    setCerrando(true);
    try {
      const r = await api("/lotes/cerrar", { method: "POST", body: {} });
      toastHOT.success(`Pedido semanal #${r.lote.numero} cerrado con ${r.pedidos} pedidos`);
      onCerrado(r.lote._id);
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setCerrando(false);
    }
  };

  const mover = async (p, estado, ok) => {
    setOcupado(p._id);
    try {
      const r = await api(`/${p._id}/estado`, { method: "PUT", body: { estado } });
      setPedidos((arr) => arr.map((x) => (x._id === r._id ? { ...r, saldo: saldoDe(r) } : x)));
      toastHOT.success(ok);
    } catch (e) {
      toastHOT.error(e.message);
      onChanged?.();
    } finally {
      setOcupado("");
    }
  };

  const mandarImagen = async (p) => {
    setOcupado(p._id);
    try {
      const r = await compartirImagenPedido(p);
      if (r === "copiada") toastHOT.success("Imagen copiada: pegala en el chat del cliente (Ctrl+V)");
      else if (r === "descargada") toastHOT.success("Imagen descargada: mandásela al cliente");
    } catch (e) {
      toastHOT.error(e.message || "No se pudo generar la imagen");
    } finally {
      setOcupado("");
    }
  };

  const acciones = (p) => {
    if (p.estado === "Nuevo" && jefa)
      return (
        <button type="button" className="pd-act is-orange" disabled={ocupado === p._id} onClick={() => mover(p, "Por confirmar", `Pedido #${p.numero} enviado a confirmar con ${p.registradoPor || "el empleado"}`)}>
          <FaPaperPlane /> Mandar a confirmar
        </button>
      );
    if (p.estado === "Por confirmar" && (jefa || esMio(p)))
      return (
        <>
          <button type="button" className="pd-act is-wa" disabled={ocupado === p._id} onClick={() => mandarImagen(p)}>
            <FaImage /> Imagen para el cliente
          </button>
          <button type="button" className="pd-act is-teal" disabled={ocupado === p._id} onClick={() => mover(p, "Confirmado", `Pedido #${p.numero} confirmado: ya entra al pedido`)}>
            <FaUserCheck /> Cliente confirmó
          </button>
        </>
      );
    return null;
  };

  return (
    <>
      {/* Avisos de lo que le toca a cada quien */}
      {!jefa && misPorConfirmar > 0 && (
        <button type="button" className="pd-alert is-orange" onClick={() => setEtapa("Por confirmar")}>
          <FaUserCheck />
          <span>
            <b>Tenés {misPorConfirmar} {misPorConfirmar === 1 ? "pedido" : "pedidos"} por confirmar con el cliente.</b>
            Mandale la imagen y cuando te diga que sí, tocá “Cliente confirmó”.
          </span>
        </button>
      )}
      {jefa && grupos.Nuevo.length > 0 && actual !== "Nuevo" && (
        <button type="button" className="pd-alert is-blue" onClick={() => setEtapa("Nuevo")}>
          <FaClipboardList />
          <span><b>{grupos.Nuevo.length} {grupos.Nuevo.length === 1 ? "pedido" : "pedidos"} por revisar.</b> Revisalos y mandalos a confirmar.</span>
        </button>
      )}

      <div className="pd-card pd-week">
        <div>
          <span className="pd-week-label">Semana en curso</span>
          <strong>
            {pedidos
              ? `${confirmados.length} ${confirmados.length === 1 ? "confirmado" : "confirmados"} · ${camisetas} ${camisetas === 1 ? "camiseta" : "camisetas"}`
              : "Cargando…"}
          </strong>
          <small>
            Al cerrar solo entran los confirmados por el cliente.
            {quedanAfuera > 0 && ` ${quedanAfuera} ${quedanAfuera === 1 ? "queda" : "quedan"} para el próximo si se cierra hoy.`}
          </small>
        </div>
        {jefa && (
          <BotonConfirmar
            className="pd-btn is-purple"
            disabled={cerrando || !confirmados.length}
            onConfirm={cerrarSemana}
            confirmText={<><FaLock /> Tocá otra vez para cerrar</>}
          >
            {cerrando ? <span className="pd-spin" /> : <FaLock />} Cerrar pedido semanal
          </BotonConfirmar>
        )}
      </div>

      <div className="pd-card pd-filters">
        <div className="pd-tabs scrollbar-hide" role="tablist">
          {ETAPAS.map((e) => (
            <button
              key={e.key}
              type="button"
              role="tab"
              aria-selected={actual === e.key}
              className={`pd-tab ${actual === e.key ? "is-active" : ""}`}
              style={{ "--c": ESTADO_INFO[e.key].color }}
              onClick={() => setEtapa(e.key)}
            >
              {e.key === "Por confirmar" && !jefa ? "Mis por confirmar" : e.label} <b>{grupos[e.key].length}</b>
            </button>
          ))}
        </div>
        <p className="pd-note">{info.ayuda}</p>
        <label className="pd-search">
          <FaSearch />
          <input type="search" placeholder="Buscar en esta semana…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
      </div>

      {!pedidos ? (
        <div className="pd-card pd-empty"><span className="pd-spin is-dark" /> Cargando pedidos…</div>
      ) : !filtrados.length ? (
        <div className="pd-card pd-empty">
          <FaClipboardList size={26} />
          <p>{busqueda ? "No hay pedidos con esa búsqueda." : `No hay pedidos en “${actual === "Por confirmar" && !jefa ? "Mis por confirmar" : info.label}”.`}</p>
        </div>
      ) : (
        <div className="pd-list">{filtrados.map((p) => <PedidoRow key={p._id} p={p} onOpen={onOpen} acciones={acciones(p)} />)}</div>
      )}
    </>
  );
}

/* ================= PEDIDOS SEMANALES (lotes) ================= */
function VistaSemanales({ onOpenLote, desde = "", hasta = "" }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/lotes").then(setData).catch((e) => { toastHOT.error(e.message); setData({ lotes: [] }); });
  }, []);

  if (!data) return <div className="pd-card pd-empty"><span className="pd-spin is-dark" /> Cargando…</div>;
  const filtrando = Boolean(desde || hasta);
  // Fecha del pedido semanal = el día en que se cerró
  const lotes = data.lotes.filter((l) => (!desde || l.fechaYMD >= desde) && (!hasta || l.fechaYMD <= hasta));
  if (!lotes.length)
    return (
      <div className="pd-card pd-empty">
        <FaBoxOpen size={26} />
        <p>{filtrando ? "No hay pedidos semanales cerrados en esas fechas." : "Todavía no se ha cerrado ningún pedido semanal."}</p>
      </div>
    );

  return (
    <div className="pd-list">
      {lotes.map((l) => {
        const listos = l.completados;
        const pct = l.clientes ? Math.round((listos / l.clientes) * 100) : 0;
        return (
          <button key={l._id} type="button" className="pd-lote" onClick={() => onOpenLote(l._id)}>
            <div className="pd-lote-num">
              <small>Pedido</small>
              <b>#{l.numero}</b>
            </div>
            <div className="pd-lote-main">
              <div className="pd-row-top">
                <span className="pd-badge" style={{ "--c": l.estado === "Llegó" ? "#d97706" : "#9333ea" }}>
                  <i aria-hidden="true" />
                  {l.estado === "Llegó" ? "Ya llegó" : "Pedido al proveedor"}
                </span>
              </div>
              <span className="pd-row-meta">Cerrado el {l.fecha} por {l.cerradoPor}</span>
              <span className="pd-row-items">
                {l.clientes} clientes · {l.camisetas} camisetas
                {l.estado === "Llegó" && ` · ${l.avisados} avisados · ${l.completados} completados`}
              </span>
              {l.estado === "Llegó" && (
                <span className="pd-progress" aria-label={`${pct}% completado`}>
                  <i style={{ width: `${pct}%` }} />
                </span>
              )}
            </div>
            <FaChevronRight className="pd-lote-arrow" />
          </button>
        );
      })}
    </div>
  );
}

/* ================= UN PEDIDO SEMANAL ================= */
function VistaLote({ loteId, permisos, onBack, onOpen, onGuia }) {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [exportando, setExportando] = useState(false);
  const [ocupado, setOcupado] = useState("");

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const cargar = useCallback(() => {
    api(`/lotes/${loteId}`).then(setData).catch((e) => { toastHOT.error(e.message); onBackRef.current(); });
  }, [loteId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!data) return <div className="pd-card pd-empty"><span className="pd-spin is-dark" /> Cargando…</div>;
  const { lote, pedidos } = data;
  const llego = lote.estado === "Llegó";
  const reemplazar = (p) => setData((d) => ({ ...d, pedidos: d.pedidos.map((x) => (x._id === p._id ? { ...p, saldo: saldoDe(p) } : x)) }));

  const cuenta = (e) => pedidos.filter((p) => p.estado === e).length;
  const filtros = [
    { key: "todos", label: "Todos", n: pedidos.length },
    { key: "Llegó", label: "Por avisar", n: cuenta("Llegó") },
    { key: "Avisado", label: "Avisados", n: cuenta("Avisado") },
    { key: "Completado", label: "Completados", n: cuenta("Completado") },
  ];
  const visibles = filtro === "todos" ? pedidos : pedidos.filter((p) => p.estado === filtro);

  const exportar = async () => {
    setExportando(true);
    try {
      await descargarExcel(`lote=${lote._id}`, `pedido-semanal-${lote.numero}.xlsx`);
      toastHOT.success("Excel descargado");
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setExportando(false);
    }
  };

  const marcarLlego = async () => {
    try {
      await api(`/lotes/${lote._id}/llego`, { method: "PUT", body: {} });
      toastHOT.success(`Pedido #${lote.numero}: ya llegó`);
      cargar();
    } catch (e) {
      toastHOT.error(e.message);
    }
  };

  const accion = async (p, fn) => {
    setOcupado(p._id);
    try {
      reemplazar(await fn());
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setOcupado("");
    }
  };

  return (
    <>
      <button type="button" className="pd-link pd-back-link" onClick={onBack}>
        <FaChevronLeft size={10} /> Pedidos semanales
      </button>

      <div className="pd-card pd-week">
        <div>
          <span className="pd-week-label">Pedido semanal #{lote.numero}</span>
          <strong>{llego ? "Ya llegó" : "Pedido al proveedor"}</strong>
          <small>
            Cerrado el {lote.fecha} por {lote.cerradoPor}
            {llego && lote.llegoAt ? ` · llegó el ${new Date(lote.llegoAt).toLocaleDateString("es-CR")}` : ""}
          </small>
        </div>
        <div className="pd-hero-actions">
          <button type="button" className="pd-btn is-ghost" onClick={exportar} disabled={exportando}>
            {exportando ? <span className="pd-spin is-dark" /> : <FaFileExcel />} Exportar a Excel
          </button>
          {!llego && permisos.puedeCerrar && (
            <BotonConfirmar className="pd-btn is-amber" onConfirm={marcarLlego} confirmText={<><FaBoxOpen /> Tocá otra vez</>}>
              <FaBoxOpen /> Ya llegó
            </BotonConfirmar>
          )}
        </div>
      </div>

      {llego && (
        <div className="pd-card pd-filters">
          <div className="pd-tabs scrollbar-hide" role="tablist">
            {filtros.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filtro === f.key} className={`pd-tab ${filtro === f.key ? "is-active" : ""}`} style={{ "--c": "#000" }} onClick={() => setFiltro(f.key)}>
                {f.label} <b>{f.n}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {!visibles.length ? (
        <div className="pd-card pd-empty"><p>No hay pedidos en este filtro.</p></div>
      ) : (
        <div className="pd-list">
          {visibles.map((p) => (
            <PedidoRow
              key={p._id}
              p={p}
              onOpen={onOpen}
              acciones={
                llego ? (
                  <>
                    <button type="button" className={`pd-act is-wa ${p.estado === "Llegó" ? "is-hot" : ""}`} disabled={ocupado === p._id} onClick={() => accion(p, () => avisarCliente(p))}>
                      <FaWhatsapp /> {p.estado === "Llegó" ? "Avisar por WhatsApp" : "Volver a avisar"}
                    </button>
                    <button type="button" className={`pd-act ${p.guia?.numero ? "is-ok" : ""}`} disabled={ocupado === p._id} onClick={() => onGuia(p)} title={p.guia?.numero ? `Guía ${p.guia.tipo}: ${p.guia.numero}` : "Hacer guía de envío"}>
                      <FaTruck /> {p.guia?.numero ? "Guía ✓" : "Guía"}
                    </button>
                    {p.estado === "Completado" ? (
                      <button type="button" className="pd-act" disabled={ocupado === p._id} onClick={() => accion(p, () => api(`/${p._id}/estado`, { method: "PUT", body: { estado: "Avisado" } }))}>
                        <FaUndo /> Deshacer
                      </button>
                    ) : (
                      <button type="button" className="pd-act is-done" disabled={ocupado === p._id} onClick={() => accion(p, () => api(`/${p._id}/estado`, { method: "PUT", body: { estado: "Completado" } }))}>
                        <FaCheck /> Entregado
                      </button>
                    )}
                  </>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ================= BUSCAR: pedidos semanales por fecha (adentro de cada uno se filtra por estado) ================= */
function VistaBuscar({ onOpenLote }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  return (
    <>
      <div className="pd-card pd-filters">
        <div className="pd-filter-row">
          <label className="pd-date">
            <span>Desde</span>
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="pd-date">
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </label>
          {(desde || hasta) && (
            <button type="button" className="pd-btn is-ghost" onClick={() => { setDesde(""); setHasta(""); }}>
              <FaTimes /> Limpiar
            </button>
          )}
        </div>
      </div>
      <VistaSemanales onOpenLote={onOpenLote} desde={desde} hasta={hasta} />
    </>
  );
}

/* ================= DETALLE ================= */
function PedidoDetalle({ pedido: p, permisos, onClose, onChanged, onDeleted, onEdit, onGuia }) {
  const [ocupado, setOcupado] = useState(false);
  const saldo = saldoDe(p);
  const jefa = permisos.puedeCerrar;
  const esMio = Boolean(permisos.id && p.registradoPorId === permisos.id);
  // ✏️ Por revisar / por confirmar: quien lo registró o Johanna · Confirmado: solo Johanna · después: nadie
  const editable = ((p.estado === "Nuevo" || p.estado === "Por confirmar") && (jefa || esMio)) || (p.estado === "Confirmado" && jefa);
  const llego = yaLlego(p.estado);
  const mover = (estado, ok) => run(() => api(`/${p._id}/estado`, { method: "PUT", body: { estado } }), ok);

  const run = async (fn, ok) => {
    setOcupado(true);
    try {
      onChanged(await fn());
      if (ok) toastHOT.success(ok);
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setOcupado(false);
    }
  };

  // 🧾 Imagen "como en el Excel" para que el cliente verifique su pedido
  const [generando, setGenerando] = useState(false);
  const imagenCliente = async () => {
    setGenerando(true);
    try {
      const r = await compartirImagenPedido(p);
      if (r === "copiada") toastHOT.success("Imagen copiada: pegala en el chat del cliente (Ctrl+V)");
      else if (r === "descargada") toastHOT.success("Imagen descargada: mandásela al cliente");
    } catch (e) {
      toastHOT.error(e.message || "No se pudo generar la imagen");
    } finally {
      setGenerando(false);
    }
  };

  const borrar = async () => {
    try {
      await api(`/${p._id}`, { method: "DELETE" });
      toastHOT.success(`Pedido #${p.numero} eliminado`);
      onDeleted();
    } catch (e) {
      toastHOT.error(e.message);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      size="lg"
      icon={FaClipboardList}
      eyebrow={`Pedido #${p.numero}${p.loteNumero ? ` · Semana #${p.loteNumero}` : ""}`}
      title={p.cliente?.nombre}
      subtitle={`${p.fecha} · registró ${p.registradoPor || "—"}`}
      footer={(close) => (
        <>
          {/* La imagen para el cliente sale hasta que Johanna lo manda a confirmar */}
          {p.estado !== "Nuevo" && (
          <button type="button" className="md-btn is-success" onClick={imagenCliente} disabled={generando}>
            {generando ? <span className="md-spinner" /> : <FaImage />} Imagen para el cliente
          </button>
          )}
          {editable && (
            <button type="button" className="md-btn is-primary" onClick={() => { close(); onEdit(); }}>
              <FaPen /> Editar
            </button>
          )}
          {p.estado === "Nuevo" && jefa && (
            <button type="button" className="md-btn is-success" disabled={ocupado} onClick={() => mover("Por confirmar", `Enviado a confirmar con ${p.registradoPor || "el empleado"}`)}>
              <FaPaperPlane /> Mandar a confirmar
            </button>
          )}
          {p.estado === "Por confirmar" && (jefa || esMio) && (
            <button type="button" className="md-btn is-success" disabled={ocupado} onClick={() => mover("Confirmado", "Confirmado: ya entra al pedido")}>
              <FaUserCheck /> Cliente confirmó
            </button>
          )}
          {llego && (
            <button type="button" className={`md-btn ${p.estado === "Llegó" ? "is-success" : "is-ghost"}`} disabled={ocupado} onClick={() => run(() => avisarCliente(p))}>
              <FaWhatsapp /> {p.estado === "Llegó" ? "Avisar" : "Volver a avisar"}
            </button>
          )}
          {llego && (
            <button type="button" className="md-btn is-ghost" disabled={ocupado} onClick={() => { close(); onGuia(); }}>
              <FaTruck /> {p.guia?.numero ? "Otra guía" : "Hacer guía"}
            </button>
          )}
          {llego && p.estado !== "Completado" && (
            <button type="button" className="md-btn is-primary" disabled={ocupado} onClick={() => run(() => api(`/${p._id}/estado`, { method: "PUT", body: { estado: "Completado" } }), "Pedido completado")}>
              <FaCheck /> Entregado
            </button>
          )}
        </>
      )}
    >
      <div className="md-section">
        <span className="md-section-title">Estado</span>
        <div className="pd-row-top">
          <EstadoBadge estado={p.estado} />
          {!editable && (
            <span className="pd-mini">
              <FaLock /> {p.estado === "Confirmado" ? "Solo Johanna lo edita" : ["Nuevo", "Por confirmar"].includes(p.estado) ? `Lo edita ${p.registradoPor || "quien lo registró"} o Johanna` : "Ya no se puede editar"}
            </span>
          )}
        </div>
        <p className="pd-note">
          {p.estado === "Nuevo" && "Por revisar: Johanna lo revisa y lo manda a confirmar. Todavía no entra al pedido."}
          {p.estado === "Por confirmar" && `${p.registradoPor || "Quien lo registró"} le manda la imagen al cliente; cuando confirme, toca “Cliente confirmó”.${!jefa ? " Si lo editás, vuelve a revisión." : ""}`}
          {p.estado === "Confirmado" && "Confirmado por el cliente: entra al pedido semanal cuando se cierre."}
          {p.estado === "Pedido" && `Va en el pedido semanal #${p.loteNumero}. Cuando llegue se podrá avisar al cliente.`}
          {p.estado === "Llegó" && "Ya llegó: tocá “Avisar” para escribirle al cliente por WhatsApp."}
          {p.estado === "Avisado" && p.avisado?.fecha && `Avisado el ${new Date(p.avisado.fecha).toLocaleString("es-CR")} por ${p.avisado.por}. Cuando lo reciba, tocá “Entregado”.`}
          {p.estado === "Completado" && "Entregado al cliente ✅"}
        </p>
        {p.estado === "Completado" && (
          <button type="button" className="pd-link" disabled={ocupado} onClick={() => run(() => api(`/${p._id}/estado`, { method: "PUT", body: { estado: "Avisado" } }))}>
            Deshacer “Entregado”
          </button>
        )}
        {jefa && (p.estado === "Por confirmar" || p.estado === "Confirmado") && (
          <button type="button" className="pd-link" disabled={ocupado} onClick={() => mover("Nuevo", "Devuelto a revisión")}>
            Devolver a “Por revisar”
          </button>
        )}
      </div>

      <div className="pd-info">
        <div><FaUser /> <span>{p.cliente?.nombre}{p.cliente?.telefono ? ` · ${p.cliente.telefono}` : ""}</span></div>
        <div>
          <FaTruck />{" "}
          <span>
            {p.guia?.numero
              ? `Guía ${p.guia.tipo}: ${p.guia.numero} · ${new Date(p.guia.fecha).toLocaleDateString("es-CR")} · ${p.guia.por}`
              : llego ? "Sin guía todavía" : "La dirección y la guía se hacen cuando llegue"}
          </span>
        </div>
      </div>

      <div className="pd-items">
        {p.items.map((it, i) => (
          <div key={it._id || i} className="pd-item">
            <div className="pd-item-fotos">
              {it.fotos?.length ? (
                it.fotos.map((f, j) => (
                  <a key={j} href={fotoGrande(f)} target="_blank" rel="noopener noreferrer" title={j === 0 ? "Frente" : "Espalda"}>
                    <img src={thumb(f)} alt={j === 0 ? "Frente" : "Espalda"} loading="lazy" />
                    <span>{j === 0 ? "Frente" : "Espalda"}</span>
                  </a>
                ))
              ) : (
                <span className="pd-noimg is-big"><FaImage /><small>Sin foto</small></span>
              )}
            </div>
            <div className="pd-item-info">
              <strong>{it.equipo}</strong>
              <div className="pd-tags">
                {it.version && <span>{it.version}</span>}
                <span className="is-dark">Talla {it.talla}</span>
                {esMangaLarga(it) && <span className="is-yellow">Manga larga</span>}
                {(it.nombre || it.dorsal) && <span>{[it.nombre, it.dorsal && `#${it.dorsal}`].filter(Boolean).join(" ")}</span>}
                {!sinParche(it.parche) && <span>Parche: {it.parche}</span>}
                {it.cantidad > 1 && <span>x{it.cantidad}</span>}
                {it.raspa > 0 && <span className="is-red">🎟️ {raspaLabel(it.raspa)}</span>}
              </div>
              {it.fotoParche && (
                <a className="pd-parche-foto" href={fotoGrande(it.fotoParche)} target="_blank" rel="noopener noreferrer" title="Parche">
                  <img src={cld(it.fotoParche, "f_auto,q_auto:eco,c_pad,b_white,w_320,h_150")} alt="Parche" loading="lazy" />
                  <span>Parche</span>
                </a>
              )}
              <span className="pd-item-price">
                {it.raspa > 0 && <s className="pd-item-antes">{colones(it.precio * (it.cantidad || 1))}</s>}
                {colones(precioItemDe(it))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pd-totals">
        <div><span>Total</span><b>{colones(p.total)}</b></div>
        <div><span>{p.abonos?.length ? "Pagado" : `Adelanto${p.metodoPago ? ` (${p.metodoPago})` : ""}`}</span><b className="is-green">{colones(pagadoDe(p))}</b></div>
        <div><span>Pendiente</span><b className={saldo > 0 ? "is-red" : "is-green"}>{colones(saldo)}</b></div>
      </div>

      <Abonos p={p} permisos={permisos} onChanged={onChanged} />

      {p.notas && <p className="pd-notas">📝 {p.notas}</p>}

      {p.historialEstados?.length > 0 && (
        <details className="pd-hist">
          <summary>Historial</summary>
          <ul>
            {p.historialEstados.map((h, i) => (
              <li key={i}>
                <EstadoBadge estado={h.estado} /> {new Date(h.fecha).toLocaleString("es-CR")} · {h.por}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 🗑️ Súper admin: cualquiera · colaborador: solo el suyo y mientras está "Por revisar" */}
      {(permisos.isSuperUser || (esMio && p.estado === "Nuevo" && !p.lote)) && (
        <BotonConfirmar className="pd-delete" onConfirm={borrar} confirmText={<><FaTrash /> Tocá otra vez para eliminar el pedido #{p.numero} definitivamente</>}>
          <FaTrash /> {permisos.isSuperUser ? "Eliminar pedido" : "Eliminar pedido (lo metí mal / no se va a pedir)"}
        </BotonConfirmar>
      )}
    </ModalShell>
  );
}

/* ---------- 💵 Pagos: adelanto + abonos (el pendiente siempre descuenta todo) ---------- */
function Abonos({ p, permisos, onChanged }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("SINPE");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const saldo = saldoDe(p);
  const abonos = p.abonos || [];

  const guardar = async () => {
    const n = Math.trunc(Number(monto) || 0);
    if (n <= 0) return toastHOT.error("Poné el monto del abono");
    if (n > saldo) return toastHOT.error(`El abono es mayor a lo que debe (${colones(saldo)})`);
    setGuardando(true);
    try {
      const r = await api(`/${p._id}/abonos`, { method: "POST", body: { monto: n, metodo, nota } });
      toastHOT.success(`Abono de ${colones(n)} registrado · pendiente ${colones(saldoDe(r))}`);
      setMonto(""); setNota(""); setAbierto(false);
      onChanged(r);
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (a) => {
    try {
      onChanged(await api(`/${p._id}/abonos/${a._id}`, { method: "DELETE" }));
      toastHOT.success("Abono quitado");
    } catch (e) {
      toastHOT.error(e.message);
    }
  };

  return (
    <div className="md-section pd-pagos">
      <div className="pd-item-head">
        <span className="md-section-title">Pagos</span>
        {saldo > 0 && !abierto && (
          <button type="button" className="pd-link" onClick={() => setAbierto(true)}>
            <FaPlus size={10} /> Registrar abono
          </button>
        )}
      </div>

      <ul className="pd-abonos">
        <li>
          <span>Adelanto{p.metodoPago ? ` · ${p.metodoPago}` : ""}<small>{p.fecha}</small></span>
          <b>{colones(p.adelanto)}</b>
        </li>
        {abonos.map((a) => (
          <li key={a._id}>
            <span>
              Abono{a.metodo ? ` · ${a.metodo}` : ""}
              <small>{new Date(a.fecha).toLocaleDateString("es-CR")} · {a.por}{a.nota ? ` · ${a.nota}` : ""}</small>
            </span>
            <b>{colones(a.monto)}</b>
            {(permisos.puedeCerrar || (permisos.id && a.porId === permisos.id)) && (
              <BotonConfirmar className="pd-icon-btn" onConfirm={() => quitar(a)} confirmText={<FaCheck />}>
                <FaTimes />
              </BotonConfirmar>
            )}
          </li>
        ))}
        {abonos.length > 0 && (
          <li className="is-total"><span>Abonado después del adelanto</span><b>{colones(abonadoDe(p))}</b></li>
        )}
      </ul>

      {abierto && (
        <div className="pd-abono-form">
          <div className="md-row pd-stack-sm">
            <label className="md-field">
              <span className="md-label">Monto (debe {colones(saldo)})</span>
              <div className="md-affix">
                <span className="md-affix-sign">₡</span>
                <input className="md-input is-money is-green" type="number" inputMode="numeric" min="1" max={saldo} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="10000" autoFocus />
              </div>
            </label>
            <label className="md-field">
              <span className="md-label">Método</span>
              <select className="md-input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS_ABONO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <label className="md-field">
            <span className="md-label">Nota (opcional)</span>
            <input className="md-input is-sm" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej. comprobante SINPE 1234" />
          </label>
          <div className="pd-abono-btns">
            <button type="button" className="md-btn is-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="button" className="md-btn is-success" disabled={guardando} onClick={guardar}>
              {guardando ? <span className="md-spinner" /> : <FaMoneyBillWave />} Guardar abono
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= FORMULARIO (crear / editar) ================= */
let keySeq = 0;
const itemVacio = () => ({ _k: ++keySeq, producto: null, prodInfo: null, equipo: "", version: "", talla: "", nombre: "", dorsal: "", parche: "", fotoParche: "", manga: "Corta", cantidad: 1, precio: "", raspa: 0, costoProveedor: "", fotos: [] });

function PedidoForm({ inicial, vuelveARevision, onClose, onSaved }) {
  const editando = Boolean(inicial?._id);
  const [cliente, setCliente] = useState(() => ({
    nombre: inicial?.cliente?.nombre || "",
    telefono: inicial?.cliente?.telefono || "",
  }));
  const [items, setItems] = useState(() =>
    inicial?.items?.length
      ? inicial.items.map((it) => ({
          ...itemVacio(),
          ...it,
          producto: it.producto || null,
          fotos: it.fotos || [],
          fotoParche: it.fotoParche || "",
          manga: it.manga || "Corta",
          raspa: Number(it.raspa) || 0,
          costoProveedor: it.costoProveedor || "",
        }))
      : [itemVacio()]
  );
  const [adelanto, setAdelanto] = useState(inicial ? String(inicial.adelanto || "") : "");
  const [notas, setNotas] = useState(inicial?.notas || "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const frenar = (e) => { if (traeArchivos(e)) e.preventDefault(); };
    window.addEventListener("dragover", frenar);
    window.addEventListener("drop", frenar);
    return () => {
      window.removeEventListener("dragover", frenar);
      window.removeEventListener("drop", frenar);
    };
  }, []);

  const setItem = (k, cambios) => setItems((arr) => arr.map((it) => (it._k === k ? { ...it, ...cambios } : it)));
  const total = items.reduce((a, it) => a + precioItemDe(it), 0); // ya con la raspa
  const saldo = Math.max(0, total - (Number(adelanto) || 0) - abonadoDe(inicial)); // los abonos se registran en el detalle

  const guardar = async (close) => {
    if (!cliente.nombre.trim()) return toastHOT.error("Falta el nombre del cliente");
    const faltante = items.findIndex((it) => !(it.equipo || "").trim() || !(it.talla || "").trim());
    if (faltante >= 0) return toastHOT.error(`Camiseta ${faltante + 1}: falta el producto o la talla`);
    const sinFoto = items.findIndex((it) => !(it.fotos || []).length);
    if (sinFoto >= 0) return toastHOT.error(`Camiseta ${sinFoto + 1}: falta la foto`);
    setGuardando(true);
    try {
      const body = {
        cliente,
        adelanto,
        metodoPago: inicial?.metodoPago || "", // ya no se pide; se conserva el de pedidos viejos
        notas,
        // fotos: las nuevas van como data:image (el backend las sube a Cloudinary), las de antes como URL
        // eslint-disable-next-line no-unused-vars
        items: items.map(({ _k, prodInfo, ...it }) => it),
      };
      const p = editando
        ? await api(`/${inicial._id}`, { method: "PUT", body })
        : await api("", { method: "POST", body });
      toastHOT.success(editando ? `Pedido #${p.numero} actualizado` : `Pedido #${p.numero} registrado`);
      onSaved(p, !editando);
      close();
    } catch (e) {
      toastHOT.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      size="lg"
      icon={FaClipboardList}
      eyebrow={editando ? `Editar pedido #${inicial.numero}` : "Nuevo pedido"}
      title={editando ? "Editar pedido" : "Registrar pedido"}
      subtitle="Cliente, camisetas y adelanto."
      closeOnBackdrop={false}
      footer={(close) => (
        <>
          <button type="button" className="md-btn is-ghost" onClick={close}>Cancelar</button>
          <button type="button" className="md-btn is-primary" disabled={guardando} onClick={() => guardar(close)}>
            {guardando ? <span className="md-spinner" /> : <FaCheck />} {editando ? "Guardar cambios" : "Registrar pedido"}
          </button>
        </>
      )}
    >
      {vuelveARevision && (
        <p className="pd-alert is-orange is-static">
          <FaUndo />
          <span><b>Este pedido ya estaba por confirmar.</b> Si guardás cambios, vuelve a “Por revisar” para que Johanna lo revise otra vez.</span>
        </p>
      )}

      {/* CLIENTE */}
      <div className="md-section">
        <span className="md-section-title">Cliente</span>
        <div className="md-row pd-stack-sm">
          <label className="md-field">
            <span className="md-label">Nombre *</span>
            <input className="md-input" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} placeholder="Nombre del cliente" />
          </label>
          <label className="md-field">
            <span className="md-label">Teléfono</span>
            <input className="md-input" type="tel" inputMode="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} placeholder="8888-8888" />
          </label>
        </div>
      </div>

      {/* CAMISETAS */}
      {items.map((it, i) => (
        <ItemEditor
          key={it._k}
          index={i}
          item={it}
          puedeQuitar={items.length > 1}
          onChange={(c) => setItem(it._k, c)}
          onRemove={() => setItems((arr) => arr.filter((x) => x._k !== it._k))}
        />
      ))}
      <button type="button" className="pd-add" onClick={() => setItems((arr) => [...arr, itemVacio()])}>
        <FaPlus /> Agregar otra camiseta
      </button>

      {/* PAGO */}
      <div className="md-section">
        <span className="md-section-title">Pago</span>
        <div className="md-row pd-stack-sm">
          <label className="md-field">
            <span className="md-label">Adelanto</span>
            <div className="md-affix">
              <span className="md-affix-sign">₡</span>
              <input className="md-input is-money is-green" type="number" inputMode="numeric" min="0" value={adelanto} onChange={(e) => setAdelanto(e.target.value)} placeholder="5000" />
            </div>
          </label>
        </div>
        <label className="md-field">
          <span className="md-label">Notas</span>
          <textarea className="md-input pd-textarea" rows={2} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. SIGUE LA PROMO, cambio por talla…" />
        </label>
        <div className="pd-totals is-compact">
          <div><span>Total</span><b>{colones(total)}</b></div>
          <div><span>Pendiente</span><b className={saldo > 0 ? "is-red" : "is-green"}>{colones(saldo)}</b></div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Una camiseta del pedido ---------- */
function ItemEditor({ index, item: it, puedeQuitar, onChange, onRemove }) {
  const tipo = it.version;
  const tallas = useMemo(() => {
    const base = tallaPorTipo[tipo] || tallaPorTipo.Fan;
    const extra =
      tipo === "Niño" ? base.map((t) => `${t} KID (WITH SOCKS)`) : tipo === "Mujer" ? base.map((t) => `${t} WOMEN`) : [];
    return [...base, ...extra];
  }, [tipo]);
  const listId = `pd-tallas-${it._k}`;

  return (
    <div className="md-section pd-item-edit">
      <div className="pd-item-head">
        <span className="md-section-title">Camiseta {index + 1}</span>
        {puedeQuitar && (
          <button type="button" className="pd-icon-btn" onClick={onRemove} aria-label="Quitar camiseta">
            <FaTrash />
          </button>
        )}
      </div>

      <FotosCamiseta fotos={it.fotos || []} onChange={(fotos) => onChange({ fotos })} />

      <label className="md-field">
        <span className="md-label">Camiseta *</span>
        <input className="md-input is-sm" autoComplete="off" value={it.equipo} onChange={(e) => onChange({ equipo: e.target.value })} placeholder="Ej. Argentina Local 2026" maxLength={120} />
      </label>

      <div className="md-row">
        <label className="md-field">
          <span className="md-label">Versión</span>
          <input className="md-input is-sm" list="pd-versiones" value={it.version} onChange={(e) => onChange({ version: e.target.value })} placeholder="Fan" />
        </label>
        <label className="md-field">
          <span className="md-label">Talla *</span>
          <input className="md-input is-sm" list={listId} value={it.talla} onChange={(e) => onChange({ talla: e.target.value })} placeholder="L" />
          <datalist id={listId}>{tallas.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
      </div>
      {/* Manga: larga sale como "M LONG SLEEVE" (en amarillo) en la hoja y en la imagen */}
      <div className="md-field">
        <span className="md-label">Manga</span>
        <div className="md-seg pd-seg" role="radiogroup">
          {["Corta", "Larga"].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={(it.manga || "Corta") === m}
              className={`md-seg-btn ${(it.manga || "Corta") === m ? "is-active" : ""}`}
              style={{ "--seg": m === "Larga" ? "#ca8a04" : "#000" }}
              onClick={() => onChange({ manga: m })}
            >
              Manga {m.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="md-row">
        <label className="md-field">
          <span className="md-label">Nombre</span>
          <input className="md-input is-sm" value={it.nombre} onChange={(e) => onChange({ nombre: e.target.value.toUpperCase() })} placeholder="MESSI" maxLength={40} />
        </label>
        <label className="md-field pd-f-num">
          <span className="md-label">Dorsal</span>
          <input className="md-input is-sm" inputMode="numeric" value={it.dorsal} onChange={(e) => onChange({ dorsal: e.target.value })} placeholder="10" maxLength={10} />
        </label>
      </div>
      <div className="md-field">
        <span className="md-label">Parches <small className="pd-fotos-hint">(texto, foto o los dos)</small></span>
        {/* Como Johanna: a veces escribe el parche y a veces pone la foto. Sin nada = N/A en el Excel */}
        <div className="pd-parche-edit">
          <FotoParche foto={it.fotoParche || ""} onChange={(fotoParche) => onChange({ fotoParche })} />
          <input className="md-input is-sm" autoComplete="off" value={it.parche} onChange={(e) => onChange({ parche: e.target.value })} placeholder="Ej. Champions League patch (vacío = sin parche)" maxLength={120} />
        </div>
      </div>
      <div className="md-row">
        <label className="md-field pd-f-num">
          <span className="md-label">Cantidad</span>
          <input className="md-input is-sm" type="number" min="1" max="99" inputMode="numeric" value={it.cantidad} onChange={(e) => onChange({ cantidad: e.target.value })} />
        </label>
        <label className="md-field">
          <span className="md-label">Precio c/u</span>
          <div className="md-affix">
            <span className="md-affix-sign">₡</span>
            <input className="md-input is-sm is-money" type="number" min="0" inputMode="numeric" value={it.precio} onChange={(e) => onChange({ precio: e.target.value })} placeholder="0" />
          </div>
        </label>
      </div>
      {/* 🎟️ Raspa: descuento que da el jefe; al cobrar el cliente se la entrega al mensajero */}
      <div className="md-field">
        <span className="md-label">
          ¿Tiene raspa? <small className="pd-fotos-hint">(por camisa{Number(it.cantidad) > 1 ? `: ${it.cantidad} raspas` : ""})</small>
          {Number(it.raspa) > 0 && Number(it.precio) > 0 && (
            <small className="pd-fotos-hint"> → queda en {colones(precioItemDe(it))}</small>
          )}
        </span>
        <div className="md-seg pd-seg pd-seg-raspa" role="radiogroup">
          {RASPAS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={(Number(it.raspa) || 0) === r}
              className={`md-seg-btn ${(Number(it.raspa) || 0) === r ? "is-active" : ""}`}
              style={{ "--seg": r === 0 ? "#000" : r >= 100 ? "#16a34a" : "#dc2626" }}
              onClick={() => onChange({ raspa: r })}
            >
              {r === 0 ? "No" : r >= 100 ? "Regalada" : `${r}%`}
            </button>
          ))}
        </div>
      </div>

      {index === 0 && (
        <datalist id="pd-versiones">{VERSIONES.map((v) => <option key={v} value={v} />)}</datalist>
      )}
    </div>
  );
}

/* ---------- 📸 Fotos de la camiseta (obligatoria al menos 1; máx. 2: frente / espalda) ---------- */
// Se achica en el navegador (WebP 1000px) antes de mandarla, igual que en Agregar producto.
async function comprimirFoto(file, maxW = 1000, calidad = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("Esa imagen no se puede leer"));
      i.src = url;
    });
    const r = img.width > maxW ? maxW / img.width : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const webp = c.toDataURL("image/webp", calidad);
    return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 🖱️ Arrastrar y soltar fotos sobre una zona (además del clic normal). Devuelve { encima, props } */
const traeArchivos = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
function useSoltarFotos(onFiles) {
  const [encima, setEncima] = useState(false);
  const capas = useRef(0); // dragenter/leave se disparan también al pasar por los hijos
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  return {
    encima,
    props: {
      onDragEnter: (e) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        capas.current += 1;
        setEncima(true);
      },
      onDragOver: (e) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (e) => {
        if (!traeArchivos(e)) return;
        capas.current = Math.max(0, capas.current - 1);
        if (!capas.current) setEncima(false);
      },
      onDrop: (e) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        e.stopPropagation();
        capas.current = 0;
        setEncima(false);
        const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length) return toastHOT.error("Soltá una imagen (JPG, PNG, WebP…)");
        onFilesRef.current(files);
      },
    },
  };
}

function FotosCamiseta({ fotos, onChange }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const ver = (f) => (f.startsWith("data:") ? f : thumb(f));

  const agregar = async (lista) => {
    if (cargando) return;
    if (fotos.length >= 2) return toastHOT.error("Ya tiene 2 fotos (frente y espalda). Quitá una para cambiarla.");
    const files = lista.slice(0, 2 - fotos.length);
    if (!files.length) return;
    setCargando(true);
    try {
      const nuevas = [];
      for (const f of files) nuevas.push(await comprimirFoto(f));
      onChange([...fotos, ...nuevas].slice(0, 2));
    } catch (err) {
      toastHOT.error(err.message || "No se pudo cargar la foto");
    } finally {
      setCargando(false);
    }
  };

  const soltar = useSoltarFotos(agregar);

  return (
    <div className="md-field">
      <span className="md-label">Foto * <small className="pd-fotos-hint">(frente y espalda, máx. 2 · tocá o arrastrá aquí)</small></span>
      <div className={`pd-fotos pd-drop${soltar.encima ? " is-over" : ""}`} {...soltar.props}>
        {fotos.map((f, i) => (
          <div key={i} className="pd-foto">
            <img src={ver(f)} alt={i === 0 ? "Frente" : "Espalda"} />
            <button type="button" className="pd-foto-x" onClick={() => onChange(fotos.filter((_, j) => j !== i))} aria-label="Quitar foto">
              <FaTimes />
            </button>
          </div>
        ))}
        {fotos.length < 2 && (
          <button type="button" className={`pd-foto-add${fotos.length ? "" : " is-req"}`} onClick={() => inputRef.current?.click()} disabled={cargando}>
            {cargando ? <span className="pd-spin is-dark" /> : <FaImage />}
            <small>{fotos.length ? "Otra foto" : "Agregar foto"}</small>
          </button>
        )}
        {soltar.encima && <span className="pd-drop-hint">Soltá la foto aquí</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ""; agregar(files); }}
      />
    </div>
  );
}

/* ---------- 📸 Foto del parche (opcional, 1). Puede traer varios parches juntos en la misma foto ---------- */
function FotoParche({ foto, onChange }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const agregar = async (files) => {
    const file = files?.[0];
    if (!file || cargando) return;
    setCargando(true);
    try {
      onChange(await comprimirFoto(file, 800));
    } catch (err) {
      toastHOT.error(err.message || "No se pudo cargar la foto");
    } finally {
      setCargando(false);
    }
  };
  const soltar = useSoltarFotos(agregar); // soltar otra foto encima reemplaza la que hay

  return (
    <div className={`pd-drop is-parche${soltar.encima ? " is-over" : ""}`} {...soltar.props}>
      {foto ? (
        <div className="pd-foto is-parche">
          <img src={foto.startsWith("data:") ? foto : cld(foto, "f_auto,q_auto:eco,c_pad,b_white,w_320,h_150")} alt="Parche" />
          <button type="button" className="pd-foto-x" onClick={() => onChange("")} aria-label="Quitar foto del parche">
            <FaTimes />
          </button>
        </div>
      ) : (
        <button type="button" className="pd-foto-add is-parche" onClick={() => inputRef.current?.click()} disabled={cargando}>
          {cargando ? <span className="pd-spin is-dark" /> : <FaImage />}
          <small>Foto del parche</small>
        </button>
      )}
      {soltar.encima && <span className="pd-drop-hint">Soltá aquí</span>}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ""; agregar(files); }} />
    </div>
  );
}
