import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaStore, FaCalendarAlt, FaSearch, 
  FaTrash, FaReceipt, FaPrint, FaMoneyBillWave, 
  FaCreditCard, FaMobileAlt, FaCashRegister, FaStar, 
  FaUserCheck, FaBoxOpen, FaPlus, FaShoppingBag, FaExclamationTriangle,
  FaCheckCircle, FaClock, FaTimes, FaChevronRight
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";
import ModalShell from "./ModalShell";
import { io } from "socket.io-client";
import { getToken } from "../authFetch";

import { nombreAtendio } from "../utils/atendio";
const API_BASE = "https://chemas-sport-er-backend.onrender.com";
const PENDIENTES_STORAGE_KEY = "chemasport_tienda_ventas_pendientes_v1";

function getFechaHoyYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 🔥 Formateador de hora seguro para Costa Rica
function getHoraActualCR() {
  return new Date().toLocaleTimeString("es-CR", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function limpiarTexto(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parsePrecioCR(val) {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (!val) return 0;
  let str = String(val).trim();
  if (/^\d+\.\d{2}$/.test(str)) return Math.round(Number(str));
  const digits = str.replace(/[^\d]/g, "");
  return Number(digits) || 0;
}

function getProductPrice(p) {
  if (!p || typeof p !== "object") return 0;
  const candidatos = [
    p.discountPrice, p.precioOferta, p.price, p.precio, 
    p.valor, p.salePrice, p.precioVenta, p.amount
  ];
  for (const c of candidatos) {
    const num = parsePrecioCR(c);
    if (num > 0) return num;
  }
  const tipo = String(p.type || p.tipo || "").toLowerCase();
  if (tipo.includes("llavero")) return 2500;
  if (tipo.includes("player") || tipo.includes("jugador") || tipo.includes("retro") || tipo.includes("nacional")) {
    return 22000;
  }
  return 20000;
}

// 💸 Miniatura liviana de Cloudinary para mostrar en pantalla (no cambia el dato guardado)
function cldThumb(url, size = 96) {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url;
  if (/\/upload\/[^/]*(w_|c_fill)/.test(url)) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto:eco,c_fill,w_${size},h_${size}/`);
}

function getProductThumb(p) {
  if (!p) return "";
  if (typeof p.imageSrc === "string" && p.imageSrc) return p.imageSrc;
  if (typeof p.image === "string" && p.image) return p.image;
  if (typeof p.imageUrl === "string" && p.imageUrl) return p.imageUrl;
  if (typeof p.img === "string" && p.img) return p.img;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string" ? first : (first?.url || first?.src || "");
  }
  return "";
}

function getAvailableSizes(p) {
  if (!p || typeof p !== "object") return [];
  const lista = [];

  const leerMapa = (mapa, nombreUbicacion) => {
    if (!mapa || typeof mapa !== "object" || Array.isArray(mapa)) return;
    Object.entries(mapa).forEach(([tallaRaw, cantRaw]) => {
      const t = String(tallaRaw || "").trim().toUpperCase();
      const c = Number(cantRaw);
      if (t && Number.isFinite(c) && c > 0) {
        lista.push({ talla: t, stock: Math.trunc(c), ubicacion: nombreUbicacion });
      }
    });
  };

  leerMapa(p.tienda, "Tienda");
  leerMapa(p.stock, "Bodega 1");
  leerMapa(p.bodega, "Bodega 2");

  return lista;
}

function ajustarStockProductoLocal(prod, tallaBuscada, ubicacionBuscada, deltaCantidad) {
  if (!prod) return prod;
  const copia = JSON.parse(JSON.stringify(prod));
  const tUpper = String(tallaBuscada || "").replace(/^\d+x\s*/i, "").trim().toUpperCase();
  const ubiNorm = limpiarTexto(ubicacionBuscada || "Tienda");

  let campo = "tienda";
  if (ubiNorm.includes("bodega 1") || ubiNorm.includes("bodega1") || ubiNorm === "stock") {
    campo = "stock";
  } else if (ubiNorm.includes("bodega 2") || ubiNorm.includes("bodega2") || ubiNorm === "bodega") {
    campo = "bodega";
  } else {
    campo = "tienda";
  }

  if (!copia[campo] || typeof copia[campo] !== "object") {
    copia[campo] = {};
  }

  const realKey = Object.keys(copia[campo]).find((k) => k.trim().toUpperCase() === tUpper) || tUpper;
  const valActual = Number(copia[campo][realKey] || 0);
  copia[campo][realKey] = Math.max(0, Math.trunc(valActual + Number(deltaCantidad)));

  return copia;
}

/* 👕 IMPRESIONES (DORSALES) — mismas reglas que api/utils/dorsales.js */
const normDorsal = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const mismaImpresion = (a, b) => normDorsal(a?.name) === normDorsal(b?.name) && normDorsal(a?.number) === normDorsal(b?.number);
const textoDorsales = (lista) =>
  Array.isArray(lista) && lista.length ? lista.map((d) => `${String(d.name || "").toUpperCase()} #${d.number}`).join(", ") : "";

/** Suma/resta impresiones en la copia local del producto (para que el selector muestre lo que queda) */
function ajustarDorsalesLocal(prod, dorsales, delta) {
  if (!prod || !Array.isArray(dorsales) || !dorsales.length || !Array.isArray(prod.dorsalOptions)) return prod;
  const opciones = prod.dorsalOptions.map((o) => ({ ...o }));
  dorsales.forEach((d) => {
    const opt = opciones.find((o) => mismaImpresion(o, d));
    if (opt) opt.quantity = Math.max(0, (Number(opt.quantity) || 0) + delta);
  });
  return { ...prod, dorsalOptions: opciones };
}

function recalcularMontosFactura(factura, nuevoTotal) {
  const met = factura.metodoPago || "Efectivo";
  let montoEfectivo = 0;
  let montoDatafono = 0;
  let montoSinpe = 0;

  if (met === "Efectivo") {
    montoEfectivo = nuevoTotal;
  } else if (met === "Datáfono") {
    montoDatafono = nuevoTotal;
  } else if (met === "SINPE") {
    montoSinpe = nuevoTotal;
  } else {
    const viejoTotal = Number(factura.totalCobrado || 1) || 1;
    const ratio = nuevoTotal / viejoTotal;
    montoEfectivo = Math.round(Number(factura.montoEfectivo || 0) * ratio);
    montoDatafono = Math.round(Number(factura.montoDatafono || 0) * ratio);
    montoSinpe = Math.max(0, nuevoTotal - montoEfectivo - montoDatafono);
  }

  return { montoEfectivo, montoDatafono, montoSinpe };
}

function buildPages(page, pages) {
  const pageNumbers = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      pageNumbers.push(i);
    }
  }
  return pageNumbers;
}

// 💳 Métodos de pago: icono + explicación + color, para que no se confundan al cobrar
const METODOS_PAGO = [
  { id: "Efectivo", Icono: FaMoneyBillWave, ayuda: "Billetes o monedas", activo: "bg-yellow-500 text-white border-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { id: "Datáfono", Icono: FaCreditCard, ayuda: "Tarjeta en el datáfono", activo: "bg-blue-600 text-white border-blue-600", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  { id: "SINPE", Icono: FaMobileAlt, ayuda: "SINPE Móvil al celular", activo: "bg-purple-600 text-white border-purple-600", badge: "bg-purple-100 text-purple-800 border-purple-300" },
  { id: "Mixto", Icono: FaCashRegister, ayuda: "Pagó con 2 o más formas", activo: "bg-black text-white border-black", badge: "bg-gray-200 text-gray-900 border-gray-400" }
];
const metodoInfo = (id) => METODOS_PAGO.find((m) => m.id === id);

// 🧾 Datos que exige Hacienda (tiquete electrónico). Devuelve [{ id, label }] de lo que falta o está mal.
const CEDULA_DIGITOS = { "01": [9], "02": [10], "03": [11, 12], "04": [10] };
function faltantesHacienda(f) {
  const faltan = [];
  const cedula = String(f.cedula || "").replace(/\D/g, "");
  const largos = CEDULA_DIGITOS[f.tipoIdentificacion];
  if (!cedula) faltan.push({ id: "tienda-cedula-cliente", label: "Cédula" });
  else if (largos && !largos.includes(cedula.length)) faltan.push({ id: "tienda-cedula-cliente", label: `Cédula válida (${largos.join(" u ")} dígitos)` });
  if (!String(f.nombre || "").trim()) faltan.push({ id: "tienda-nombre-cliente", label: "Nombre" });
  const tel = String(f.telefono || "").replace(/\D/g, "");
  if (!tel) faltan.push({ id: "tienda-telefono-cliente", label: "Teléfono" });
  else if (tel.length < 8) faltan.push({ id: "tienda-telefono-cliente", label: "Teléfono válido (8 dígitos)" });
  const correo = String(f.correo || "").trim();
  if (!correo) faltan.push({ id: "tienda-correo-cliente", label: "Correo" });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) faltan.push({ id: "tienda-correo-cliente", label: "Correo válido" });
  return faltan;
}

export default function TiendaPage({ isSuperUser = false, user = null }) {
  const navigate = useNavigate();

  const [tipoVistaCaja, setTipoVistaCaja] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(() => getFechaHoyYMD());
  const [selectedMesYM, setSelectedMesYM] = useState(() => getFechaHoyYMD().slice(0, 7));
  const [fondoCajaBase, setFondoCajaBase] = useState(() => {
    try { return Number(localStorage.getItem("chemasport_tienda_fondo_caja") || 0); } catch { return 0; }
  });

  const [modoIngresoProducto, setModoIngresoProducto] = useState("catalogo"); // "catalogo" | "extra"
  // 👈 Concepto fijo: el detalle (equipo, versión, restante…) va en "Detalle opcional"
  const conceptoExtraTipo = "Ingreso Extra";
  const [detalleExtraCustom, setDetalleExtraCustom] = useState("");
  const [tallaExtraCustom, setTallaExtraCustom] = useState("U");
  const [cantidadExtraCustom, setCantidadExtraCustom] = useState(1);
  const [montoExtraCustom, setMontoExtraCustom] = useState("");

  const [catalogoBase, setCatalogoBase] = useState([]);
  const [tipoFiltroSeleccionado, setTipoFiltroSeleccionado] = useState("Todos");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [mostrarDropdownProductos, setMostrarDropdownProductos] = useState(false);

  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState("Tienda");
  const [tallaSeleccionada, setTallaSeleccionada] = useState("");
  const [cantidadVenta, setCantidadVenta] = useState(1);
  const [precioUnitarioInput, setPrecioUnitarioInput] = useState("");
  // 👕 Impresión de cada camiseta que se vende ("" = sin impresión, si no el índice en dorsalOptions)
  const [dorsalesVenta, setDorsalesVenta] = useState([]);

  const [carritoVentas, setCarritoVentas] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [facturasPendientes, setFacturasPendientes] = useState(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(PENDIENTES_STORAGE_KEY) || "[]");
      return Array.isArray(guardadas) ? guardadas : [];
    } catch {
      return [];
    }
  });
  const [emitiendoId, setEmitiendoId] = useState(null);

  const [facturasEmitidas, setFacturasEmitidas] = useState([]);
  const [searchHistorialFilter, setSearchHistorialFilter] = useState("");
  const [generandoTiquete, setGenerandoTiquete] = useState(false);

  const [contactosAlegra, setContactosAlegra] = useState([]);
  const [mostrarListaContactos, setMostrarListaContactos] = useState(false);
  // 👇 Datos del cliente plegados por defecto para que el formulario no se vea tan cargado
  const [mostrarDatosCliente, setMostrarDatosCliente] = useState(false);
  // 🧾 Pop up con el resumen de la venta antes de registrarla
  const [resumenVentaAbierto, setResumenVentaAbierto] = useState(false);
  const [favoritosIds, setFavoritosIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chemasport_contactos_favoritos") || "[]"); } catch { return []; }
  });

  const [formCliente, setFormCliente] = useState({
    tipoEmision: "interno",
    metodoPago: "", // 👈 sin valor por defecto: el vendedor tiene que escogerlo en cada venta
    pagoConBillete: "",
    montoEfectivoMixto: "",
    montoDatafonoMixto: "",
    montoSinpeMixto: "",
    tipoIdentificacion: "01",
    cedula: "",
    nombre: "",
    telefono: "",
    correo: ""
  });

  useEffect(() => {
    try {
      localStorage.setItem(PENDIENTES_STORAGE_KEY, JSON.stringify(facturasPendientes));
    } catch (e) {}
  }, [facturasPendientes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchHistorialFilter, selectedDate, selectedMesYM, tipoVistaCaja]);

  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  }, []);

  const esSuperAdmin = useMemo(() => {
    return Boolean(
      isSuperUser || 
      user?.isSuperUser || 
      storedUser?.isSuperUser === true || 
      storedUser?.role === "admin" || 
      storedUser?.rol === "admin"
    );
  }, [isSuperUser, user, storedUser]);

  // 🔒 Solo el súper usuario puede anular ventas ya registradas o quitarles artículos (el backend también lo exige)
  const puedeAnularVentas = Boolean(isSuperUser || user?.isSuperUser || storedUser?.isSuperUser === true);

  const nombreUsuarioActual = useMemo(() => {
    return user?.username || user?.name || user?.firstName || storedUser?.username || storedUser?.name || "Tienda";
  }, [user, storedUser]);

  const handleFondoCajaChange = (val) => {
    const num = Number(val) || 0;
    setFondoCajaBase(num);
    try { localStorage.setItem("chemasport_tienda_fondo_caja", String(num)); } catch (e) {}
  };

  useEffect(() => {
    let cancelado = false;
    const cargarTodoElCatalogo = async () => {
      try {
        let pageN = 1;
        const pageSize = 100;
        const acc = [];
        while (true) {
          const res = await fetch(`${API_BASE}/api/products?page=${pageN}&limit=${pageSize}&t=${Date.now()}`, {
            headers: { "x-admin": "true" },
            cache: "no-store"
          });
          if (!res.ok) break;
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          acc.push(...items);
          if (!data.total || acc.length >= data.total || items.length === 0) break;
          pageN += 1;
        }
        if (!cancelado) setCatalogoBase(acc);
      } catch (err) {
        console.error("Error cargando catálogo:", err);
      }
    };
    cargarTodoElCatalogo();
    cargarContactosAlegra("");
    return () => { cancelado = true; };
  }, []);

  // 🔴 EN VIVO: cuando el backend rebaja stock o impresiones (al emitir, o la hermana Player/Fan),
  // se actualiza aquí de una vez sin tener que refrescar
  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ["websocket", "polling"],
      auth: { token: getToken() },
    });
    const pidDe = (p) => String(p?._id || p?.id || "");
    socket.on("productoActualizado", (prodNuevo) => {
      const pid = pidDe(prodNuevo);
      if (!pid) return;
      const mezclar = (p) => (pidDe(p) === pid ? { ...p, ...prodNuevo } : p);
      setCatalogoBase((prev) => prev.map(mezclar));
      setResultadosBusqueda((prev) => prev.map(mezclar));
      setProductoSeleccionado((prev) => (prev && pidDe(prev) === pid ? { ...prev, ...prodNuevo } : prev));
    });
    return () => socket.disconnect();
  }, []);

  const tiposDisponibles = [
    "Todos",
    "Temp 26-27",
    "Nuevo",
    "Populares",
    "Mundial 2026",
    "Ofertas",
    "Nacional",
    "Player",
    "Fan",
    "Retro",
    "Mujer",
    "Niño",
    "Balón",
    "Abrigos",
    "Llaveros",
    "LEGO",
    "NBA",
    "MLB",
    "NFL",
    "F1"
  ];

  useEffect(() => {
    const q = busquedaProducto.trim();
    
    const filtrados = catalogoBase.filter((p) => {
      if (getAvailableSizes(p).length === 0) return false;

      if (tipoFiltroSeleccionado !== "Todos") {
        const t = String(p.type || p.tipo || "").trim();
        if (t.toLowerCase() !== tipoFiltroSeleccionado.toLowerCase()) return false;
      }
      if (!q) return true;
      const palabras = limpiarTexto(q).split(/\s+/).filter(Boolean);
      const txt = limpiarTexto(`${p.name || p.nombre || ""} ${p.type || p.tipo || ""}`);
      return palabras.every((w) => txt.includes(w));
    });

    setResultadosBusqueda(filtrados.slice(0, 15));

    if (!q) return;

    const timer = setTimeout(async () => {
      setBuscandoProductos(true);
      try {
        const params = new URLSearchParams({ page: "1", limit: "30", q });
        if (tipoFiltroSeleccionado !== "Todos") params.set("type", tipoFiltroSeleccionado);

        const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
          headers: { "x-admin": "true" }
        });
        if (res.ok) {
          const data = await res.json();
          const remotos = Array.isArray(data?.items) ? data.items : [];
          // 👈 Si ya lo tenemos en el catálogo local (al día por socket y ventas pendientes), usamos esa copia
          const locales = new Map(catalogoBase.map((p) => [String(p._id || p.id), p]));
          const remotosConStock = remotos
            .map((p) => locales.get(String(p._id || p.id)) || p)
            .filter((p) => getAvailableSizes(p).length > 0);
          if (remotosConStock.length > 0) setResultadosBusqueda(remotosConStock.slice(0, 15));
        }
      } catch (err) {
        console.error("Error buscando:", err);
      } finally {
        setBuscandoProductos(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [busquedaProducto, tipoFiltroSeleccionado, catalogoBase]);

  const cargarContactosAlegra = async (query = "") => {
    try {
      const url = query ? `${API_BASE}/api/alegra/contactos?q=${encodeURIComponent(query)}` : `${API_BASE}/api/alegra/contactos`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setContactosAlegra(data);
    } catch (err) {}
  };

  const toggleFavoritoContacto = (idContacto, e) => {
    if (e) e.stopPropagation();
    const idStr = String(idContacto);
    setFavoritosIds((prev) => {
      const nuevos = prev.includes(idStr) ? prev.filter(item => item !== idStr) : [idStr, ...prev];
      try { localStorage.setItem("chemasport_contactos_favoritos", JSON.stringify(nuevos)); } catch (e) {}
      return nuevos;
    });
  };

  const contactosOrdenadosYFiltrados = useMemo(() => {
    return [...contactosAlegra].sort((a, b) => {
      const aFav = favoritosIds.includes(String(a.id));
      const bFav = favoritosIds.includes(String(b.id));
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
  }, [contactosAlegra, favoritosIds]);

  const seleccionarContactoAlegra = (c) => {
    setFormCliente((prev) => ({
      ...prev,
      tipoIdentificacion: c.tipoIdentificacion || "01",
      cedula: c.cedula || prev.cedula,
      nombre: c.nombre || prev.nombre,
      telefono: c.telefono || prev.telefono,
      correo: c.email || c.correo || prev.correo
    }));
    setMostrarListaContactos(false);
    toastHOT.success(`Datos de ${c.nombre} cargados.`);
  };

  const fetchResumenTienda = async () => {
    try {
      const queryParam = tipoVistaCaja === "mes"
        ? `mes=${encodeURIComponent(selectedMesYM)}`
        : `fecha=${encodeURIComponent(selectedDate)}`;
      const res = await fetch(`${API_BASE}/api/tienda/resumen?${queryParam}`);
      if (!res.ok) return;
      const data = await res.json();
      const todasFacturas = Array.isArray(data?.facturas) ? data.facturas : [];
      setFacturasEmitidas(todasFacturas);
    } catch (err) {
      console.error("Error cargando resumen:", err);
    }
  };

  useEffect(() => {
    fetchResumenTienda();
  }, [selectedDate, selectedMesYM, tipoVistaCaja]);

  const pendientesDelPeriodo = useMemo(() => {
    return facturasPendientes.filter((f) => {
      const fFecha = String(f.fechaYMD || "");
      if (tipoVistaCaja === "mes") {
        return fFecha.startsWith(selectedMesYM);
      }
      return fFecha === selectedDate;
    });
  }, [facturasPendientes, tipoVistaCaja, selectedMesYM, selectedDate]);

  const resumenCaja = useMemo(() => {
    let efectivo = 0, datafono = 0, sinpe = 0, total = 0, totalPrendas = 0;
    const todasParaArqueo = [...pendientesDelPeriodo, ...facturasEmitidas];
    todasParaArqueo.forEach((f) => {
      efectivo += Number(f.montoEfectivo || 0);
      datafono += Number(f.montoDatafono || 0);
      sinpe += Number(f.montoSinpe || 0);
      total += Number(f.totalCobrado || 0);
      if (Array.isArray(f.ventas)) {
        f.ventas.forEach((v) => {
          // 👈 Abonos / saldos / ingresos extra suman a caja pero NO son chemas vendidas (no comisionan)
          const esAbono =
            v.esIngresoExtra ||
            v.ubicacion === "Ingreso / Abono" ||
            (Array.isArray(v.items) && v.items[0]?.tienda === "Ingreso / Abono");
          if (esAbono) return;
          totalPrendas += Number(v.totalUnidades || 1);
        });
      }
    });
    return {
      efectivo,
      datafono,
      sinpe,
      total,
      cantidadFacturas: todasParaArqueo.length,
      totalPrendas
    };
  }, [pendientesDelPeriodo, facturasEmitidas]);

  const todasTallasDelProducto = useMemo(() => {
    return getAvailableSizes(productoSeleccionado);
  }, [productoSeleccionado]);

  const ubicacionesConStock = useMemo(() => {
    const orden = ["Tienda", "Bodega 1", "Bodega 2"];
    const disponiblesSet = new Set(todasTallasDelProducto.map((x) => x.ubicacion));
    return orden.filter((ubi) => disponiblesSet.has(ubi));
  }, [todasTallasDelProducto]);

  const tallasDisponiblesActuales = useMemo(() => {
    return todasTallasDelProducto.filter((x) => x.ubicacion === ubicacionSeleccionada);
  }, [todasTallasDelProducto, ubicacionSeleccionada]);

  // 👕 Dorsales del producto elegido (solo si tiene la función activada)
  const opcionesDorsal = useMemo(() => {
    if (!productoSeleccionado?.isNumerable || !Array.isArray(productoSeleccionado.dorsalOptions)) return [];
    return productoSeleccionado.dorsalOptions
      .map((o, idx) => ({ ...o, idx }))
      .filter((o) => o.name || o.number);
  }, [productoSeleccionado]);

  const unidadesVenta = Math.max(1, Math.min(50, Math.trunc(Number(cantidadVenta) || 1)));

  // Impresiones ya apartadas en la cuenta (mismo nombre de camiseta = Player y Fan comparten)
  const dorsalesEnCarrito = useMemo(() => {
    const nombre = normDorsal(productoSeleccionado?.name);
    return carritoVentas
      .filter((it) => it.nombreBase && normDorsal(it.nombreBase) === nombre)
      .flatMap((it) => it.dorsales || []);
  }, [carritoVentas, productoSeleccionado]);

  const disponibleDorsal = (opt, posicion) => {
    const enCarrito = dorsalesEnCarrito.filter((d) => mismaImpresion(d, opt)).length;
    const enEsta = dorsalesVenta.filter((v, i) => i !== posicion && i < unidadesVenta && v !== "" && Number(v) === opt.idx).length;
    return (Number(opt.quantity) || 0) - enCarrito - enEsta;
  };

  const dorsalesElegidos = useMemo(
    () =>
      dorsalesVenta
        .slice(0, unidadesVenta)
        .filter((v) => v !== "" && productoSeleccionado?.dorsalOptions?.[Number(v)])
        .map((v) => {
          const o = productoSeleccionado.dorsalOptions[Number(v)];
          return { name: String(o.name || "").trim(), number: String(o.number || "").trim() };
        }),
    [dorsalesVenta, unidadesVenta, productoSeleccionado]
  );

  // ¿Faltan camisetas por escoger dorsal? (obligatorio mientras haya impresiones disponibles)
  const hayDorsalDisponible = opcionesDorsal.some((o) => (Number(o.quantity) || 0) > 0);
  const faltaEscogerDorsal = hayDorsalDisponible && dorsalesElegidos.length < unidadesVenta;

  const seleccionarProductoBusqueda = (prod) => {
    setProductoSeleccionado(prod);
    setMostrarDropdownProductos(false);
    setBusquedaProducto("");

    const disponibles = getAvailableSizes(prod);
    const orden = ["Tienda", "Bodega 1", "Bodega 2"];
    const primeraUbicacionConStock = orden.find((u) => disponibles.some((d) => d.ubicacion === u)) || disponibles[0]?.ubicacion || "Tienda";

    setUbicacionSeleccionada(primeraUbicacionConStock);
    const tallasDeUbi = disponibles.filter((d) => d.ubicacion === primeraUbicacionConStock);
    setTallaSeleccionada(tallasDeUbi[0]?.talla || "");
    setCantidadVenta(1);
    setDorsalesVenta([]);
    setPrecioUnitarioInput(String(getProductPrice(prod)));
  };

  const cambiarUbicacionSeleccionada = (nuevaUbi) => {
    setUbicacionSeleccionada(nuevaUbi);
    const tallasEnEsaUbi = todasTallasDelProducto.filter((x) => x.ubicacion === nuevaUbi);
    if (tallasEnEsaUbi.length > 0) {
      setTallaSeleccionada(tallasEnEsaUbi[0].talla);
    }
  };

  const agregarIngresoExtraAlCarrito = () => {
    const monto = Number(montoExtraCustom) || 0;
    const cant = Number(cantidadExtraCustom) || 1;
    if (monto <= 0) {
      toastHOT.error("Ingresa el monto del abono o pago (ej. 10000 o 5000).");
      return;
    }

    const nombreFinal = detalleExtraCustom.trim()
      ? `${conceptoExtraTipo} - ${detalleExtraCustom.trim()}`
      : conceptoExtraTipo;

    const tallaFinal = String(tallaExtraCustom || "U").trim().toUpperCase();

    const nuevoItemExtra = {
      uid: `extra_${Date.now()}`,
      productId: null,
      esIngresoExtra: true,
      item: nombreFinal,
      imagen: "",
      talla: tallaFinal,
      ubicacion: "Ingreso / Abono",
      tallasTexto: cant > 1 ? `${cant}x ${tallaFinal}` : tallaFinal,
      totalUnidades: cant,
      precioUnitarioCustom: monto,
      items: Array.from({ length: cant }, () => ({
        talla: tallaFinal,
        tienda: "Ingreso / Abono",
        nombre: nombreFinal
      }))
    };

    setCarritoVentas((prev) => [...prev, nuevoItemExtra]);
    setDetalleExtraCustom("");
    setMontoExtraCustom("");
    setCantidadExtraCustom(1);
    toastHOT.success("Abono / Ingreso extra agregado a la cuenta.");
  };

  const agregarPrendaAlCarrito = () => {
    if (!productoSeleccionado) {
      toastHOT.error("Selecciona una prenda.");
      return;
    }
    if (!tallaSeleccionada) {
      toastHOT.error("Selecciona una talla.");
      return;
    }

    const cant = Number(cantidadVenta) || 1;
    const precioUnit = Number(precioUnitarioInput) || getProductPrice(productoSeleccionado);

    if (cant <= 0 || precioUnit <= 0) {
      toastHOT.error("Verifica la cantidad y el precio.");
      return;
    }

    const infoTalla = tallasDisponiblesActuales.find((t) => t.talla === tallaSeleccionada);
    if (infoTalla && infoTalla.stock < cant) {
      toastHOT.error(`Solo hay ${infoTalla.stock} disponible(s) en talla ${tallaSeleccionada} (${ubicacionSeleccionada}).`);
      return;
    }

    if (faltaEscogerDorsal) {
      toastHOT.error(unidadesVenta > 1 ? "Escogé el dorsal de cada camiseta." : "Escogé el dorsal de la camiseta.");
      return;
    }

    const sinExistencia = opcionesDorsal.find((o) =>
      dorsalesVenta.slice(0, unidadesVenta).some((v, i) => v !== "" && Number(v) === o.idx && disponibleDorsal(o, i) <= 0)
    );
    if (sinExistencia) {
      toastHOT.error(`No quedan impresiones de ${String(sinExistencia.name || "").toUpperCase()} #${sinExistencia.number}.`);
      return;
    }

    const nombreBase = productoSeleccionado.name || productoSeleccionado.nombre || productoSeleccionado.title || "Camiseta";
    const tipoCat = productoSeleccionado.type || productoSeleccionado.tipo || "";
    const nombreCompleto = tipoCat && !nombreBase.includes(`(${tipoCat})`)
      ? `${nombreBase} (${tipoCat})`
      : nombreBase;

    const pid = String(productoSeleccionado._id || productoSeleccionado.id || "");

    const nuevoItem = {
      uid: `${pid}_${ubicacionSeleccionada}_${tallaSeleccionada}_${Date.now()}`,
      productId: pid,
      item: nombreCompleto,
      imagen: getProductThumb(productoSeleccionado),
      talla: tallaSeleccionada,
      ubicacion: ubicacionSeleccionada,
      tallasTexto: cant > 1 ? `${cant}x ${tallaSeleccionada}` : tallaSeleccionada,
      totalUnidades: cant,
      precioUnitarioCustom: precioUnit,
      nombreBase,
      dorsales: dorsalesElegidos,
      items: Array.from({ length: cant }, () => ({
        talla: tallaSeleccionada,
        tienda: ubicacionSeleccionada,
        nombre: nombreCompleto
      }))
    };

    setCarritoVentas((prev) => [...prev, nuevoItem]);
    setProductoSeleccionado(null);
    setTallaSeleccionada("");
    setCantidadVenta(1);
    setDorsalesVenta([]);
    setPrecioUnitarioInput("");
    toastHOT.success(`Prenda agregada desde ${ubicacionSeleccionada}.`);
  };

  const eliminarItemCarrito = (uid) => {
    // 👈 Cualquiera puede quitar del tiquete antes de emitir (todavía no se ha tocado el stock)
    setCarritoVentas((prev) => prev.filter((item) => item.uid !== uid));
  };

  const cambiarPrecioItemCarrito = (uid, nuevoPrecio) => {
    setCarritoVentas((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, precioUnitarioCustom: Number(nuevoPrecio) || 0 } : item))
    );
  };

  const buscarCedulaHacienda = async () => {
    if (!formCliente.cedula.trim()) {
      toastHOT.error("Ingrese una cédula para buscar.");
      return;
    }
    const toastId = toastHOT.loading("Consultando cliente...");
    try {
      const res = await fetch(`${API_BASE}/api/alegra/consultar-cedula/${formCliente.cedula.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se encontró el cliente");
      setFormCliente((prev) => ({
        ...prev,
        nombre: data.nombre || prev.nombre,
        tipoIdentificacion: data.tipoIdentificacion || prev.tipoIdentificacion,
        telefono: data.telefono || prev.telefono,
        correo: data.correo || prev.correo
      }));
      toastHOT.success("¡Cliente encontrado!", { id: toastId });
    } catch (error) {
      toastHOT.error(error.message, { id: toastId });
    }
  };

  // 👇 ventanaAbierta: ventana ya abierta en el click (Emitir e imprimir), para que el navegador no la bloquee tras el await
  const imprimirTicketNativo = (ventasArray, consecutivoOficial, totalCobrado, datosCliente = {}, metodoPago = "Efectivo", ventanaAbierta = null) => {
    const printWindow = ventanaAbierta && !ventanaAbierta.closed ? ventanaAbierta : window.open("", "_blank", "width=400,height=650");
    if (!printWindow) return alert("Por favor permite las ventanas emergentes.");

    const fechaHoy = datosCliente.fechaHora || new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" });
    const clienteNombre = datosCliente.nombre || "Cliente de Contado";
    const vendedorNombre = nombreAtendio(datosCliente.vendedor || nombreUsuarioActual); // 👈 al reimprimir sale quien la vendió

    // 🧾 Escapar texto del cliente/artículos para que no rompa el HTML del tiquete
    const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const colones = (n) => `₡${Math.round(Number(n) || 0).toLocaleString("de-DE")}`;
    const totalUnidadesTiquete = ventasArray.reduce((acc, v) => acc + (Number(v.totalUnidades) || 1), 0);
    const esElectronico = datosCliente.tipo === "hacienda";
    const pagos = datosCliente.pagos || {};
    const desglosePago = metodoPago === "Mixto"
      ? [["Efectivo", pagos.efectivo], ["Datáfono", pagos.datafono], ["SINPE", pagos.sinpe]].filter(([, m]) => Number(m) > 0)
      : [];

    // 🧾 Cada artículo en 2 renglones (como los tiquetes de farmacia): cant + descripción / precio unit. + importe
    const itemsHTML = ventasArray.map((v) => {
      const cant = Number(v.totalUnidades) || 1;
      const unit = Number(v.precioUnitarioCustom || v.precio || 0);
      const subtotalLinea = Math.round(unit * cant);
      const impresion = textoDorsales(v.dorsales);
      return `
        <div class="it">
          <div class="r"><span class="q">${cant}</span><span class="d">${esc(v.item)}</span><span class="u">${esc(v.tallasTexto || v.talla || "U")}</span></div>
          ${impresion ? `<div class="r"><span class="q"></span><span class="d nota-it">Impresión: ${esc(impresion)}</span></div>` : ""}
          <div class="r"><span class="q"></span><span class="d">${colones(unit)}</span><span class="u">${colones(subtotalLinea)}</span></div>
        </div>
      `;
    }).join("");

    const fila = (label, valor, clase = "") => `<div class="kv ${clase}"><span>${label}</span><span>${valor}</span></div>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tiquete ${esc(consecutivoOficial)}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              color: #000000 !important;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* 🧾 Papel de 80 mm: mismo margen calibrado para la impresora; todo en negrita y letra grande para que se lea bien en térmica */
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000000;
              font-weight: 700;
              margin: 0;
              padding: 6px 4px 36px 40px;
              width: 100%;
              max-width: 72mm;
              font-size: 13px;
              line-height: 1.4;
            }
            body * { font-weight: 700 !important; }
            p { margin: 0; }
            .marca { display: flex; align-items: center; gap: 10px; margin: 4px 0 10px; }
            .logo-img { width: 64px; height: 64px; flex-shrink: 0; object-fit: contain; filter: grayscale(100%) contrast(250%); }
            .marca-nombre { font-size: 20px; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.1; }
            .marca-sub { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }
            .neg { font-size: 12px; line-height: 1.45; }
            .sep { border-top: 2px dashed #000; margin: 9px 0; }
            .doc { font-size: 16px; line-height: 1.3; text-transform: uppercase; }
            .num-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 6px; font-size: 12px; margin-top: 4px; }
            .num-row span { white-space: nowrap; }
            .num-row b { font-size: 13px; margin-left: auto; text-align: right; overflow-wrap: anywhere; } /* 👈 el consecutivo de Hacienda (20 dígitos) baja entero al siguiente renglón */
            .contado { text-align: center; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0 8px; }
            .cli-t { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; }
            .cli-n { font-size: 13.5px; text-transform: uppercase; }
            .cab { display: flex; justify-content: space-between; font-size: 11.5px; text-transform: uppercase; line-height: 1.35; }
            .cab span:nth-child(2) { flex: 1; text-align: center; }
            .it { margin: 0 0 8px; }
            .r { display: flex; gap: 6px; font-size: 13px; line-height: 1.35; }
            .r .q { width: 24px; flex-shrink: 0; }
            .r .d { flex: 1; min-width: 0; word-break: break-word; }
            .r .u { text-align: right; white-space: nowrap; }
            .nota-it { font-size: 12px; }
            .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; text-transform: uppercase; line-height: 1.5; }
            .kv span:last-child { text-align: right; text-transform: none; }
            .kv.sub-pago { font-size: 12px; padding-left: 10px; }
            .kv.total { font-size: 18px; margin: 3px 0; }
            .pie { text-align: center; font-size: 12px; line-height: 1.5; margin-top: 4px; }
            .pie .web { letter-spacing: 1px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="marca">
            <img id="ticket-logo" src="${window.location.origin}/logo.png" alt="" class="logo-img" onerror="this.style.display='none'" />
            <div>
              <p class="marca-nombre">ChemaSport</p>
              <p class="marca-sub">ER · Grecia</p>
            </div>
          </div>

          <div class="neg">
            <p>CHEMASPORT ER</p>
            <p>CÉD. JURÍDICA 3-102-916554</p>
            <p>50 M OESTE DE LA BOMBA DELTA, GRECIA</p>
            <p>Teléfono +506 6036-9857</p>
          </div>

          <div class="sep"></div>

          <p class="doc">${esElectronico ? "Tiquete Electrónico" : "Tiquete de Venta"}</p>
          <div class="num-row"><span>N° comprobante</span><b>${esc(consecutivoOficial)}</b></div>
          <p class="neg">Fecha emisión ${esc(fechaHoy)}</p>
          <p class="neg">Atendió ${esc(vendedorNombre)}</p>

          <p class="contado">Venta al contado</p>

          <p class="cli-t">Datos del cliente</p>
          ${datosCliente.cedula ? `<p class="neg">Identificación ${esc(datosCliente.cedula)}</p>` : ""}
          <p class="cli-n">${esc(clienteNombre)}</p>

          <div class="sep"></div>

          <div class="cab"><span>Cantidad</span><span>Descripción</span><span>Talla</span></div>
          <div class="cab"><span>&nbsp;</span><span>Precio</span><span>Valor</span></div>

          <div class="sep"></div>

          ${itemsHTML}

          <div class="sep"></div>

          ${fila("Artículos", totalUnidadesTiquete)}
          ${fila("Total", colones(totalCobrado), "total")}
          ${fila(esc(metodoPago || "Pago"), desglosePago.length ? "" : colones(totalCobrado))}
          ${desglosePago.map(([k, m]) => fila(k, colones(m), "sub-pago")).join("")}

          <div class="sep"></div>

          <div class="pie">
            <p>¡Gracias por su compra!</p>
            <p>Conserve este tiquete para cambios o garantías.</p>
            <p class="web">chemasporter.com</p>
          </div>
          <script>
            function dispararImpresion() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 250);
            }
            window.onload = function() {
              var img = document.getElementById('ticket-logo');
              if (img && !img.complete) {
                img.onload = dispararImpresion;
                img.onerror = dispararImpresion;
              } else {
                dispararImpresion();
              }
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const listaFinalParaCobrar = useMemo(() => {
    if (carritoVentas.length > 0) return carritoVentas;

    if (modoIngresoProducto === "extra" && Number(montoExtraCustom) > 0) {
      const cant = Number(cantidadExtraCustom) || 1;
      const precioUnit = Number(montoExtraCustom) || 0;
      const nombreFinal = detalleExtraCustom.trim()
        ? `${conceptoExtraTipo} - ${detalleExtraCustom.trim()}`
        : conceptoExtraTipo;
      const tallaFinal = String(tallaExtraCustom || "U").trim().toUpperCase();

      return [{
        uid: "temp_extra_1",
        productId: null,
        esIngresoExtra: true,
        item: nombreFinal,
        talla: tallaFinal,
        ubicacion: "Ingreso / Abono",
        tallasTexto: cant > 1 ? `${cant}x ${tallaFinal}` : tallaFinal,
        totalUnidades: cant,
        precioUnitarioCustom: precioUnit,
        items: Array.from({ length: cant }, () => ({
          talla: tallaFinal,
          tienda: "Ingreso / Abono",
          nombre: nombreFinal
        }))
      }];
    }

    if (modoIngresoProducto === "catalogo" && productoSeleccionado && tallaSeleccionada) {
      const cant = Number(cantidadVenta) || 1;
      const precioUnit = Number(precioUnitarioInput) || getProductPrice(productoSeleccionado);
      const nombreBase = productoSeleccionado.name || productoSeleccionado.nombre || productoSeleccionado.title || "Camiseta";
      const tipoCat = productoSeleccionado.type || productoSeleccionado.tipo || "";
      const nombreCompleto = tipoCat && !nombreBase.includes(`(${tipoCat})`)
        ? `${nombreBase} (${tipoCat})`
        : nombreBase;
      const pid = String(productoSeleccionado._id || productoSeleccionado.id || "");

      return [{
        uid: "temp_1",
        productId: pid,
        item: nombreCompleto,
        talla: tallaSeleccionada,
        ubicacion: ubicacionSeleccionada,
        tallasTexto: cant > 1 ? `${cant}x ${tallaSeleccionada}` : tallaSeleccionada,
        totalUnidades: cant,
        precioUnitarioCustom: precioUnit,
        nombreBase,
        dorsales: dorsalesElegidos,
        items: Array.from({ length: cant }, () => ({
          talla: tallaSeleccionada,
          tienda: ubicacionSeleccionada,
          nombre: nombreCompleto
        }))
      }];
    }
    return [];
  }, [
    carritoVentas, modoIngresoProducto, montoExtraCustom, cantidadExtraCustom,
    detalleExtraCustom, conceptoExtraTipo, tallaExtraCustom,
    productoSeleccionado, tallaSeleccionada, ubicacionSeleccionada, cantidadVenta, precioUnitarioInput, dorsalesElegidos
  ]);

  const totalCalculadoForm = useMemo(() => {
    return listaFinalParaCobrar.reduce(
      (acc, item) => acc + (Number(item.precioUnitarioCustom) || 0) * (Number(item.totalUnidades) || 1),
      0
    );
  }, [listaFinalParaCobrar]);

  const vueltoCalculado = (Number(formCliente.pagoConBillete) || 0) - totalCalculadoForm;
  const esHacienda = formCliente.tipoEmision === "hacienda"; // 🧾 con Hacienda todos los datos son obligatorios

  // ✅ Validaciones antes de registrar (se usan al abrir el resumen y otra vez al confirmar)
  const validarVentaParaRegistrar = () => {
    if (listaFinalParaCobrar.length === 0) {
      toastHOT.error("Agrega al menos una prenda o un abono/ingreso extra para registrar en la tabla.");
      return false;
    }
    if (totalCalculadoForm <= 0) {
      toastHOT.error("El monto total debe ser mayor a 0.");
      return false;
    }
    if (carritoVentas.length === 0 && modoIngresoProducto === "catalogo" && productoSeleccionado && faltaEscogerDorsal) {
      toastHOT.error(unidadesVenta > 1 ? "Escogé el dorsal de cada camiseta." : "Escogé el dorsal de la camiseta.");
      return false;
    }

    // 👈 El nombre del cliente es obligatorio en toda venta de la tienda (también abonos / saldos / ingresos extra)
    if (!formCliente.nombre.trim()) {
      setMostrarDatosCliente(true);
      toastHOT.error("Escribí el nombre del cliente antes de registrar la venta o el abono.");
      setTimeout(() => {
        const input = document.getElementById("tienda-nombre-cliente");
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
        input?.focus();
      }, 50);
      return false;
    }

    // 👈 Hacienda: todos los datos del cliente son obligatorios (Ticket Interno solo pide el nombre)
    if (formCliente.tipoEmision === "hacienda") {
      const faltantes = faltantesHacienda(formCliente);
      if (faltantes.length > 0) {
        setMostrarDatosCliente(true);
        toastHOT.error(`Para Hacienda falta: ${faltantes.map((f) => f.label).join(", ")} (o cambiá a Ticket Interno).`);
        setTimeout(() => {
          const input = document.getElementById(faltantes[0].id);
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
          input?.focus();
        }, 50);
        return false;
      }
    }

    if (!metodoInfo(formCliente.metodoPago)) {
      toastHOT.error("Escogé el método de pago antes de registrar la venta.");
      document.getElementById("tienda-metodo-pago")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    if (formCliente.metodoPago === "Mixto") {
      const sumaMixto =
        (Number(formCliente.montoEfectivoMixto) || 0) +
        (Number(formCliente.montoDatafonoMixto) || 0) +
        (Number(formCliente.montoSinpeMixto) || 0);
      if (Math.abs(sumaMixto - totalCalculadoForm) > 1) {
        toastHOT.error(`La suma del pago mixto (₡${sumaMixto.toLocaleString("es-CR")}) debe ser igual al total.`);
        return false;
      }
    }
    return true;
  };

  // 👈 El botón "Registrar" primero muestra el resumen; la venta se registra al confirmar
  const abrirResumenVenta = () => {
    if (validarVentaParaRegistrar()) setResumenVentaAbierto(true);
  };

  const handleAgregarVentaATabla = () => {
    if (!validarVentaParaRegistrar()) return false;

    let efecMixto = Number(formCliente.montoEfectivoMixto) || 0;
    let datMixto = Number(formCliente.montoDatafonoMixto) || 0;
    let sinpeMixto = Number(formCliente.montoSinpeMixto) || 0;

    const clienteNombreFinal = formCliente.nombre.trim() || "Cliente de Contado";

    const ventasParaGuardar = listaFinalParaCobrar.map((item, idx) => ({
      _id: `item_${Date.now()}_${idx}`,
      item: item.item,
      totalUnidades: Number(item.totalUnidades) || 1,
      talla: item.talla,
      ubicacion: item.ubicacion || "Tienda",
      tallasTexto: item.tallasTexto,
      cliente: clienteNombreFinal,
      vendedor: nombreUsuarioActual,
      precioUnitarioCustom: Number(item.precioUnitarioCustom),
      productId: item.productId || null,
      esIngresoExtra: Boolean(item.esIngresoExtra),
      dorsales: Array.isArray(item.dorsales) ? item.dorsales : [],
      items: item.items
    }));

    const nuevaPendiente = {
      _id: `pend_${Date.now()}`,
      esPendiente: true,
      consecutivoOficial: "PENDIENTE",
      fechaHora: getHoraActualCR(),
      fechaYMD: selectedDate,
      tipo: formCliente.tipoEmision,
      vendedor: nombreUsuarioActual,
      cliente: {
        nombre: clienteNombreFinal,
        cedula: formCliente.cedula.trim(),
        telefono: formCliente.telefono.trim(),
        correo: formCliente.correo.trim(),
        tipoIdentificacion: formCliente.tipoIdentificacion || "01"
      },
      ventas: ventasParaGuardar,
      metodoPago: formCliente.metodoPago,
      montoEfectivo: formCliente.metodoPago === "Mixto" ? efecMixto : (formCliente.metodoPago === "Efectivo" ? totalCalculadoForm : 0),
      montoDatafono: formCliente.metodoPago === "Mixto" ? datMixto : (formCliente.metodoPago === "Datáfono" ? totalCalculadoForm : 0),
      montoSinpe: formCliente.metodoPago === "Mixto" ? sinpeMixto : (formCliente.metodoPago === "SINPE" ? totalCalculadoForm : 0),
      totalCobrado: totalCalculadoForm
    };

    setCatalogoBase((prev) =>
      prev.map((prod) => {
        let mod = prod;
        ventasParaGuardar.forEach((v) => {
          if (v.productId && String(prod._id || prod.id) === String(v.productId)) {
            mod = ajustarStockProductoLocal(mod, v.talla, v.ubicacion, -Number(v.totalUnidades || 1));
            mod = ajustarDorsalesLocal(mod, v.dorsales, -1);
          }
        });
        return mod;
      })
    );

    // 👈 Ya no se agrega a "Por emitir": se emite de una vez y solo queda pendiente si la emisión falla

    setCarritoVentas([]);
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCantidadVenta(1);
    setDorsalesVenta([]);
    setPrecioUnitarioInput("");
    setDetalleExtraCustom("");
    setMontoExtraCustom("");
    setCantidadExtraCustom(1);
    setTallaExtraCustom("U");
    // 🧹 Formulario limpio para la próxima venta: pago, tipo de emisión y datos del cliente
    // (la factura ya guardó su copia en nuevaPendiente.cliente)
    setFormCliente({
      tipoEmision: "interno",
      metodoPago: "",
      pagoConBillete: "",
      montoEfectivoMixto: "",
      montoDatafonoMixto: "",
      montoSinpeMixto: "",
      tipoIdentificacion: "01",
      cedula: "",
      nombre: "",
      telefono: "",
      correo: ""
    });
    setMostrarDatosCliente(false);
    setMostrarListaContactos(false);

    return nuevaPendiente; // 👈 se emite de una vez al confirmar (como mínimo interno)
  };

  // 👈 esNueva = viene directo del "Confirmar y emitir" (todavía no está en la tabla)
  const handleEmitirDesdeTabla = async (facturaPendiente, { esNueva = false } = {}) => {
    // 👈 La venta nueva entra a la tabla de una vez (se ve "Emitiendo…"); si la emisión falla queda "Por emitir" para reintentar
    if (esNueva) {
      setFacturasPendientes((prev) => [facturaPendiente, ...prev.filter((f) => f._id !== facturaPendiente._id)]);
    }

    if (!Array.isArray(facturaPendiente.ventas) || facturaPendiente.ventas.length === 0) {
      toastHOT.error("Esta factura no tiene artículos.");
      return;
    }

    const cedulaFinal = facturaPendiente.cliente?.cedula?.trim() || formCliente.cedula.trim();
    const nombreFinal = (facturaPendiente.cliente?.nombre && facturaPendiente.cliente.nombre !== "Cliente de Contado")
      ? facturaPendiente.cliente.nombre.trim()
      : (formCliente.nombre.trim() || "Cliente de Contado");
    const correoFinal = facturaPendiente.cliente?.correo?.trim() || formCliente.correo.trim();
    const telefonoFinal = facturaPendiente.cliente?.telefono?.trim() || formCliente.telefono.trim();
    const tipoIdFinal = facturaPendiente.cliente?.tipoIdentificacion || formCliente.tipoIdentificacion || "01";

    if (facturaPendiente.tipo === "hacienda" && (!cedulaFinal || !nombreFinal || !correoFinal || !telefonoFinal)) {
      setMostrarDatosCliente(true);
      toastHOT.error("Para emitir a Hacienda completa Cédula, Nombre, Teléfono y Correo en \"Datos del cliente\" arriba (o cambia a Ticket Interno).");
      return;
    }

    const payloadTienda = {
      ventas: facturaPendiente.ventas,
      tipo: facturaPendiente.tipo || "interno",
      precioManual: facturaPendiente.totalCobrado,
      cedula: cedulaFinal || "000000000",
      nombreCliente: nombreFinal,
      email: correoFinal || "cliente@chemasporter.com",
      telefono: telefonoFinal || "00000000",
      tipoIdentificacion: tipoIdFinal,
      metodoPago: facturaPendiente.metodoPago,
      montoEfectivo: facturaPendiente.montoEfectivo,
      montoDatafono: facturaPendiente.montoDatafono,
      montoSinpe: facturaPendiente.montoSinpe,
      fechaYMD: facturaPendiente.fechaYMD || selectedDate,
      fechaHora: new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })
    };

    // 🖨️ Se abre la ventana del tiquete ya (en el click); si se abre después del await el navegador la bloquea
    // 🖨️ Primero sale la ventana de imprimir (enfocada) con "Emitiendo…"; al llegar el número oficial se imprime sola
    const ventanaTiquete = window.open("", "_blank", "width=400,height=650");
    try {
      ventanaTiquete?.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Imprimiendo…</title>
        <style>body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:Arial,sans-serif;text-align:center}
        .sp{width:38px;height:38px;border:4px solid #e4e4e7;border-top-color:#000;border-radius:50%;animation:g 0.8s linear infinite}
        @keyframes g{to{transform:rotate(360deg)}} b{font-size:15px;text-transform:uppercase;letter-spacing:1px} small{color:#71717a;font-weight:700}</style></head>
        <body><div class="sp"></div><b>Emitiendo comprobante…</b><small>El tiquete se imprime en unos segundos</small></body></html>`);
      ventanaTiquete?.focus();
    } catch { /* sin ventana */ }

    setEmitiendoId(facturaPendiente._id);
    const toastId = toastHOT.loading("Emitiendo comprobante oficial...");

    try {
      const response = await fetch(`${API_BASE}/api/tienda/emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadTienda)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo emitir el comprobante");

      toastHOT.success(`¡Factura #${data.consecutivoOficial} emitida con éxito!`, { id: toastId });

      setFacturasPendientes((prev) => prev.filter((item) => item._id !== facturaPendiente._id));

      // 🖨️ Se imprime ya con el consecutivo oficial (nunca un tiquete "PENDIENTE")
      const fe = data.facturaTienda || {};
      // ✅ La fila pasa de una vez a "Emitida" (sin esperar a que recargue el resumen)
      if (fe._id) setFacturasEmitidas((prev) => [fe, ...prev.filter((f) => f._id !== fe._id)]);
      imprimirTicketNativo(
        fe.ventas || facturaPendiente.ventas,
        data.consecutivoOficial,
        data.totalCobrado ?? facturaPendiente.totalCobrado,
        {
          nombre: fe.cliente?.nombre || nombreFinal,
          cedula: fe.cliente?.cedula || cedulaFinal,
          fechaHora: fe.fechaHora || payloadTienda.fechaHora,
          tipo: fe.tipoEmision || payloadTienda.tipo,
          vendedor: fe.vendedor,
          pagos: { efectivo: fe.montoEfectivo ?? payloadTienda.montoEfectivo, datafono: fe.montoDatafono ?? payloadTienda.montoDatafono, sinpe: fe.montoSinpe ?? payloadTienda.montoSinpe }
        },
        fe.metodoPago || facturaPendiente.metodoPago,
        ventanaTiquete
      );

      await fetchResumenTienda();
    } catch (error) {
      try { ventanaTiquete?.close(); } catch { /* ya cerrada */ }
      toastHOT.error(`Error al emitir: ${error.message}${esNueva ? " · quedó en la tabla como \"Por emitir\" para reintentar" : ""}`, { id: toastId, duration: 6000 });
    } finally {
      setEmitiendoId(null);
    }
  };

  const cambiarTipoEmisionPendiente = (idPendiente, nuevoTipo) => {
    setFacturasPendientes((prev) =>
      prev.map((f) => (f._id === idPendiente ? { ...f, tipo: nuevoTipo } : f))
    );
  };

  const quitarArticuloDeFacturaEnTabla = (factura, idxArticulo) => {
    const ventasActuales = Array.isArray(factura.ventas) ? factura.ventas : [];
    const articuloQuitado = ventasActuales[idxArticulo];
    if (!articuloQuitado) return;
    if (!puedeAnularVentas) {
      toastHOT.error("Solo el súper admin puede modificar una venta.");
      return;
    }

    if (ventasActuales.length <= 1) {
      eliminarRegistroFacturaCaja(factura);
      return;
    }

    const ubi = articuloQuitado.ubicacion || (articuloQuitado.items && articuloQuitado.items[0]?.tienda) || "Tienda";
    const talla = articuloQuitado.talla || (articuloQuitado.items && articuloQuitado.items[0]?.talla) || articuloQuitado.tallasTexto || "U";
    const cantQuitada = Number(articuloQuitado.totalUnidades || 1);
    const subtotalQuitado = Math.round(Number(articuloQuitado.precioUnitarioCustom || 0) * cantQuitada);

    if (factura.esPendiente) {
      const nuevasVentas = ventasActuales.filter((_, i) => i !== idxArticulo);
      const nuevoTotal = nuevasVentas.reduce(
        (acc, v) => acc + Number(v.precioUnitarioCustom || 0) * Number(v.totalUnidades || 1),
        0
      );
      const nuevosMontos = recalcularMontosFactura(factura, nuevoTotal);

      setFacturasPendientes((prev) =>
        prev.map((f) =>
          f._id === factura._id
            ? { ...f, ventas: nuevasVentas, totalCobrado: nuevoTotal, ...nuevosMontos }
            : f
        )
      );

      if (articuloQuitado.productId) {
        setCatalogoBase((prev) =>
          prev.map((prod) => {
            if (String(prod._id || prod.id) === String(articuloQuitado.productId)) {
              return ajustarDorsalesLocal(ajustarStockProductoLocal(prod, talla, ubi, cantQuitada), articuloQuitado.dorsales, 1);
            }
            return prod;
          })
        );
      }

      toastHOT.success(`Se quitó ${articuloQuitado.item} (${talla}).`);
      return;
    }

    toastHOT((t) => (
      <div className="text-center p-2.5 text-black font-sans max-w-xs">
        <div className="flex justify-center text-amber-500 mb-1.5">
          <FaExclamationTriangle size={22} />
        </div>
        <p className="font-black text-sm mb-1 uppercase tracking-wide text-red-600">
          ¿Quitar este artículo de la factura?
        </p>
        <p className="text-xs text-zinc-600 mb-2">
          Se quitará <strong>{cantQuitada}x {articuloQuitado.item} (Talla {talla})</strong> y se restarán <strong>₡{subtotalQuitado.toLocaleString("es-CR")}</strong> de la factura.
        </p>
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-2 mb-3 text-left">
          <p className="text-[11px] font-black text-black leading-snug">
            • Ubicación: <span className="underline">{ubi}</span>
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={async () => {
              toastHOT.dismiss(t.id);
              const toastLoad = toastHOT.loading("Quitando artículo y actualizando...");
              try {
                const nuevasVentas = ventasActuales.filter((_, i) => i !== idxArticulo);
                const nuevoTotal = nuevasVentas.reduce(
                  (acc, v) => acc + Number(v.precioUnitarioCustom || 0) * Number(v.totalUnidades || 1),
                  0
                );
                const nuevosMontos = recalcularMontosFactura(factura, nuevoTotal);

                const resDel = await fetch(`${API_BASE}/api/tienda/${factura._id}`, { method: "DELETE" });
                if (!resDel.ok) throw new Error("No se pudo actualizar la factura original");

                const payloadReajuste = {
                  ventas: nuevasVentas,
                  tipo: "interno",
                  precioManual: nuevoTotal,
                  cedula: factura.cliente?.cedula || "000000000",
                  nombreCliente: factura.cliente?.nombre || "Cliente de Contado",
                  email: factura.cliente?.correo || "cliente@chemasporter.com",
                  telefono: factura.cliente?.telefono || "00000000",
                  tipoIdentificacion: factura.cliente?.tipoIdentificacion || "01",
                  metodoPago: factura.metodoPago,
                  montoEfectivo: nuevosMontos.montoEfectivo,
                  montoDatafono: nuevosMontos.montoDatafono,
                  montoSinpe: nuevosMontos.montoSinpe,
                  fechaYMD: selectedDate
                };

                const resReemitir = await fetch(`${API_BASE}/api/tienda/emitir`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payloadReajuste)
                });
                if (!resReemitir.ok) throw new Error("Error al guardar factura actualizada");

                if (articuloQuitado.productId) {
                  setCatalogoBase((prev) =>
                    prev.map((prod) => {
                      if (String(prod._id || prod.id) === String(articuloQuitado.productId)) {
                        return ajustarDorsalesLocal(ajustarStockProductoLocal(prod, talla, ubi, cantQuitada), articuloQuitado.dorsales, 1);
                      }
                      return prod;
                    })
                  );
                }

                toastHOT.success(`Artículo quitado correctamente.`, { id: toastLoad });
                fetchResumenTienda();
              } catch (err) {
                toastHOT.error(err.message || "Error al quitar artículo", { id: toastLoad });
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer"
          >
            Sí, Quitar Prenda
          </button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer">
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 9000 });
  };

  const eliminarRegistroFacturaCaja = (factura) => {
    if (!puedeAnularVentas) {
      toastHOT.error("Solo el súper admin puede anular o eliminar ventas.");
      return;
    }
    const detalleUbicaciones = Array.isArray(factura.ventas)
      ? factura.ventas.map((v) => {
          const ubi = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
          const talla = v.talla || v.tallasTexto || "U";
          return `${v.totalUnidades || 1}x ${v.item} (Talla ${talla}) ➔ ${ubi}`;
        })
      : [];

    toastHOT((t) => (
      <div className="text-center p-2.5 text-black font-sans max-w-xs">
        <div className="flex justify-center text-amber-500 mb-1.5">
          <FaExclamationTriangle size={22} />
        </div>
        <p className="font-black text-sm mb-1 uppercase tracking-wide text-red-600">
          {factura.esPendiente ? "¿Eliminar venta pendiente?" : "¿Anular esta venta?"}
        </p>
        <p className="text-xs text-zinc-600 mb-2">
          Se restarán <strong>₡{Number(factura.totalCobrado || 0).toLocaleString("es-CR")}</strong> de la caja.
        </p>

        {detalleUbicaciones.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 mb-3 text-left">
            <p className="text-[10px] font-black uppercase text-amber-900 mb-1">
              ⚠️ Detalle del registro:
            </p>
            {detalleUbicaciones.map((linea, idx) => (
              <p key={idx} className="text-[11px] font-black text-black leading-snug">
                • {linea}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={async () => {
              toastHOT.dismiss(t.id);
              if (factura.esPendiente) {
                if (Array.isArray(factura.ventas)) {
                  setCatalogoBase((prev) =>
                    prev.map((prod) => {
                      let mod = prod;
                      factura.ventas.forEach((v) => {
                        const ubi = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
                        const talla = v.talla || (v.items && v.items[0]?.talla) || v.tallasTexto;
                        if (v.productId && String(prod._id || prod.id) === String(v.productId)) {
                          mod = ajustarDorsalesLocal(ajustarStockProductoLocal(mod, talla, ubi, Number(v.totalUnidades || 1)), v.dorsales, 1);
                        }
                      });
                      return mod;
                    })
                  );
                }
                setFacturasPendientes((prev) => prev.filter((item) => item._id !== factura._id));
                toastHOT.success("Venta pendiente eliminada.");
                return;
              }

              try {
                const res = await fetch(`${API_BASE}/api/tienda/${factura._id}`, { method: "DELETE" });
                if (res.ok) {
                  if (Array.isArray(factura.ventas)) {
                    setCatalogoBase((prev) =>
                      prev.map((prod) => {
                        let mod = prod;
                        factura.ventas.forEach((v) => {
                          const ubi = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
                          const talla = v.talla || (v.items && v.items[0]?.talla) || v.tallasTexto;
                          if (v.productId && String(prod._id || prod.id) === String(v.productId)) {
                            mod = ajustarDorsalesLocal(ajustarStockProductoLocal(mod, talla, ubi, Number(v.totalUnidades || 1)), v.dorsales, 1);
                          }
                        });
                        return mod;
                      })
                    );
                  }
                  toastHOT.success("Factura anulada correctamente.");
                  fetchResumenTienda();
                }
              } catch (e) {
                toastHOT.error("Error al anular.");
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer"
          >
            Sí, Anular
          </button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer">
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 9000 });
  };

  const facturasFiltradas = useMemo(() => {
    const combinadas = [...pendientesDelPeriodo, ...facturasEmitidas];
    if (!searchHistorialFilter.trim()) return combinadas;
    const q = searchHistorialFilter.toLowerCase();
    return combinadas.filter(f => {
      const cli = String(f.cliente?.nombre || "").toLowerCase();
      const cons = String(f.consecutivoOficial || "").toLowerCase();
      const met = String(f.metodoPago || "").toLowerCase();
      return cli.includes(q) || cons.includes(q) || met.includes(q);
    });
  }, [pendientesDelPeriodo, facturasEmitidas, searchHistorialFilter]);

  const totalPages = Math.max(1, Math.ceil(facturasFiltradas.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const facturasPaginadas = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return facturasFiltradas.slice(start, start + itemsPerPage);
  }, [facturasFiltradas, safeCurrentPage, itemsPerPage]);

  // 🧾 Lo que se ve en la "Cuenta": lo agregado o, si no hay nada, la prenda/abono que se está armando (se cobra igual)
  const cuentaEsPreview = carritoVentas.length === 0 && listaFinalParaCobrar.length > 0;
  const metActivo = metodoInfo(formCliente.metodoPago);
  const fmtCRC = (n) => `₡${(Number(n) || 0).toLocaleString("es-CR")}`;
  const irACuenta = () => document.getElementById("tienda-cuenta")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen adm-page ts-page font-sans text-black relative">
      <div className="ts-wrap">

        {/* 🔝 BARRA SUPERIOR: volver, título y controles de caja */}
        <header className="ts-top">
          <div className="ts-top-left">
            <button type="button" onClick={() => navigate("/")} className="ts-back" title="Volver al catálogo">
              <FaChevronLeft size={12} />
            </button>
            <div className="min-w-0">
              <h1 className="ts-title">
                Caja · Tienda
                <span className="ts-pill"><FaShoppingBag size={11} /> {resumenCaja.totalPrendas || 0} chemas</span>
              </h1>
              <p className="ts-sub">Ventas en mostrador · {nombreUsuarioActual}</p>
            </div>
          </div>

          <div className="ts-top-controls">
            <div className="ts-seg is-sm" role="tablist">
              <button type="button" className={tipoVistaCaja === "dia" ? "is-on" : ""} onClick={() => setTipoVistaCaja("dia")}>Día</button>
              <button type="button" className={tipoVistaCaja === "mes" ? "is-on" : ""} onClick={() => setTipoVistaCaja("mes")}>Mes</button>
            </div>

            <label className="ts-chip-input">
              <FaCalendarAlt size={12} />
              {tipoVistaCaja === "dia" ? (
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              ) : (
                <input type="month" value={selectedMesYM} onChange={(e) => setSelectedMesYM(e.target.value)} />
              )}
            </label>

            <label className="ts-chip-input" title="Efectivo inicial para dar vueltos">
              <span className="ts-chip-label">Base ₡</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={fondoCajaBase || ""}
                onChange={(e) => handleFondoCajaChange(e.target.value)}
                placeholder="0"
                className="ts-base-input"
              />
            </label>
          </div>
        </header>

        {/* 💰 CAJA */}
        <section className="ts-stats">
          <div className="ts-stat is-efectivo">
            <span className="ts-stat-ico"><FaMoneyBillWave size={14} /></span>
            <span className="ts-stat-label">Efectivo en caja</span>
            <b className="ts-stat-num">{fmtCRC(Number(resumenCaja.efectivo || 0) + Number(fondoCajaBase || 0))}</b>
            <small>Ventas: {fmtCRC(resumenCaja.efectivo)}</small>
          </div>
          <div className="ts-stat is-datafono">
            <span className="ts-stat-ico"><FaCreditCard size={14} /></span>
            <span className="ts-stat-label">Datáfono</span>
            <b className="ts-stat-num">{fmtCRC(resumenCaja.datafono)}</b>
            <small>{tipoVistaCaja === "mes" ? "Tarjetas del mes" : "Tarjetas del día"}</small>
          </div>
          <div className="ts-stat is-sinpe">
            <span className="ts-stat-ico"><FaMobileAlt size={14} /></span>
            <span className="ts-stat-label">SINPE</span>
            <b className="ts-stat-num">{fmtCRC(resumenCaja.sinpe)}</b>
            <small>{tipoVistaCaja === "mes" ? "SINPE del mes" : "SINPE del día"}</small>
          </div>
          <div className="ts-stat is-total">
            <span className="ts-stat-ico"><FaCashRegister size={14} /></span>
            <span className="ts-stat-label">{tipoVistaCaja === "mes" ? "Total del mes" : "Total del día"}</span>
            <b className="ts-stat-num">{fmtCRC(resumenCaja.total)}</b>
            <small>{resumenCaja.cantidadFacturas || 0} comprobante(s) · {resumenCaja.totalPrendas || 0} prenda(s)</small>
          </div>
        </section>

        <div className="ts-grid">
          {/* 1️⃣ AGREGAR A LA CUENTA */}
          <section className="ts-card ts-add">
            <div className="ts-card-head">
              <span className="ts-step">1</span>
              <div>
                <h2>Agregar a la cuenta</h2>
                <p>Buscá la camiseta o registrá un ingreso extra</p>
              </div>
            </div>

            <div className="ts-seg is-full">
              <button
                type="button"
                className={modoIngresoProducto === "catalogo" ? "is-on" : ""}
                onClick={() => { setModoIngresoProducto("catalogo"); setProductoSeleccionado(null); setMostrarDropdownProductos(false); }}
              >
                <FaBoxOpen size={13} /> Inventario
              </button>
              <button
                type="button"
                className={modoIngresoProducto === "extra" ? "is-on" : ""}
                onClick={() => { setModoIngresoProducto("extra"); setProductoSeleccionado(null); setMostrarDropdownProductos(false); }}
              >
                <FaPlus size={11} /> Ingreso extra
              </button>
            </div>
            <p className="ts-hint">
              {modoIngresoProducto === "catalogo"
                ? "Rebaja el stock de la ubicación que escojás."
                : "Abono, saldo restante o prenda ya rebajada: suma a caja sin tocar el stock."}
            </p>

            {modoIngresoProducto === "catalogo" ? (
              <>
                <div className="ts-chips scrollbar-hide">
                  {tiposDisponibles.map((t) => {
                    const activo = String(tipoFiltroSeleccionado).toLowerCase() === String(t).toLowerCase();
                    return (
                      <button key={t} type="button" onClick={() => setTipoFiltroSeleccionado(t)} className={`ts-chip ${activo ? "is-on" : ""}`}>
                        {t}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <div className="ts-search">
                    <FaSearch size={14} className="ts-search-ico" />
                    <input
                      type="text"
                      value={busquedaProducto}
                      onFocus={() => setMostrarDropdownProductos(true)}
                      onChange={(e) => {
                        setBusquedaProducto(e.target.value);
                        setMostrarDropdownProductos(true);
                      }}
                      placeholder="Buscar equipo, jugador o categoría…"
                    />
                    {buscandoProductos && <span className="ts-search-status">Buscando…</span>}
                  </div>

                  {mostrarDropdownProductos && resultadosBusqueda.length > 0 && (
                    <div className="ts-results">
                      {resultadosBusqueda.map((p) => {
                        const nombre = p.name || p.nombre || p.title || "Camiseta";
                        const tipo = p.type || p.tipo || "";
                        const precio = getProductPrice(p);
                        const thumb = getProductThumb(p);
                        const totalDisp = getAvailableSizes(p).reduce((acc, t) => acc + (Number(t.stock) || 0), 0);

                        return (
                          <div key={p._id || p.id} onClick={() => seleccionarProductoBusqueda(p)} className="ts-result">
                            {thumb ? (
                              <img src={cldThumb(thumb)} alt="" className="ts-thumb" />
                            ) : (
                              <div className="ts-thumb is-empty"><FaShoppingBag size={14} /></div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="ts-result-name">{nombre} {tipo && <span>({tipo})</span>}</p>
                              {/* 👈 Solo el total: las tallas se ven al seleccionar la camiseta */}
                              <p className={`ts-result-stock ${totalDisp === 0 ? "is-zero" : ""}`}>
                                {totalDisp} disponible{totalDisp === 1 ? "" : "s"}
                              </p>
                            </div>
                            <span className="ts-result-precio">{fmtCRC(precio)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {productoSeleccionado ? (
                  <div className="ts-sel">
                    <div className="ts-sel-head">
                      {getProductThumb(productoSeleccionado) && (
                        <img src={cldThumb(getProductThumb(productoSeleccionado), 192)} alt="" className="ts-thumb is-lg" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="ts-eyebrow">Prenda seleccionada</span>
                        <h4 className="ts-sel-name">
                          {productoSeleccionado.name || productoSeleccionado.nombre} {productoSeleccionado.type ? `(${productoSeleccionado.type})` : ""}
                        </h4>
                      </div>
                      <button type="button" onClick={() => setProductoSeleccionado(null)} className="ts-x" title="Quitar selección">
                        <FaTimes size={12} />
                      </button>
                    </div>

                    <div className="ts-field">
                      <span className="ts-label">¿De dónde sale?</span>
                      <div className="ts-opts">
                        {["Tienda", "Bodega 1", "Bodega 2"].map((ubi) => {
                          const tieneEnUbi = ubicacionesConStock.includes(ubi);
                          const activa = ubicacionSeleccionada === ubi;
                          return (
                            <button
                              key={ubi}
                              type="button"
                              onClick={() => cambiarUbicacionSeleccionada(ubi)}
                              className={`ts-opt ${activa ? "is-on" : ""} ${!tieneEnUbi && !activa ? "is-off" : ""}`}
                            >
                              {ubi}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="ts-field">
                      <span className="ts-label">Talla en {ubicacionSeleccionada}</span>
                      {tallasDisponiblesActuales.length === 0 ? (
                        <p className="ts-empty-line">No hay tallas disponibles en {ubicacionSeleccionada}.</p>
                      ) : (
                        <div className="ts-opts">
                          {tallasDisponiblesActuales.map((t) => {
                            const activa = tallaSeleccionada === t.talla;
                            return (
                              <button
                                key={`${t.ubicacion}_${t.talla}`}
                                type="button"
                                onClick={() => setTallaSeleccionada(t.talla)}
                                className={`ts-opt is-talla ${activa ? "is-on" : ""}`}
                              >
                                {t.talla}
                                <small>{t.stock}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {opcionesDorsal.length > 0 && (
                      <div className="ts-dorsal">
                        <span className="ts-label is-blue">👕 Dorsal de {unidadesVenta > 1 ? "cada camiseta" : "la camiseta"}</span>
                        <p>
                          {hayDorsalDisponible
                            ? "Se rebaja también en la versión Player/Fan del mismo equipo."
                            : "No quedan impresiones disponibles de esta camiseta."}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Array.from({ length: unidadesVenta }, (_, i) => (
                            <select
                              key={`dorsal_venta_${i}`}
                              value={dorsalesVenta[i] ?? ""}
                              onChange={(e) =>
                                setDorsalesVenta((prev) => {
                                  const copia = Array.from({ length: unidadesVenta }, (_, j) => prev[j] ?? "");
                                  copia[i] = e.target.value;
                                  return copia;
                                })
                              }
                              className="ts-input"
                            >
                              <option value="" disabled>{unidadesVenta > 1 ? `Camiseta ${i + 1}: ` : ""}Escogé el dorsal…</option>
                              {opcionesDorsal.map((o) => {
                                const quedan = disponibleDorsal(o, i);
                                return (
                                  <option key={o.idx} value={String(o.idx)} disabled={quedan <= 0 && String(dorsalesVenta[i]) !== String(o.idx)}>
                                    {unidadesVenta > 1 ? `Camiseta ${i + 1}: ` : ""}{String(o.name || "").toUpperCase()} #{o.number} ({Math.max(0, quedan)} disp.)
                                  </option>
                                );
                              })}
                            </select>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="ts-row">
                      <div className="ts-field">
                        <span className="ts-label">Cantidad</span>
                        <div className="ts-stepper">
                          <button type="button" onClick={() => setCantidadVenta((c) => Math.max(1, (Number(c) || 1) - 1))} aria-label="Menos">−</button>
                          <input type="number" min="1" value={cantidadVenta} onChange={(e) => setCantidadVenta(e.target.value)} />
                          <button type="button" onClick={() => setCantidadVenta((c) => (Number(c) || 0) + 1)} aria-label="Más">+</button>
                        </div>
                      </div>
                      <div className="ts-field">
                        <span className="ts-label">Precio c/u</span>
                        <div className="ts-money">
                          <span>₡</span>
                          <input type="number" value={precioUnitarioInput} onChange={(e) => setPrecioUnitarioInput(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={agregarPrendaAlCarrito} className="ts-btn is-dark is-block">
                      <FaPlus size={11} /> Agregar a la cuenta
                    </button>
                  </div>
                ) : (
                  <div className="ts-placeholder">
                    <FaSearch size={18} />
                    <p>Buscá una camiseta para escoger ubicación, talla y cantidad.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="ts-sel">
                <div className="ts-row">
                  <div className="ts-field">
                    <span className="ts-label">Concepto</span>
                    <div className="ts-fixed">{conceptoExtraTipo}</div>
                  </div>
                  <div className="ts-field">
                    <span className="ts-label">Talla / Ref</span>
                    <input
                      type="text"
                      value={tallaExtraCustom}
                      onChange={(e) => setTallaExtraCustom(e.target.value)}
                      placeholder="Ej. M, L o U"
                      className="ts-input uppercase"
                    />
                  </div>
                </div>

                <div className="ts-field">
                  <span className="ts-label">Detalle (opcional)</span>
                  <input
                    type="text"
                    value={detalleExtraCustom}
                    onChange={(e) => setDetalleExtraCustom(e.target.value)}
                    placeholder="Ej. Real Madrid, restante de camiseta ya entregada…"
                    className="ts-input"
                  />
                </div>

                <div className="ts-row">
                  <div className="ts-field">
                    <span className="ts-label">Cantidad</span>
                    <div className="ts-stepper">
                      <button type="button" onClick={() => setCantidadExtraCustom((c) => Math.max(1, (Number(c) || 1) - 1))} aria-label="Menos">−</button>
                      <input type="number" min="1" value={cantidadExtraCustom} onChange={(e) => setCantidadExtraCustom(e.target.value)} />
                      <button type="button" onClick={() => setCantidadExtraCustom((c) => (Number(c) || 0) + 1)} aria-label="Más">+</button>
                    </div>
                  </div>
                  <div className="ts-field">
                    <span className="ts-label">Monto a cobrar</span>
                    <div className="ts-money">
                      <span>₡</span>
                      <input type="number" value={montoExtraCustom} onChange={(e) => setMontoExtraCustom(e.target.value)} placeholder="Ej. 10000" />
                    </div>
                  </div>
                </div>

                <button type="button" onClick={agregarIngresoExtraAlCarrito} className="ts-btn is-dark is-block">
                  <FaPlus size={11} /> Agregar ingreso extra
                </button>
              </div>
            )}
          </section>

          {/* 2️⃣ CUENTA: artículos, pago, comprobante, cliente y cobrar */}
          <aside className="ts-card ts-cuenta" id="tienda-cuenta">
            <div className="ts-card-head">
              <span className="ts-step">2</span>
              <div>
                <h2>Cuenta</h2>
                <p>{carritoVentas.length > 0 ? `${carritoVentas.length} artículo${carritoVentas.length === 1 ? "" : "s"} agregado${carritoVentas.length === 1 ? "" : "s"}` : "Todavía no hay artículos"}</p>
              </div>
            </div>

            {listaFinalParaCobrar.length === 0 ? (
              <div className="ts-placeholder is-sm">
                <FaReceipt size={18} />
                <p>Lo que agregués aparece aquí. Podés quitarlo si el cliente cambia de idea.</p>
              </div>
            ) : (
              <ul className="ts-items">
                {cuentaEsPreview && (
                  <li className="ts-preview-note">Sin agregar todavía · se cobra igual si registrás</li>
                )}
                {listaFinalParaCobrar.map((item) => (
                  <li key={item.uid} className={`ts-item ${cuentaEsPreview ? "is-preview" : ""}`}>
                    {item.imagen && <img src={cldThumb(item.imagen)} alt="" className="ts-thumb is-sm" />}
                    <div className="ts-item-info">
                      <b>{item.totalUnidades > 1 ? `${item.totalUnidades}× ` : ""}{item.item}</b>
                      <small>
                        Talla {item.talla} · {item.ubicacion || "Tienda"}
                      </small>
                      {textoDorsales(item.dorsales) && <small className="is-blue">👕 {textoDorsales(item.dorsales)}</small>}
                    </div>
                    {cuentaEsPreview ? (
                      <span className="ts-item-precio">{fmtCRC((Number(item.precioUnitarioCustom) || 0) * (Number(item.totalUnidades) || 1))}</span>
                    ) : (
                      <div className="ts-item-actions">
                        <div className="ts-money is-sm" title="Precio c/u">
                          <span>₡</span>
                          <input type="number" value={item.precioUnitarioCustom} onChange={(e) => cambiarPrecioItemCarrito(item.uid, e.target.value)} />
                        </div>
                        {/* 👈 Cualquiera puede quitar antes de emitir: todavía no se tocó el stock */}
                        <button type="button" onClick={() => eliminarItemCarrito(item.uid)} className="ts-del" title="Quitar de la cuenta">
                          <FaTrash size={12} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="ts-total">
              <span>Total</span>
              <b>{fmtCRC(totalCalculadoForm)}</b>
            </div>

            <div id="tienda-metodo-pago" className="ts-field">
              <span className="ts-label">¿Cómo pagó?</span>
              {!formCliente.metodoPago && (
                <p className="ts-warn">👆 Tocá la forma de pago. Se pide en cada venta para que la caja cuadre.</p>
              )}
              <div className="ts-metodos">
                {METODOS_PAGO.map((m) => {
                  const activo = formCliente.metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setFormCliente({ ...formCliente, metodoPago: m.id })}
                      className={`ts-metodo ${activo ? `${m.activo} is-on` : ""}`}
                      title={m.ayuda}
                    >
                      {activo && <FaCheckCircle size={11} className="ts-metodo-check" />}
                      <m.Icono size={17} />
                      <span>{m.id}</span>
                    </button>
                  );
                })}
              </div>

              {formCliente.metodoPago === "Efectivo" && (
                <div className="ts-vuelto">
                  <div className="ts-field">
                    <span className="ts-label">Pagó con</span>
                    <div className="ts-money">
                      <span>₡</span>
                      <input type="number" value={formCliente.pagoConBillete} onChange={(e) => setFormCliente({ ...formCliente, pagoConBillete: e.target.value })} placeholder="Ej. 25000" />
                    </div>
                  </div>
                  {Number(formCliente.pagoConBillete) > 0 && (
                    <div className="ts-vuelto-num">
                      <span>Vuelto</span>
                      <b className={vueltoCalculado >= 0 ? "" : "is-neg"}>{fmtCRC(vueltoCalculado)}</b>
                    </div>
                  )}
                </div>
              )}

              {formCliente.metodoPago === "Mixto" && (
                <div className="ts-mixto">
                  <label>
                    <span className="is-efectivo">Efectivo</span>
                    <input type="number" value={formCliente.montoEfectivoMixto} onChange={(e) => setFormCliente({ ...formCliente, montoEfectivoMixto: e.target.value })} className="ts-input" />
                  </label>
                  <label>
                    <span className="is-datafono">Datáfono</span>
                    <input type="number" value={formCliente.montoDatafonoMixto} onChange={(e) => setFormCliente({ ...formCliente, montoDatafonoMixto: e.target.value })} className="ts-input" />
                  </label>
                  <label>
                    <span className="is-sinpe">SINPE</span>
                    <input type="number" value={formCliente.montoSinpeMixto} onChange={(e) => setFormCliente({ ...formCliente, montoSinpeMixto: e.target.value })} className="ts-input" />
                  </label>
                </div>
              )}
            </div>

            <div className="ts-field">
              <span className="ts-label">Comprobante</span>
              <div className="ts-seg is-full">
                <button type="button" className={formCliente.tipoEmision === "interno" ? "is-on" : ""} onClick={() => setFormCliente({ ...formCliente, tipoEmision: "interno" })}>
                  Ticket interno
                </button>
                <button
                  type="button"
                  className={formCliente.tipoEmision === "hacienda" ? "is-on" : ""}
                  onClick={() => { setFormCliente({ ...formCliente, tipoEmision: "hacienda" }); setMostrarDatosCliente(true); }}
                >
                  Hacienda
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setMostrarDatosCliente((v) => !v)}
                aria-expanded={mostrarDatosCliente}
                className={`ts-cliente-toggle ${!formCliente.nombre.trim() || (esHacienda && faltantesHacienda(formCliente).length > 0) ? "is-missing" : ""}`}
              >
                <FaUserCheck size={14} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <b>Cliente</b>
                  <small>
                    {esHacienda && faltantesHacienda(formCliente).length > 0
                      ? `Hacienda · falta: ${faltantesHacienda(formCliente).map((f) => f.label).join(", ")}`
                      : formCliente.nombre.trim() || formCliente.cedula.trim()
                      ? `${formCliente.nombre.trim() || "Sin nombre"}${formCliente.cedula.trim() ? ` · ${formCliente.cedula.trim()}` : ""}`
                      : "Falta el nombre · tocá para escribirlo"}
                  </small>
                </span>
                <FaChevronRight size={11} className={`shrink-0 transition-transform duration-200 ${mostrarDatosCliente ? "transform rotate-90" : ""}`} />
              </button>

              {mostrarDatosCliente && (
                <div className="ts-cliente">
                  <div className="relative">
                    <button type="button" onClick={() => setMostrarListaContactos((prev) => !prev)} className="ts-favs">
                      <FaStar className="text-amber-500" size={13} />
                      <span className="flex-1">Favoritos / Alegra ({contactosAlegra.length})</span>
                      <small>{mostrarListaContactos ? "Cerrar ▲" : "Elegir ▼"}</small>
                    </button>

                    {mostrarListaContactos && (
                      <div className="ts-favs-list">
                        {contactosOrdenadosYFiltrados.length === 0 ? (
                          <p className="ts-empty-line text-center">No hay contactos guardados en Alegra.</p>
                        ) : (
                          contactosOrdenadosYFiltrados.map((c) => {
                            const esFav = favoritosIds.includes(String(c.id));
                            return (
                              <div key={c.id} onClick={() => seleccionarContactoAlegra(c)} className="ts-fav">
                                <div className="min-w-0 flex-1">
                                  <b>{c.nombre}</b>
                                  <small>{c.cedula ? `ID: ${c.cedula}` : "Sin ID"} {c.telefono ? `· Tel: ${c.telefono}` : ""}</small>
                                </div>
                                <button type="button" onClick={(e) => toggleFavoritoContacto(c.id, e)} className="ts-fav-star">
                                  <FaStar size={13} className={esFav ? "text-amber-400" : "text-zinc-300"} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="ts-row is-id">
                    <div className="ts-field">
                      <span className="ts-label">Tipo ID {esHacienda ? "*" : ""}</span>
                      <select value={formCliente.tipoIdentificacion} onChange={(e) => setFormCliente({ ...formCliente, tipoIdentificacion: e.target.value })} className="ts-input">
                        <option value="01">Física</option>
                        <option value="02">Jurídica</option>
                        <option value="03">DIMEX</option>
                        <option value="04">NITE</option>
                        <option value="05">Extranjero</option>
                        <option value="06">No Contrib.</option>
                      </select>
                    </div>
                    <div className="ts-field">
                      <span className="ts-label">Cédula {esHacienda ? "*" : "(opcional)"}</span>
                      <div className="ts-with-btn">
                        <input id="tienda-cedula-cliente" type="text" inputMode="numeric" required={esHacienda} value={formCliente.cedula} onChange={(e) => setFormCliente({ ...formCliente, cedula: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") buscarCedulaHacienda(); }} placeholder="Ej. 101110222" className="ts-input" />
                        <button type="button" onClick={buscarCedulaHacienda} className="ts-btn is-dark" title="Buscar en Hacienda">
                          <FaSearch size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="ts-field">
                    <span className="ts-label">Nombre *</span>
                    <input id="tienda-nombre-cliente" type="text" required value={formCliente.nombre} onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })} placeholder="Nombre del cliente…" className="ts-input" />
                  </div>

                  <div className="ts-row">
                    <div className="ts-field">
                      <span className="ts-label">Teléfono {esHacienda ? "*" : "(opcional)"}</span>
                      <input id="tienda-telefono-cliente" type="tel" required={esHacienda} value={formCliente.telefono} onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })} placeholder="Ej. 88888888" className="ts-input" />
                    </div>
                    <div className="ts-field">
                      <span className="ts-label">Correo {esHacienda ? "*" : "(opcional)"}</span>
                      <input id="tienda-correo-cliente" type="email" required={esHacienda} value={formCliente.correo} onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })} placeholder="cliente@correo.com" className="ts-input" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={abrirResumenVenta}
              disabled={generandoTiquete}
              className={`ts-cobrar ${metActivo ? metActivo.activo : "is-idle"}`}
            >
              {metActivo ? <metActivo.Icono size={16} /> : <FaCashRegister size={15} />}
              <span>
                {metActivo
                  ? `Cobrar ${fmtCRC(totalCalculadoForm)} · ${metActivo.id}`
                  : "Escogé cómo pagó para cobrar"}
              </span>
            </button>
          </aside>
        </div>

        {/* 📋 TABLA DE COMPROBANTES CON PAGINADO */}
        <div className="ts-card ts-tabla">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                {tipoVistaCaja === "mes"
                  ? `Ventas y Comprobantes del Mes (General)`
                  : `Ventas y Comprobantes de Hoy (General)`}
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Mostrando {(safeCurrentPage - 1) * itemsPerPage + 1} - {Math.min(safeCurrentPage * itemsPerPage, facturasFiltradas.length)} de {facturasFiltradas.length} comprobantes.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <input type="text" value={searchHistorialFilter} onChange={(e) => setSearchHistorialFilter(e.target.value)} placeholder="Buscar comprobante..." className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black" />
              <FaSearch className="absolute left-3.5 top-3 -translate-y-1/2 text-zinc-400" size={13} />
            </div>
          </div>

          {facturasFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-zinc-400 font-bold text-xs uppercase tracking-wider">
                No hay ventas ni comprobantes en tienda para este periodo ({tipoVistaCaja === "mes" ? selectedMesYM : selectedDate}).
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-400 uppercase tracking-wider font-black text-[10px]">
                      <th className="py-3 px-3">Estado / Hora</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Artículos</th>
                      <th className="py-3 px-3">Ubicación</th>
                      <th className="py-3 px-3">Método de Pago</th>
                      <th className="py-3 px-3 text-right">Total Cobrado</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {facturasPaginadas.map((f) => {
                      const esPendiente = Boolean(f.esPendiente);
                      const estaEmitiendoEsta = emitiendoId === f._id;

                      return (
                        <tr key={f._id} className={`${esPendiente ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-zinc-50"} transition-colors`}>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {esPendiente && estaEmitiendoEsta ? (
                              <span className="tp-emitiendo">
                                <span className="tp-emitiendo-sp" aria-hidden="true" /> Emitiendo…
                              </span>
                            ) : esPendiente ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-black text-[10px] uppercase tracking-wider">
                                <FaClock size={10} /> Por Emitir
                              </span>
                            ) : (
                              <span className="font-black text-black block text-xs">#{f.consecutivoOficial}</span>
                            )}
                            <span className="text-[10px] text-zinc-400 font-bold block mt-0.5">{f.fechaHora}</span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="font-black text-black block text-xs">{f.cliente?.nombre || "Cliente de Contado"}</span>
                            {f.cliente?.cedula && <span className="text-[10px] text-zinc-500 font-mono">ID: {f.cliente.cedula}</span>}
                          </td>

                          <td className="py-3.5 px-3 text-zinc-700">
                            <div className="flex flex-col gap-1.5">
                              {Array.isArray(f.ventas) && f.ventas.map((v, idx) => (
                                <div key={idx} className="inline-flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-zinc-800 w-fit shadow-2xs">
                                  <span>
                                    {v.totalUnidades || 1}x {v.item} {v.tallasTexto ? `(${v.tallasTexto})` : ""}
                                    {textoDorsales(v.dorsales) && <span className="text-blue-700"> · 👕 {textoDorsales(v.dorsales)}</span>}
                                  </span>
                                  {puedeAnularVentas && <button
                                    type="button"
                                    onClick={() => quitarArticuloDeFacturaEnTabla(f, idx)}
                                    className="text-zinc-400 hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                                    title="Quitar este artículo de la factura y devolver al stock"
                                  >
                                    <FaTimes size={11} />
                                  </button>}
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              {Array.isArray(f.ventas) && f.ventas.map((v, idx) => {
                                const ubi = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
                                return (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-300 text-black font-black text-[10px] w-fit"
                                  >
                                    {ubi}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {(() => {
                              const met = metodoInfo(f.metodoPago);
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black text-[11px] ${met ? met.badge : "bg-gray-100 text-gray-700 border-gray-300"}`}>
                                  {met && <met.Icono size={11} />}
                                  {f.metodoPago || "—"}
                                </span>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-3 text-right font-black text-blue-600 text-xs whitespace-nowrap">
                            ₡{Number(f.totalCobrado || 0).toLocaleString("es-CR")}
                          </td>

                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              {esPendiente && estaEmitiendoEsta ? (
                                <span className="tp-emitiendo">
                                  <span className="tp-emitiendo-sp" aria-hidden="true" /> Emitiendo…
                                </span>
                              ) : esPendiente ? (
                                <>
                                  {/* 🔒 Ya no hay "Imprimir" suelto: solo se imprime al emitir (con consecutivo oficial) */}
                                  <select
                                    value={f.tipo || "interno"}
                                    onChange={(e) => cambiarTipoEmisionPendiente(f._id, e.target.value)}
                                    className="px-2 py-1.5 bg-white border border-zinc-300 rounded-xl text-[10px] font-black text-black outline-none cursor-pointer"
                                    title="Tipo de emisión"
                                  >
                                    <option value="interno">Interno</option>
                                    <option value="hacienda">Hacienda</option>
                                  </select>

                                  <button
                                    type="button"
                                    disabled={estaEmitiendoEsta}
                                    onClick={() => handleEmitirDesdeTabla(f)}
                                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                                    title="Emitir comprobante e imprimir tiquete"
                                  >
                                    <FaReceipt size={12} />
                                    <FaPrint size={12} />
                                    <span>{estaEmitiendoEsta ? "Emitiendo..." : "Emitir e imprimir"}</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="tp-emitida" title="Comprobante ya emitido">
                                    <FaCheckCircle size={11} /> Emitida
                                  </span>
                                  {/* 🔥 3. REIMPRESIÓN RÁPIDA PARA YA EMITIDAS */}
                                  <button
                                    type="button"
                                    onClick={() => imprimirTicketNativo(f.ventas || [], f.consecutivoOficial, f.totalCobrado, { nombre: f.cliente?.nombre, cedula: f.cliente?.cedula, fechaHora: f.fechaHora, tipo: f.tipoEmision, vendedor: f.vendedor, pagos: { efectivo: f.montoEfectivo, datafono: f.montoDatafono, sinpe: f.montoSinpe } }, f.metodoPago)}
                                    className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                                    title="Reimprimir Tiquete"
                                  >
                                    <FaPrint size={12} className="text-amber-400" />
                                    <span>Reimprimir</span>
                                  </button>
                                </>
                              )}

                              {puedeAnularVentas && !estaEmitiendoEsta && (
                                <button
                                  type="button"
                                  onClick={() => eliminarRegistroFacturaCaja(f)}
                                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                  title={esPendiente ? "Eliminar venta pendiente" : "Anular factura completa y devolver stock"}
                                >
                                  <FaTrash size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 📄 CONTROLES DE PAGINADO */}
              {totalPages > 1 && (
                <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                    Página {safeCurrentPage} de {totalPages}
                  </span>

                  <nav className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-2.5 text-xs text-white bg-black rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                    >
                      <FaChevronLeft size={11} />
                    </button>

                    {(() => {
                      const nums = buildPages(safeCurrentPage, totalPages);
                      return nums.map((n, i) => {
                        const prev = nums[i - 1];
                        const showDots = i > 0 && n - prev > 1;
                        const isCurrent = n === safeCurrentPage;

                        return (
                          <span key={n} className="flex items-center gap-1.5">
                            {showDots && (
                              <span className="px-1.5 text-zinc-400 font-bold text-xs">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(n)}
                              className={`min-w-[34px] h-9 px-2.5 text-xs font-black rounded-xl transition-all cursor-pointer border ${
                                isCurrent
                                  ? "bg-black text-white border-black shadow-sm"
                                  : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-black hover:bg-zinc-100"
                              }`}
                            >
                              {n}
                            </button>
                          </span>
                        );
                      });
                    })()}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="p-2.5 text-xs text-white bg-black rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                    >
                      <FaChevronRight size={11} />
                    </button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* 📱 Barra de cobro fija en celular: total + ir a la cuenta */}
      {listaFinalParaCobrar.length > 0 && (
        <div className="ts-mbar">
          <div className="ts-mbar-info">
            <small>{listaFinalParaCobrar.reduce((acc, it) => acc + (Number(it.totalUnidades) || 1), 0)} artículo(s)</small>
            <b>{fmtCRC(totalCalculadoForm)}</b>
          </div>
          <button type="button" onClick={irACuenta} className="ts-mbar-btn">
            <FaCashRegister size={14} /> Cobrar
          </button>
        </div>
      )}

      {/* 🧾 RESUMEN DE LA VENTA: se confirma antes de registrarla */}
      {resumenVentaAbierto && (() => {
        const met = metodoInfo(formCliente.metodoPago);
        const unidades = listaFinalParaCobrar.reduce((acc, it) => acc + (Number(it.totalUnidades) || 1), 0);
        const fmt = (n) => `₡${(Number(n) || 0).toLocaleString("de-DE")}`;
        const billete = Number(formCliente.pagoConBillete) || 0;
        const desgloseMixto = [
          ["Efectivo", formCliente.montoEfectivoMixto],
          ["Datáfono", formCliente.montoDatafonoMixto],
          ["SINPE", formCliente.montoSinpeMixto]
        ].filter(([, v]) => Number(v) > 0);
        const cliente = formCliente.nombre.trim() || "Cliente de Contado";
        return (
          <ModalShell
            onClose={() => setResumenVentaAbierto(false)}
            size="md"
            icon={FaReceipt}
            eyebrow="Confirmar venta"
            title="Resumen de la venta"
            subtitle={`${unidades} artículo${unidades === 1 ? "" : "s"} · revisá que todo esté bien antes de registrar`}
            footer={(close) => (
              <>
                <button type="button" onClick={close} className="md-btn is-flat">Volver</button>
                <button
                  type="button"
                  className="md-btn is-success"
                  onClick={() => {
                    // 🔒 Toda venta se emite al confirmar (interno como mínimo); si falla queda pendiente para reintentar
                    const nueva = handleAgregarVentaATabla();
                    if (nueva) { close(); handleEmitirDesdeTabla(nueva, { esNueva: true }); }
                  }}
                >
                  <FaCheckCircle size={14} /> Confirmar y emitir · {fmt(totalCalculadoForm)}
                </button>
              </>
            )}
          >
            <div className="md-section">
              <span className="md-section-title">Artículos</span>
              <ul className="tr-list">
                {listaFinalParaCobrar.map((it, idx) => {
                  const cant = Number(it.totalUnidades) || 1;
                  const unit = Number(it.precioUnitarioCustom) || 0;
                  return (
                    <li key={it.uid || idx} className="tr-item">
                      <div className="tr-item-info">
                        <b>{cant}× {it.item}</b>
                        <small>
                          {it.tallasTexto || it.talla ? `Talla ${it.tallasTexto || it.talla}` : ""}
                          {it.ubicacion ? ` · ${it.ubicacion}` : ""}
                          {cant > 1 ? ` · ${fmt(unit)} c/u` : ""}
                          {textoDorsales(it.dorsales) ? ` · 👕 ${textoDorsales(it.dorsales)}` : ""}
                        </small>
                      </div>
                      <span className="tr-item-precio">{fmt(unit * cant)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="md-section">
              <span className="md-section-title">Pago</span>
              <div className="tr-row">
                <span>Método</span>
                <span className={`tr-badge border ${met?.badge || ""}`}>
                  {met && <met.Icono size={11} />} {formCliente.metodoPago}
                </span>
              </div>
              {formCliente.metodoPago === "Mixto" && desgloseMixto.map(([k, v]) => (
                <div key={k} className="tr-row is-sub"><span>{k}</span><b>{fmt(v)}</b></div>
              ))}
              {formCliente.metodoPago === "Efectivo" && billete > 0 && (
                <>
                  <div className="tr-row is-sub"><span>Pagó con</span><b>{fmt(billete)}</b></div>
                  <div className="tr-row is-sub">
                    <span>Vuelto</span>
                    <b style={{ color: vueltoCalculado >= 0 ? "#a16207" : "#dc2626" }}>{fmt(vueltoCalculado)}</b>
                  </div>
                </>
              )}
              <div className="tr-row">
                <span>Comprobante</span>
                <b>{formCliente.tipoEmision === "hacienda" ? "Tiquete Electrónico (Hacienda)" : "Ticket interno"}</b>
              </div>
              <div className="tr-row">
                <span>Cliente</span>
                <b>{cliente}{formCliente.cedula.trim() ? ` · ${formCliente.cedula.trim()}` : ""}</b>
              </div>
              <div className="tr-row">
                <span>Vendedor</span>
                <b>{nombreUsuarioActual}</b>
              </div>
            </div>

            {formCliente.metodoPago === "Efectivo" && billete > 0 && vueltoCalculado < 0 && (
              <p className="tr-alerta">
                <FaExclamationTriangle size={12} /> El billete no alcanza: faltan {fmt(-vueltoCalculado)}.
              </p>
            )}

            <div className="tr-total">
              <span>Total a cobrar</span>
              <b>{fmt(totalCalculadoForm)}</b>
            </div>
          </ModalShell>
        );
      })()}
    </div>
  );
}