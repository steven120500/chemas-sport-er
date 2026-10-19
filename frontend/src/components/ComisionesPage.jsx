import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaTrophy, FaCalendarAlt, FaSearch, 
  FaFilePdf, FaTrash, FaLock, FaExclamationTriangle, FaReceipt,
  FaEdit, FaCheck, FaTimes, FaTruck, FaStar, FaUserCheck
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;
}

// Normaliza texto quitando tildes, espacios y símbolos para comparar nombres exactos
function normText(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Limpia el nombre quitando el "(Player)", "(Fan)", etc. del final
function normBaseName(str = "") {
  const sinParentesis = String(str).replace(/\s*\([^)]*\)\s*$/g, "");
  return normText(sinParentesis);
}

// Extrae la categoría entre paréntesis del log, ej: "Real Madrid (Player)" -> "player"
function extractCatFromItem(str = "") {
  const match = String(str).match(/\(([^)]+)\)\s*$/);
  return match ? normText(match[1]) : "";
}

// Convierte cualquier formato de precio ("₡22.000", "22,000", 22000) al número real 22000
function parsePrecioCR(val) {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (!val) return 0;
  let str = String(val).trim();
  // Si viene con decimales tipo 22000.00
  if (/^\d+\.\d{2}$/.test(str)) {
    return Math.round(Number(str));
  }
  const digits = str.replace(/[^\d]/g, "");
  return Number(digits) || 0;
}

// Extrae el precio real de un objeto producto sin importar cómo se llame el campo en MongoDB
function getProductPrice(p) {
  if (!p || typeof p !== "object") return 0;
  const candidatos = [
    p.price,
    p.precio,
    p.valor,
    p.costo,
    p.salePrice,
    p.precioVenta,
    p.amount,
    p.discountPrice,
    p.precioOferta
  ];
  for (const c of candidatos) {
    const num = parsePrecioCR(c);
    if (num > 0) return num;
  }
  return 0;
}

const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Ema", "Johan", "Johanna", "Jose", "JuanPa", "Stef", "Melissa", "Ashly"];

function extractClienteSeguro(detailsStr) {
  if (typeof detailsStr !== "string") return "Cliente General";
  const idx = detailsStr.indexOf("Cliente:");
  if (idx === -1) return "Cliente General";
  const after = detailsStr.substring(idx + 8);
  const endIdx = after.indexOf("|");
  const raw = endIdx !== -1 ? after.substring(0, endIdx) : after;
  return String(raw || "").trim() || "Cliente General";
}

function parseSaleDetails(log) {
  const detailsStr = typeof log?.details === "string" ? log.details : JSON.stringify(log?.details || "");
  const cliente = extractClienteSeguro(detailsStr);
  const vendedor = String(log?.user || "Sistema").trim();
  const itemGeneral = String(log?.item || "Camiseta").trim();

  const rawIdSearch = `${log?.productId || ''} ${log?.itemId || ''} ${detailsStr}`;
  const [, idHex] = rawIdSearch.match(/([a-f0-9]{24})/i) || [];
  const productId = idHex || null;

  const cleanDetails = detailsStr.replace(/\[ID:[^\]]+\]\s*\|?\s*/gi, "").trim();

  const items = [];
  const tallasAgrupadas = {};
  let totalUnidades = 0;

  try {
    const segmentos = cleanDetails.split("|");
    segmentos.forEach((segmento) => {
      const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/i;
      const match = regex.exec(segmento);
      if (match) {
        const [, rawTalla, oldStr, newStr] = match;
        const talla = String(rawTalla || "").trim().toUpperCase();
        const oldV = Number(oldStr) || 0;
        const newV = Number(newStr) || 0;
        let tienda = "Tienda";
        if (segmento.includes("Bodega 2") || segmento.includes("Tienda #2")) tienda = "Bodega 2";
        else if (segmento.includes("Bodega 1") || segmento.includes("Tienda #1")) tienda = "Bodega 1";

        const cantidad = Math.abs(oldV - newV);
        if (cantidad > 0 && talla && talla !== "U" && !talla.includes("ID")) {
          totalUnidades += cantidad;
          tallasAgrupadas[talla] = (tallasAgrupadas[talla] || 0) + cantidad;
          for (let i = 0; i < cantidad; i++) items.push({ tienda, talla, nombre: itemGeneral });
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  if (items.length === 0) {
    const [, fallbackTalla] = cleanDetails.match(/\[([A-Z0-9]+)\]/i) || [];
    if (fallbackTalla) {
      const cleanFallback = String(fallbackTalla).toUpperCase();
      let tiendaFallback = "Tienda";
      if (cleanDetails.includes("Bodega 2") || cleanDetails.includes("Tienda #2")) tiendaFallback = "Bodega 2";
      else if (cleanDetails.includes("Bodega 1") || cleanDetails.includes("Tienda #1")) tiendaFallback = "Bodega 1";

      items.push({ tienda: tiendaFallback, talla: cleanFallback, nombre: itemGeneral });
      tallasAgrupadas[cleanFallback] = 1;
      totalUnidades = 1;
    } else if (String(log?.action || "").toLowerCase().includes("vend")) {
      items.push({ tienda: "General", talla: "U", nombre: itemGeneral });
      tallasAgrupadas["U"] = 1;
      totalUnidades = 1;
    }
  }

  const tallasTexto = Object.entries(tallasAgrupadas)
    .map(([talla, cant]) => (cant > 1 ? `${cant}x ${talla}` : `${talla}`))
    .join(", ");

  // Si el log ya traía precio directo guardado
  let precioEnLog = parsePrecioCR(log?.price || log?.precio || log?.total || 0);
  if (!precioEnLog) {
    const matchPrecio = detailsStr.match(/(?:Precio|Total|Monto)\s*:\s*₡?\s*([\d.,]+)/i);
    if (matchPrecio && matchPrecio[1]) {
      precioEnLog = parsePrecioCR(matchPrecio[1]);
    }
  }

  const unidadesFinales = totalUnidades || 1;

  return { 
    cliente, 
    vendedor, 
    items, 
    totalUnidades: unidadesFinales, 
    tallasTexto, 
    productId, 
    rawDetails: detailsStr,
    precioEnLog
  };
}

export default function ComisionesPage({ isSuperUser = false, user = null }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [catalogoMap, setCatalogoMap] = useState({ byId: {}, byFullKey: {}, byBaseName: {} });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => ymLocal());
  const [searchFilter, setSearchFilter] = useState("");
  const [comisionPorPrenda, setComisionPorPrenda] = useState(800);
  const [generandoTiquete, setGenerandoTiquete] = useState(false);
  const [ventasSeleccionadas, setVentasSeleccionadas] = useState([]);

  // ✏️ Estados para Precios Personalizados en la Tabla (con persistencia en localStorage)
  const [preciosPersonalizados, setPreciosPersonalizados] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chemasport_precios_custom") || "{}");
    } catch {
      return {};
    }
  });
  const [editandoPrecioId, setEditandoPrecioId] = useState(null);
  const [tempPrecioFila, setTempPrecioFila] = useState("");

  // ⭐ Estados para Contactos de Alegra y Favoritos en el Modal
  const [contactosAlegra, setContactosAlegra] = useState([]);
  const [mostrarListaContactos, setMostrarListaContactos] = useState(false);
  const [favoritosIds, setFavoritosIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chemasport_contactos_favoritos") || "[]");
    } catch {
      return [];
    }
  });

  // 🔥 MODAL UNIFICADO DE FACTURACIÓN (INCLUYE ENVÍO PERSONALIZABLE, TICKET INTERNO POR DEFECTO)
  const [modalFacturar, setModalFacturar] = useState({
    isOpen: false,
    ventas: [],
    precio: "",
    incluyeEnvio: false,
    precioEnvio: "2500",
    tipoEmision: "interno", // "interno" | "hacienda"
    tipoIdentificacion: "01",
    cedula: "",
    nombre: "",
    telefono: "",
    correo: ""
  });

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

  // Nombre del usuario logueado actualmente para validar que solo pueda anular sus propias ventas
  const nombreUsuarioActual = useMemo(() => {
    return String(
      user?.username ||
      user?.name ||
      user?.firstName ||
      storedUser?.username ||
      storedUser?.name ||
      storedUser?.firstName ||
      ""
    ).trim();
  }, [user, storedUser]);

  const puedeAnularVenta = (venta) => {
    if (esSuperAdmin) return true;
    if (!nombreUsuarioActual || !venta?.vendedor) return false;
    return normText(venta.vendedor) === normText(nombreUsuarioActual);
  };

  // ⭐ Cargar lista de contactos de Alegra al abrir el modal
  const cargarContactosAlegra = async (query = "") => {
    try {
      const url = query
        ? `${API_BASE}/api/alegra/contactos?q=${encodeURIComponent(query)}`
        : `${API_BASE}/api/alegra/contactos`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setContactosAlegra(data);
      }
    } catch (err) {
      console.error("Error cargando contactos de Alegra:", err);
    }
  };

  // ⭐ Alternar un contacto como Favorito
  const toggleFavoritoContacto = (idContacto, e) => {
    if (e) e.stopPropagation();
    const idStr = String(idContacto);
    setFavoritosIds((prev) => {
      const nuevos = prev.includes(idStr)
        ? prev.filter((item) => item !== idStr)
        : [idStr, ...prev];
      try {
        localStorage.setItem("chemasport_contactos_favoritos", JSON.stringify(nuevos));
      } catch (err) {
        console.error(err);
      }
      return nuevos;
    });
  };

 // ⭐ Ordenar: Favoritos primero, mostrando todos los contactos de Alegra listos para elegir
 const contactosOrdenadosYFiltrados = useMemo(() => {
  return [...contactosAlegra].sort((a, b) => {
    const aFav = favoritosIds.includes(String(a.id));
    const bFav = favoritosIds.includes(String(b.id));
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });
}, [contactosAlegra, favoritosIds]);

// ⭐ Seleccionar un contacto de Alegra y rellenar todos los campos del modal
const seleccionarContactoAlegra = (c) => {
  setModalFacturar((prev) => ({
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

  // 🛍️ 1. CARGAR CATÁLOGO COMPLETO DE PRODUCTOS
  useEffect(() => {
    const fetchCatalogo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products?limit=10000&all=true`);
        if (!res.ok) return;
        const data = await res.json();
        const lista = Array.isArray(data?.items) 
          ? data.items 
          : (Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []));

        const byId = {};
        const byFullKey = {};
        const byBaseName = {};

        lista.forEach((p) => {
          const precioUnitario = getProductPrice(p);
          if (precioUnitario > 0) {
            const pid = p._id || p.id;
            if (pid) byId[String(pid)] = precioUnitario;

            const rawName = p.name || p.nombre || p.title || p.item || "";
            const rawCat = p.category || p.categoria || p.type || p.tipo || "";

            if (rawName) {
              const base = normBaseName(rawName);
              const full = normText(rawName);
              const cat = normText(rawCat);

              byBaseName[base] = precioUnitario;
              byFullKey[full] = precioUnitario;
              if (cat) {
                byFullKey[`${base}_${cat}`] = precioUnitario;
              }
            }
          }
        });

        setCatalogoMap({ byId, byFullKey, byBaseName });
      } catch (err) {
        console.error("Error cargando precios del catálogo:", err);
      }
    };

    fetchCatalogo();
  }, []);

  const fetchVentas = async () => {
    setLoading(true);
    setVentasSeleccionadas([]); 
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const params = new URLSearchParams({ page: "1", limit: "3000", month: selectedMonth, _: String(Date.now()) });
      const res = await fetch(`${API_BASE}/api/history?` + params.toString(), {
        headers: { "Content-Type": "application/json", "x-super": storedUser?.isSuperUser ? "true" : "false", "x-roles": roles },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []));
    } catch (err) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedMonth]);

  const ventasFiltradas = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs.map((log) => {
      const parsed = parseSaleDetails(log);
      const actionStr = String(log?.action || "").toLowerCase();
      const detailsStr = String(log?.details || "").toLowerCase();
      const esVenta = actionStr.includes("vend") || (parsed.totalUnidades > 0 && !actionStr.includes("ajust") && !actionStr.includes("actualiz") && !detailsStr.includes("ajuste"));
      return { ...log, ...parsed, esVenta };
    }).filter((v) => v.esVenta && v.totalUnidades > 0);
  }, [logs]);

  // 🔍 2. SI ALGUNA VENTA TIENE PRODUCT_ID PERO NO VINO EN EL CATÁLOGO GENERAL (EJ. AGOTADO O PAGINADO), LO BUSCA INDIVIDUALMENTE
  useEffect(() => {
    const missingIds = [
      ...new Set(
        ventasFiltradas
          .map((v) => v.productId)
          .filter((id) => id && !catalogoMap.byId[id])
      )
    ];

    if (missingIds.length === 0) return;

    let cancelado = false;
    const buscarFaltantes = async () => {
      const encontrados = {};
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const r = await fetch(`${API_BASE}/api/products/${id}`);
            if (!r.ok) return;
            const prod = await r.json();
            const itemObj = prod?.product || prod?.item || prod;
            const pUnit = getProductPrice(itemObj);
            if (pUnit > 0) {
              encontrados[id] = pUnit;
            }
          } catch {
            // Ignorar si no existe el endpoint individual
          }
        })
      );

      if (!cancelado && Object.keys(encontrados).length > 0) {
        setCatalogoMap((prev) => ({
          ...prev,
          byId: { ...prev.byId, ...encontrados }
        }));
      }
    };

    buscarFaltantes();
    return () => { cancelado = true; };
  }, [ventasFiltradas, catalogoMap.byId]);

  // 💰 FUNCIÓN QUE CALCULA EL PRECIO EXACTO DE LA CAMISETA
  const obtenerPrecioVenta = (venta) => {
    // 1. Si el usuario lo personalizó con el lápiz, usar ese precio
    if (preciosPersonalizados[venta._id] !== undefined) {
      return Number(preciosPersonalizados[venta._id]);
    }

    const cantidad = Number(venta.totalUnidades) || 1;

    // 2. Búsqueda exacta por ID de MongoDB del producto
    if (venta.productId && catalogoMap.byId[venta.productId]) {
      return catalogoMap.byId[venta.productId] * cantidad;
    }

    // 3. Búsqueda exacta por Nombre + Categoría (ej: "AC Milan Local 06-07 Kaká" + "Niño")
    const baseName = normBaseName(venta.item);
    const catFromLog = extractCatFromItem(venta.item);
    const fullText = normText(venta.item);

    if (catFromLog && catalogoMap.byFullKey[`${baseName}_${catFromLog}`]) {
      return catalogoMap.byFullKey[`${baseName}_${catFromLog}`] * cantidad;
    }

    if (catalogoMap.byFullKey[fullText]) {
      return catalogoMap.byFullKey[fullText] * cantidad;
    }

    // 4. Búsqueda exacta por el nombre limpio de la camiseta
    if (baseName && catalogoMap.byBaseName[baseName]) {
      return catalogoMap.byBaseName[baseName] * cantidad;
    }

    // 5. Si el log de venta ya traía el precio guardado
    if (venta.precioEnLog > 0) {
      return venta.precioEnLog;
    }

    // 6. Respaldo oficial según la tabla de productos de Alegra
    const itemLower = String(venta.item || "").toLowerCase();
    let unitarioFallback = 20000; // Fan y resto por defecto
    if (itemLower.includes("llavero") || itemLower.includes("envio") || itemLower.includes("envío")) {
      unitarioFallback = 2500;
    } else if (
      itemLower.includes("nacional") || 
      itemLower.includes("player") || 
      itemLower.includes("jugador") || 
      itemLower.includes("retro")
    ) {
      unitarioFallback = 22000;
    } else if (
      itemLower.includes("fan") || 
      itemLower.includes("mujer") || 
      itemLower.includes("niño") || 
      itemLower.includes("nino")
    ) {
      unitarioFallback = 20000;
    }

    return unitarioFallback * cantidad;
  };

  // Guardar precio editado con el lápiz en la fila
  const guardarPrecioFila = (ventaId) => {
    const valorNum = Number(tempPrecioFila);
    if (isNaN(valorNum) || valorNum <= 0) {
      toastHOT.error("Ingrese un precio válido mayor a 0.");
      return;
    }
    const nuevosPrecios = { ...preciosPersonalizados, [ventaId]: valorNum };
    setPreciosPersonalizados(nuevosPrecios);
    try {
      localStorage.setItem("chemasport_precios_custom", JSON.stringify(nuevosPrecios));
    } catch (e) {
      console.error(e);
    }
    setEditandoPrecioId(null);
    toastHOT.success("Precio actualizado en la tabla.");
  };

  const ranking = useMemo(() => {
    const conteo = {};
    BASE_USERS.forEach((u) => (conteo[u] = { ventas: 0, unidades: 0 }));
    ventasFiltradas.forEach((v) => {
      const vend = v.vendedor || "Otros";
      if (!conteo[vend]) conteo[vend] = { ventas: 0, unidades: 0 };
      conteo[vend].ventas += 1;
      conteo[vend].unidades += v.totalUnidades;
    });
    return Object.entries(conteo)
      .map(([vendedor, stats]) => ({ vendedor, ventas: stats.ventas, unidades: stats.unidades, totalComision: stats.unidades * comisionPorPrenda }))
      .filter((item) => storedUser?.isSuperUser || item.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades);
  }, [ventasFiltradas, comisionPorPrenda, storedUser?.isSuperUser]);

  const tablaVentas = useMemo(() => {
    if (!searchFilter.trim()) return ventasFiltradas;
    const q = searchFilter.toLowerCase();
    return ventasFiltradas.filter((v) => v.vendedor.toLowerCase().includes(q) || v.cliente.toLowerCase().includes(q) || String(v.item || "").toLowerCase().includes(q));
  }, [ventasFiltradas, searchFilter]);

  const top1 = ranking.at(0) || null;
  const top2 = ranking.at(1) || null;
  const top3 = ranking.at(2) || null;
  const restoRanking = ranking.slice(3);
  const totalPrendasMes = ventasFiltradas.reduce((acc, v) => acc + v.totalUnidades, 0);
  const totalComisionesMes = totalPrendasMes * comisionPorPrenda;

  const ejecutarResetGlobal = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-super": storedUser?.isSuperUser ? "true" : "false" }
      });
      if (!res.ok) throw new Error("Error en el servidor al reiniciar");
      setLogs([]);
      setVentasSeleccionadas([]);
      toastHOT.success("Historial reiniciado. Comisiones puestas en cero.", { style: { background: "#000", color: "#fff", fontWeight: "bold" } });
    } catch (err) {
      toastHOT.error("No se pudo reiniciar el historial.");
    }
  };

  const confirmarResetGlobal = () => {
    toastHOT((t) => (
      <div className="text-center p-2 text-black font-sans">
        <div className="flex justify-center text-red-600 mb-2"><FaExclamationTriangle size={24} /></div>
        <p className="font-black text-sm mb-1 text-red-600 uppercase tracking-widest">¿Reiniciar todo el mes?</p>
        <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
          Esto eliminará <strong>absolutamente todas</strong> las ventas y pondrá a todos los vendedores en cero.<br/><br/>
          <span className="font-bold text-black">Ojo:</span> Esta acción no afecta el stock, solo limpia la tabla de comisiones. No se puede deshacer.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { toastHOT.dismiss(t.id); ejecutarResetGlobal(); }} className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer shadow-md">SÍ, BORRAR TODO</button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-zinc-100 text-zinc-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer">CANCELAR</button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const ejecutarAnulacion = async (venta) => {
    if (!puedeAnularVenta(venta)) {
      toastHOT.error("Solo puedes anular tus propias ventas.");
      return;
    }

    try {
      const payload = { productId: venta.productId || null, item: venta.item, items: venta.items || [], totalUnidades: venta.totalUnidades || 1 };
      let res = await fetch(`${API_BASE}/api/sales/anular/${venta._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-super": storedUser?.isSuperUser ? "true" : "false" }, body: JSON.stringify(payload)
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}/api/products/anular/${venta._id}`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-super": storedUser?.isSuperUser ? "true" : "false" }, body: JSON.stringify(payload)
        });
      }
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData.error || `Error ${res.status} del servidor al anular`);
      setLogs((prev) => prev.filter((l) => l._id !== venta._id));
      setVentasSeleccionadas((prev) => prev.filter((v) => v._id !== venta._id));
      toastHOT.success("Venta anulada. Camisetas devueltas al inventario.", { style: { background: "#000", color: "#fff", fontWeight: "bold" } });
    } catch (err) {
      toastHOT.error(err.message || "No se pudo anular la venta.");
    }
  };

  const confirmarAnulacion = (venta) => {
    if (!puedeAnularVenta(venta)) {
      toastHOT.error(`Solo puedes anular tus propias ventas (esta venta pertenece a ${venta.vendedor}).`);
      return;
    }

    toastHOT((t) => (
      <div className="text-center p-2 text-black font-sans">
        <p className="font-black text-sm mb-1">¿Anular esta venta?</p>
        <p className="text-xs text-zinc-600 mb-3">
          Se sumarán <strong>{venta.totalUnidades} camiseta(s)</strong> ({venta.tallasTexto || "talla vendida"}) al stock y se descontará del vendedor <strong>{venta.vendedor}</strong>.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { toastHOT.dismiss(t.id); ejecutarAnulacion(venta); }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer">Sí, Anular</button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer">Cancelar</button>
        </div>
      </div>
    ), { duration: 6000 });
  };

 // 🖨️ IMPRESIÓN NATIVA ESTILO POS TÉRMICO (CON PRECIO POR PRODUCTO Y TOTAL)
 const imprimirTicketNativo = (ventasArray, consecutivoOficial, totalCobrado, datosCliente = {}) => {
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return alert("Por favor permite las ventanas emergentes.");

  const fechaHoy = new Date().toLocaleString("es-CR");
  const clienteNombre = datosCliente.nombre || ventasArray[0]?.cliente || "Cliente de Contado";
  const vendedorNombre = ventasArray[0]?.vendedor || "Caja";

  const itemsHTML = ventasArray.map((v) => {
    const cant = Number(v.totalUnidades) || 1;
    // Calculamos el subtotal exacto de esa línea (respetando precioUnitarioCustom o el precio de la tabla)
    const subtotalLinea = Number(v.precioUnitarioCustom) > 0
      ? Math.round(Number(v.precioUnitarioCustom) * cant)
      : Math.round(obtenerPrecioVenta(v));

    return `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: 12px; margin-bottom: 6px;">
        <span style="flex: 1; padding-right: 8px;">
          ${cant}x ${v.item} ${v.tallasTexto ? `(Talla: ${v.tallasTexto})` : ''}
        </span>
        <span style="font-weight: bold; white-space: nowrap;">
          ₡${subtotalLinea.toLocaleString("es-CR")}
        </span>
      </div>
    `;
  }).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Tiquete ${consecutivoOficial}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; color: #000; margin: 0; padding: 15px; width: 100%; max-width: 300px; font-size: 12px; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          h1 { font-size: 18px; margin: 0 0 5px 0; text-transform: uppercase; }
          p { margin: 2px 0; }
          .logo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 10px; }
          .logo-img { max-width: 140px; height: auto; object-fit: contain; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="logo-container">
            <img src="${window.location.origin}/logo.png" alt="ChemaSport ER" class="logo-img" onerror="this.style.display='none'" />
          </div>
          <h1>CHEMASPORT ER</h1>
          <p>Ropa y Artículos Deportivos</p>
          <p>Tel: +50660369857</p>
          <p style="font-size: 10px; margin-top: 4px;">50 metros oeste de la bomba Delta, Grecia</p>
          <p style="font-size: 10px;">CJ: 3102916554</p>
          <p style="font-size: 10px; margin-bottom: 5px;">chemasport__er@outlook.com</p>
        </div>
        <div class="divider"></div>
        <p><span class="font-bold">Comprobante N°:</span> ${consecutivoOficial}</p>
        <p><span class="font-bold">Fecha:</span> ${fechaHoy}</p>
        <p><span class="font-bold">Cliente:</span> ${clienteNombre}</p>
        ${datosCliente.cedula ? `<p><span class="font-bold">Cédula:</span> ${datosCliente.cedula}</p>` : ""}
        ${datosCliente.telefono ? `<p><span class="font-bold">Tel:</span> ${datosCliente.telefono}</p>` : ""}
        <p><span class="font-bold">Atendió:</span> ${vendedorNombre}</p>
        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
          <span>CANT. DESCRIPCIÓN</span>
          <span>IMPORTE</span>
        </div>
        ${itemsHTML}
        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 10px;">
          <span>TOTAL:</span>
          <span>₡${Number(totalCobrado).toLocaleString("es-CR")}</span>
        </div>
        <div class="divider"></div>
        <div class="text-center" style="margin-top: 20px;">
          <p>¡Gracias por su compra!</p>
          <p>Conserve este tiquete para reclamos.</p>
        </div>
        <script>
          window.onload = function() { setTimeout(() => { window.print(); }, 300); };
        </script>
      </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

  // 🧾 1. ABRIR EL MODAL UNIFICADO DE FACTURACIÓN CON TICKET INTERNO COMO PRIMERA OPCIÓN POR DEFECTO
  const abrirModalFacturacion = (ventasArray) => {
    const sumaPreciosTabla = ventasArray.reduce((acc, v) => acc + obtenerPrecioVenta(v), 0);
    const clienteInicial = ventasArray[0]?.cliente && ventasArray[0]?.cliente !== "Cliente General" 
      ? ventasArray[0].cliente 
      : "";

    setMostrarListaContactos(false);
    cargarContactosAlegra("");

    setModalFacturar({
      isOpen: true,
      ventas: ventasArray,
      precio: String(sumaPreciosTabla),
      incluyeEnvio: false,
      precioEnvio: "2500",
      tipoEmision: "interno", // Siempre inicia en Ticket Normal (Uso Interno) como primera opción
      tipoIdentificacion: "01",
      cedula: "",
      nombre: clienteInicial,
      telefono: "",
      correo: ""
    });
  };

  // 🔍 BUSCAR CÉDULA EN ALEGRA / HACIENDA (DENTRO DEL MODAL UNIFICADO)
  const buscarCedulaHacienda = async () => {
    if (!modalFacturar.cedula.trim()) {
      toastHOT.error("Ingrese una cédula para buscar.");
      return;
    }
    const toastId = toastHOT.loading("Consultando cliente...");
    try {
      const res = await fetch(`${API_BASE}/api/alegra/consultar-cedula/${modalFacturar.cedula.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se encontró el cliente");
      setModalFacturar((prev) => ({
        ...prev,
        nombre: data.nombre || prev.nombre,
        tipoIdentificacion: data.tipoIdentificacion || prev.tipoIdentificacion,
        telefono: data.telefono || prev.telefono,
        correo: data.correo || prev.correo
      }));
      toastHOT.success(data.enAlegra ? "¡Cliente cargado desde Alegra!" : "¡Cliente encontrado en Hacienda!", { id: toastId });
    } catch (error) {
      toastHOT.error(error.message, { id: toastId });
    }
  };

  // 🚀 VALIDAR Y EMITIR DESDE EL MODAL UNIFICADO (CON TODOS LOS DATOS OBLIGATORIOS EN AMBOS TIPOS)
  const confirmarYEmitirFactura = () => {
    const precioPrendas = Number(modalFacturar.precio);
    if (isNaN(precioPrendas) || precioPrendas <= 0) {
      toastHOT.error("El monto de los productos debe ser un número mayor a 0.");
      return;
    }

    const llevaEnvio = Boolean(modalFacturar.incluyeEnvio);
    const montoEnvio = llevaEnvio ? Number(modalFacturar.precioEnvio) : 0;

    if (llevaEnvio && (isNaN(montoEnvio) || montoEnvio <= 0)) {
      toastHOT.error("El monto del envío debe ser un número mayor a 0.");
      return;
    }

    // 🔥 TODOS LOS DATOS SON OBLIGATORIOS TANTO EN HACIENDA COMO EN TICKET NORMAL (NO ELECTRÓNICO)
    if (
      !modalFacturar.tipoIdentificacion ||
      !modalFacturar.cedula.trim() ||
      !modalFacturar.nombre.trim() ||
      !modalFacturar.telefono.trim() ||
      !modalFacturar.correo.trim()
    ) {
      toastHOT.error("Todos los datos del cliente (Tipo ID, Cédula, Nombre, Teléfono y Correo) son obligatorios.");
      return;
    }

    // Si el usuario editó el precio de una sola venta en el modal, sincronizar el precio de la prenda con la tabla
    if (modalFacturar.ventas.length === 1) {
      const unicaVentaId = modalFacturar.ventas[0]._id;
      const nuevosPrecios = { ...preciosPersonalizados, [unicaVentaId]: precioPrendas };
      setPreciosPersonalizados(nuevosPrecios);
      try {
        localStorage.setItem("chemasport_precios_custom", JSON.stringify(nuevosPrecios));
      } catch (e) {
        console.error(e);
      }
    }

    // Calculamos el factor de ajuste sobre las prendas por si el usuario modificó el monto en el modal
    const sumaOriginalPrendas = modalFacturar.ventas.reduce((acc, v) => acc + obtenerPrecioVenta(v), 0);
    const factorPrendas = sumaOriginalPrendas > 0 ? (precioPrendas / sumaOriginalPrendas) : 1;

    // Preparamos cada venta con su precio unitario exacto para que el backend no mezcle el precio del envío con las camisas
    const ventasParaEmitir = modalFacturar.ventas.map((v) => {
      const cant = Number(v.totalUnidades) || 1;
      const totalFilaAjustado = obtenerPrecioVenta(v) * factorPrendas;
      return {
        ...v,
        precioUnitarioCustom: Number((totalFilaAjustado / cant).toFixed(5))
      };
    });

    // 🚚 Si marcó el checkbox de Envío, agregamos la línea de "Envio GAM" con su precio personalizado
    if (llevaEnvio && montoEnvio > 0) {
      ventasParaEmitir.push({
        _id: `envio_${Date.now()}`,
        item: "Envio GAM",
        totalUnidades: 1,
        tallasTexto: "",
        cliente: modalFacturar.ventas[0]?.cliente || "Cliente General",
        vendedor: modalFacturar.ventas[0]?.vendedor || "Caja",
        precioUnitarioCustom: montoEnvio,
        items: []
      });
    }

    const totalCobrarFinal = precioPrendas + montoEnvio;
    const nombreFinal = modalFacturar.nombre.trim();
    const cedulaFinal = modalFacturar.cedula.trim();
    const correoFinal = modalFacturar.correo.trim();
    const telefonoFinal = modalFacturar.telefono.trim();
    const tipoIdFinal = modalFacturar.tipoIdentificacion;
    // Si es usuario normal siempre emite "interno"
    const tipoEmisionFinal = esSuperAdmin ? modalFacturar.tipoEmision : "interno";

    setModalFacturar((prev) => ({ ...prev, isOpen: false }));

    ejecutarEmisionTiqueteConDatos(
      ventasParaEmitir,
      tipoEmisionFinal,
      totalCobrarFinal,
      cedulaFinal,
      nombreFinal,
      correoFinal,
      tipoIdFinal,
      telefonoFinal
    );
  };

  // 🚀 FUNCIÓN UNIFICADA DE EMISIÓN CON BACKEND
  const ejecutarEmisionTiqueteConDatos = async (
    ventasArray, tipoEmision, precioManual, cedula, nombreCliente, email, tipoIdentificacion, telefono = ""
  ) => {
    if (generandoTiquete) return;
    setGenerandoTiquete(true);
    const toastId = toastHOT.loading(`Emitiendo comprobante en Alegra...`);

    try {
      const response = await fetch(`${API_BASE}/api/alegra/emitir-tiquete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-super": storedUser?.isSuperUser ? "true" : "false" },
        body: JSON.stringify({ 
          ventas: ventasArray, 
          tipo: tipoEmision, 
          precioManual, 
          cedula, 
          nombreCliente, 
          email, 
          telefono,
          tipoIdentificacion 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo emitir el comprobante");

      toastHOT.success("¡Comprobante emitido con éxito!", { id: toastId });
      setVentasSeleccionadas([]); 
      imprimirTicketNativo(ventasArray, data.consecutivoOficial, data.totalCobrado, {
        nombre: nombreCliente,
        cedula,
        telefono
      });

    } catch (error) {
      toastHOT.error(`Error: ${error.message}`, { id: toastId, duration: 6000 });
    } finally {
      setGenerandoTiquete(false);
    }
  };

  const toggleSeleccionVenta = (venta) => {
    setVentasSeleccionadas((prev) => {
      const existe = prev.find((v) => v._id === venta._id);
      if (existe) return prev.filter((v) => v._id !== venta._id);
      return [...prev, venta];
    });
  };

  const generarPDFBlancoYNegro = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor permite las ventanas emergentes para generar el PDF.");

    const fechaHoy = new Date().toLocaleDateString("es-CR");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Comisiones - ${selectedMonth} Chema Sport ER</title>
          <style>
            @page { size: letter; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000; background: #fff; margin: 0; padding: 0; font-size: 11px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 11px; color: #444; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
            .meta { text-align: right; font-size: 10px; color: #333; }
            
            .summary-box { display: flex; border: 1px solid #000; margin-bottom: 25px; }
            .summary-item { flex: 1; padding: 10px 15px; border-right: 1px solid #000; }
            .summary-item:last-child { border-right: none; }
            .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
            .summary-value { font-size: 18px; font-weight: 900; margin-top: 4px; }

            .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-top: 25px; margin-bottom: 10px; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #000; padding: 6px 4px; }
            td { padding: 6px 4px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }
            tr:last-child td { border-bottom: 1px solid #000; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 800; }

            .footer { margin-top: 35px; border-top: 1px solid #000; padding-top: 8px; font-size: 9px; text-align: center; text-transform: uppercase; letter-spacing: 1px; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">CHEMA SPORT ER</h1>
              <p class="subtitle">Liquidación de Ventas y Comisiones</p>
            </div>
            <div class="meta">
              <p><strong>Mes:</strong> ${selectedMonth}</p>
              <p><strong>Fecha de Emisión:</strong> ${fechaHoy}</p>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Prendas Vendidas</div>
              <div class="summary-value">${totalPrendasMes} uds.</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Comisiones</div>
              <div class="summary-value">₡${totalComisionesMes.toLocaleString("es-CR")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Tarifa por Prenda</div>
              <div class="summary-value">₡${comisionPorPrenda.toLocaleString("es-CR")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Líder del Mes</div>
              <div class="summary-value">${top1?.vendedor || "N/A"} (${top1?.unidades || 0})</div>
            </div>
          </div>

          <div class="section-title">1. Resumen por Vendedor</div>
          <table>
            <thead>
              <tr>
                <th style="width: 10%;">Pos.</th>
                <th style="width: 45%;">Vendedor</th>
                <th class="text-right" style="width: 20%;">Prendas</th>
                <th class="text-right" style="width: 25%;">Total Comisión</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((r, i) => `
                <tr>
                  <td class="font-bold">${i + 1}º</td>
                  <td class="font-bold">${r.vendedor}</td>
                  <td class="text-right">${r.unidades}</td>
                  <td class="text-right font-bold">₡${r.totalComision.toLocaleString("es-CR")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">2. Registro Detallado de Ventas</div>
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Fecha</th>
                <th style="width: 16%;">Vendedor</th>
                <th style="width: 22%;">Cliente</th>
                <th style="width: 15%;">Precio</th>
                <th style="width: 25%;">Artículo / Tallas</th>
                <th class="text-right" style="width: 10%;">Cant.</th>
              </tr>
            </thead>
            <tbody>
              ${ventasFiltradas.map((v) => {
                const d = v.date ? new Date(v.date) : null;
                const fStr = d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` : "-";
                const precioFila = obtenerPrecioVenta(v);
                return `
                  <tr>
                    <td>${fStr}</td>
                    <td class="font-bold">${v.vendedor}</td>
                    <td>${v.cliente}</td>
                    <td class="font-bold">₡${precioFila.toLocaleString("es-CR")}</td>
                    <td>${v.item}${v.tallasTexto ? ` (${v.tallasTexto})` : ""}</td>
                    <td class="text-right font-bold">${v.totalUnidades}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div class="footer">
            Chema Sport ER — Documento Oficial de Rendición de Cuentas
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-white pt-36 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black relative">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 bg-black border border-gray-600 text-zinc-300 hover:text-white hover:bg-zinc-800 px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-sm cursor-pointer transition-all mb-8">
          <FaChevronLeft size={12} /> Volver al catálogo
        </button>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest mb-3 shadow-sm">
              <FaTrophy size={11} className="text-amber-400" />
              <span>TABLERO DE COMISIONES</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">Ranking de Vendedores</h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">Registro de ventas y comisiones acumuladas del mes.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {esSuperAdmin && (
              <button onClick={generarPDFBlancoYNegro} className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-sm transition-all cursor-pointer">
                <FaFilePdf size={14} />
                <span className="hidden sm:inline">Reporte</span>
              </button>
            )}
            
            {esSuperAdmin && (
              <button onClick={confirmarResetGlobal} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-sm transition-all cursor-pointer border border-red-200">
                <FaTrash size={14} />
                <span className="hidden sm:inline">Reiniciar</span>
              </button>
            )}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-2xl">
              <FaCalendarAlt className="text-zinc-400" />
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-sm font-black text-black outline-none cursor-pointer" />
            </div>
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border ${esSuperAdmin ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-100 border-zinc-200 opacity-80'}`}>
              {!esSuperAdmin ? <FaLock className="text-zinc-400" size={10} title="Solo administradores" /> : <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">₡/Prenda:</span>}
              <input type="number" min="0" step="100" value={comisionPorPrenda} onChange={(e) => setComisionPorPrenda(Number(e.target.value) || 0)} disabled={!esSuperAdmin} className={`w-20 bg-transparent text-sm font-black text-black outline-none ${!esSuperAdmin ? 'cursor-not-allowed text-zinc-500 select-none' : ''}`} />
            </div>
          </div>
        </div>

        {/* Podio Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-end">
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-2 md:order-1">
            <div className="w-12 h-12 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xl font-black mb-3 shadow-inner">🥈</div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">2º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">{top2?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <p className="text-3xl font-black text-black leading-none">{top2?.unidades || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Prendas vendidas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">₡{(top2?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>
          <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-3xl p-7 border-2 border-amber-400 shadow-xl flex flex-col items-center text-center relative order-1 md:order-2 -mt-4 md:-mt-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-black flex items-center justify-center text-3xl font-black mb-3 shadow-md">🥇</div>
            <span className="text-xs font-black tracking-widest text-amber-600 uppercase flex items-center gap-1">★ LÍDER EN VENTAS ★</span>
            <h3 className="text-2xl sm:text-3xl font-black text-black mt-1 truncate max-w-full">{top1?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-amber-50/60 rounded-2xl p-4 border border-amber-200">
              <p className="text-4xl font-black text-black leading-none">{top1?.unidades || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Prendas vendidas</p>
              <p className="text-lg font-black text-emerald-600 mt-2">₡{(top1?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-3">
            <div className="w-12 h-12 rounded-full bg-amber-700/20 text-amber-800 flex items-center justify-center text-xl font-black mb-3 shadow-inner">🥉</div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">3º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">{top3?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <p className="text-3xl font-black text-black leading-none">{top3?.unidades || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Prendas vendidas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">₡{(top3?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>
        </div>

        {restoRanking.length > 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 ml-1">Posiciones Generales</h3>
            <div className="divide-y divide-zinc-100">
              {restoRanking.map((item, idx) => (
                <div key={item.vendedor} className="py-3.5 flex items-center justify-between hover:bg-zinc-50 px-3 rounded-xl transition-colors">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-zinc-100 font-black text-xs text-zinc-700 flex items-center justify-center">{idx + 4}</span>
                    <span className="font-black text-sm text-black truncate">{item.vendedor}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 sm:gap-6 text-right shrink-0 ml-2">
                    <div className="w-20 sm:w-24">
                      <span className="font-black text-base text-black">{item.unidades}</span>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase ml-1">prendas</span>
                    </div>
                    <span className="font-black text-sm text-emerald-600 w-20 sm:w-24 text-right">₡{item.totalComision.toLocaleString("es-CR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de ventas detalladas */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">Detalle de Ventas del Periodo</h2>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {ventasSeleccionadas.length > 0 && (
                <button onClick={() => abrirModalFacturacion(ventasSeleccionadas)} disabled={generandoTiquete} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap">
                  <FaReceipt size={14} /> Emitir {ventasSeleccionadas.length} en 1 Tiquete
                </button>
              )}
              <div className="relative w-full sm:w-64">
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Buscar por cliente..." className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black" />
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-center py-12 text-zinc-400 font-bold text-xs uppercase tracking-widest">Cargando...</p>
          ) : tablaVentas.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-wider">No hay ventas registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 uppercase tracking-wider font-black text-[10px]">
                    <th className="py-3 px-3 text-center">Sel.</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Vendedor</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Precio</th>
                    <th className="py-3 px-3">Artículo / Tallas</th>
                    <th className="py-3 px-3 text-right">Cant.</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {tablaVentas.map((venta) => {
                    const dateObj = venta.date ? new Date(venta.date) : null;
                    const isSelected = ventasSeleccionadas.some(v => v._id === venta._id);
                    const precioActual = obtenerPrecioVenta(venta);
                    const estaEditando = editandoPrecioId === venta._id;
                    const permitidoAnular = puedeAnularVenta(venta);

                    return (
                      <tr key={venta._id} className={`hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}>
                        <td className="py-3.5 px-3 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSeleccionVenta(venta)} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-black" />
                        </td>
                        <td className="py-3.5 px-3 text-zinc-500 whitespace-nowrap">{dateObj ? `${pad2(dateObj.getDate())}/${pad2(dateObj.getMonth() + 1)}` : ""}</td>
                        <td className="py-3.5 px-3 font-black text-black">{venta.vendedor}</td>
                        <td className="py-3.5 px-3 font-bold text-zinc-800">{venta.cliente}</td>
                        
                        {/* 🔥 COLUMNA DE PRECIO CONECTADA AL CATÁLOGO + LÁPIZ */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {estaEditando ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative">
                                <span className="absolute left-2 top-1 -translate-y-1/2 text-zinc-400 font-black text-[10px]">₡</span>
                                <input
                                  type="number"
                                  value={tempPrecioFila}
                                  onChange={(e) => setTempPrecioFila(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") guardarPrecioFila(venta._id);
                                    if (e.key === "Escape") setEditandoPrecioId(null);
                                  }}
                                  autoFocus
                                  className="w-24 pl-5 pr-2 py-1 bg-white border border-black rounded-lg text-xs font-black text-black outline-none"
                                />
                              </div>
                              <button
                                onClick={() => guardarPrecioFila(venta._id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                                title="Guardar precio"
                              >
                                <FaCheck size={10} />
                              </button>
                              <button
                                onClick={() => setEditandoPrecioId(null)}
                                className="p-1.5 bg-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-300 transition-colors cursor-pointer"
                                title="Cancelar"
                              >
                                <FaTimes size={10} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-black text-emerald-700 text-xs">
                                ₡{precioActual.toLocaleString("es-CR")}
                              </span>
                              <button
                                onClick={() => {
                                  setEditandoPrecioId(venta._id);
                                  setTempPrecioFila(String(precioActual));
                                }}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
                                title="Personalizar precio"
                              >
                                <FaEdit size={12} />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-zinc-700">
                          <span className="font-bold text-black block">{venta.item}</span>
                          {venta.tallasTexto && <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold">Tallas: {venta.tallasTexto}</span>}
                        </td>
                        <td className="py-3.5 px-3 font-black text-right text-sm text-black">{venta.totalUnidades}</td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex justify-center items-center gap-3">
                            <button onClick={() => abrirModalFacturacion([venta])} disabled={generandoTiquete} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer" title="Emitir Tiquete / Factura">
                              <FaReceipt size={14} />
                            </button>
                            {permitidoAnular ? (
                              <button onClick={() => confirmarAnulacion(venta)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer" title="Anular Venta">
                                <FaTrash size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toastHOT.error(`Solo puedes anular tus propias ventas (esta venta es de ${venta.vendedor}).`)}
                                className="p-2 text-zinc-200 cursor-not-allowed rounded-xl"
                                title={`Solo ${venta.vendedor} o un Super Admin pueden anular esta venta`}
                              >
                                <FaTrash size={13} />
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
          )}
        </div>
      </div>

      {/* 🔥 MODAL UNIFICADO DE FACTURACIÓN */}
      {modalFacturar.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-fade-in-up my-8">
            <h3 className="text-lg font-black text-center text-zinc-900 uppercase tracking-widest mb-1">
              Emitir Comprobante
            </h3>
            <p className="text-xs text-center text-zinc-500 mb-6 font-medium">
              {modalFacturar.ventas.length === 1 
                ? `${modalFacturar.ventas[0].totalUnidades}x ${modalFacturar.ventas[0].item}`
                : `${modalFacturar.ventas.length} ventas seleccionadas`}
            </p>
            
            <div className="flex flex-col gap-4 mb-6">
              {/* 1. MONTO DE LAS PRENDAS EDITABLE (Trae por defecto el de la tabla) */}
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Monto de Productos *</label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-3 -translate-y-1/2 text-zinc-400 font-black text-base">₡</span>
                  <input 
                    type="number" 
                    value={modalFacturar.precio} 
                    onChange={(e) => setModalFacturar({ ...modalFacturar, precio: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-base font-black text-emerald-700 outline-none focus:border-black" 
                  />
                </div>
              </div>

              {/* 🚚 CHECKBOX DE ENVÍO + MONTO DE ENVÍO PERSONALIZABLE */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 transition-all">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={modalFacturar.incluyeEnvio}
                      onChange={(e) => setModalFacturar({ ...modalFacturar, incluyeEnvio: e.target.checked })}
                      className="w-4 h-4 rounded accent-black cursor-pointer"
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                      <FaTruck className="text-zinc-500" size={13} /> Agregar Envío
                    </span>
                  </div>
                  {modalFacturar.incluyeEnvio && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      + ₡{(Number(modalFacturar.precioEnvio) || 0).toLocaleString("es-CR")}
                    </span>
                  )}
                </label>

                {modalFacturar.incluyeEnvio && (
                  <div className="mt-3 pt-3 border-t border-zinc-200/80">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Costo del Envío (Personalizable) *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3.5 top-2 -translate-y-1/2 text-zinc-400 font-black text-sm">₡</span>
                      <input
                        type="number"
                        value={modalFacturar.precioEnvio}
                        onChange={(e) => setModalFacturar({ ...modalFacturar, precioEnvio: e.target.value })}
                        placeholder="2500"
                        className="w-full pl-8 pr-4 py-2 bg-white border border-zinc-300 rounded-xl text-sm font-black text-black outline-none focus:border-black"
                      />
                    </div>
                  </div>
                )}

                {/* Resumen del Total Final si lleva envío */}
                {modalFacturar.incluyeEnvio && (
                  <div className="mt-2.5 flex items-center justify-between text-xs font-black text-zinc-900 pt-1">
                    <span>TOTAL A FACTURAR:</span>
                    <span className="text-sm text-emerald-700">
                      ₡{((Number(modalFacturar.precio) || 0) + (Number(modalFacturar.precioEnvio) || 0)).toLocaleString("es-CR")}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. SELECTOR DE TIPO DE COMPROBANTE (Ticket Normal primero por defecto; usuario normal solo tiene Ticket Normal) */}
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Tipo de Comprobante *</label>
                <select 
                  value={modalFacturar.tipoEmision} 
                  onChange={(e) => setModalFacturar({ ...modalFacturar, tipoEmision: e.target.value })}
                  disabled={!esSuperAdmin}
                  className={`w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-black outline-none focus:border-black ${!esSuperAdmin ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <option value="interno">Ticket Normal (Uso Interno)</option>
                  {esSuperAdmin && (
                    <option value="hacienda">Tiquete Electrónico (Hacienda)</option>
                  )}
                </select>
              </div>

              {/* ⭐ SELECTOR DESPLEGABLE DE CLIENTES FAVORITOS / GUARDADOS EN ALEGRA */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMostrarListaContactos((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-300 rounded-xl text-xs font-black text-zinc-900 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FaStar className="text-amber-500" size={13} />
                    <span>Clientes Favoritos / Alegra ({contactosAlegra.length})</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold">
                    {mostrarListaContactos ? "Cerrar ▲" : "Elegir ▼"}
                  </span>
                </button>

                {mostrarListaContactos && (
                  <div className="mt-1.5 max-h-48 overflow-y-auto bg-white border-2 border-zinc-900 rounded-2xl shadow-xl divide-y divide-zinc-100 z-30">
                    {contactosOrdenadosYFiltrados.length === 0 ? (
                      <p className="p-3 text-center text-[11px] text-zinc-400 font-bold">
                        No se encontraron contactos guardados en Alegra.
                      </p>
                    ) : (
                      contactosOrdenadosYFiltrados.map((c) => {
                        const esFav = favoritosIds.includes(String(c.id));
                        return (
                          <div
                            key={c.id}
                            onClick={() => seleccionarContactoAlegra(c)}
                            className="flex items-center justify-between px-3 py-2.5 hover:bg-emerald-50/70 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs font-black text-black truncate flex items-center gap-1.5">
                                <FaUserCheck className="text-emerald-600 shrink-0" size={11} />
                                <span className="truncate">{c.nombre}</span>
                              </p>
                              <p className="text-[10px] text-zinc-500 font-mono truncate">
                                {c.cedula ? `ID: ${c.cedula}` : "Sin ID"} {c.telefono ? `· Tel: ${c.telefono}` : ""} {c.email ? `· ${c.email}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => toggleFavoritoContacto(c.id, e)}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
                              title={esFav ? "Quitar de favoritos" : "Fijar en favoritos"}
                            >
                              <FaStar size={13} className={esFav ? "text-amber-400" : "text-zinc-300"} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. TIPO DE IDENTIFICACIÓN Y CÉDULA */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">
                    Tipo ID *
                  </label>
                  <select 
                    value={modalFacturar.tipoIdentificacion} 
                    onChange={(e) => setModalFacturar({ ...modalFacturar, tipoIdentificacion: e.target.value })}
                    className="w-full mt-1 px-2.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold outline-none focus:border-black"
                  >
                    <option value="01">Física</option>
                    <option value="02">Jurídica</option>
                    <option value="03">DIMEX</option>
                    <option value="04">NITE</option>
                    <option value="05">Extranjero</option>
                    <option value="06">No Contrib.</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">
                    Número de Cédula *
                  </label>
                  <div className="flex gap-1.5 mt-1">
                    <input 
                      type="text" 
                      value={modalFacturar.cedula} 
                      onChange={(e) => setModalFacturar({ ...modalFacturar, cedula: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") buscarCedulaHacienda(); }}
                      placeholder="Ej. 101110222"
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs outline-none focus:border-black" 
                    />
                    <button 
                      type="button"
                      onClick={buscarCedulaHacienda} 
                      className="bg-zinc-800 text-white px-3.5 rounded-xl hover:bg-black transition-colors flex items-center justify-center cursor-pointer shadow-sm" 
                      title="Buscar en Alegra / Hacienda"
                    >
                      <FaSearch size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. NOMBRE DEL CLIENTE */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">
                  Nombre del Cliente *
                </label>
                <input 
                  type="text" 
                  value={modalFacturar.nombre} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setModalFacturar({ ...modalFacturar, nombre: val });
                    if (val.trim().length >= 2) {
                      setMostrarListaContactos(true);
                    }
                  }}
                  placeholder="Automático al buscar o escriba..." 
                  className="w-full mt-1 px-3 py-2.5 border border-zinc-300 rounded-xl text-xs outline-none focus:border-black bg-white font-bold text-zinc-800" 
                />
              </div>

              {/* 5. TELÉFONO Y CORREO ELECTRÓNICO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Teléfono *</label>
                  <input 
                    type="tel" 
                    value={modalFacturar.telefono} 
                    onChange={(e) => setModalFacturar({ ...modalFacturar, telefono: e.target.value })}
                    placeholder="Ej. 8888-8888" 
                    className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs outline-none focus:border-black" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Correo *</label>
                  <input 
                    type="email" 
                    value={modalFacturar.correo} 
                    onChange={(e) => setModalFacturar({ ...modalFacturar, correo: e.target.value })}
                    placeholder="cliente@correo.com" 
                    className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs outline-none focus:border-black" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setModalFacturar({ ...modalFacturar, isOpen: false })} 
                className="flex-1 bg-zinc-100 text-zinc-600 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-zinc-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarYEmitirFactura} 
                disabled={generandoTiquete}
                className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs hover:bg-emerald-700 shadow-md cursor-pointer transition-colors"
              >
                Emitir Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}