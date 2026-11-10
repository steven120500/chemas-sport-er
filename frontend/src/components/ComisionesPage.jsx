import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaChevronRight, FaTrophy, FaCalendarAlt, FaSearch, 
  FaFilePdf, FaTrash, FaLock, FaExclamationTriangle, FaReceipt,
  FaEdit, FaCheck, FaTimes, FaTruck, FaStar, FaUserCheck
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";
import ModalShell from "./ModalShell";

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

// Genera los números de página del paginado
function buildPages(page, pages) {
  const pageNumbers = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      pageNumbers.push(i);
    }
  }
  return pageNumbers;
}

// 🔥 LISTA DE VENDEDORES BASE (Sin Ema, Johan ni Melissa) 🔥
const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Johanna", "Jose", "JuanPa", "Stef", "Ashly"];
const EXCLUDED_USERS = new Set(["ema", "johan", "melissa"]);

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

  // 🔥 DETECTAR SI LA VENTA INCLUYE DORSAL IMPRESO 🔥
  let dorsalTexto = "";
  const matchDorsal = detailsStr.match(/Dorsal Impreso:\s*([^|]+)/i);
  if (matchDorsal && matchDorsal[1]) {
    dorsalTexto = matchDorsal[1].trim();
  } else if (log?.dorsalRefundData?.name || log?.dorsalRefundData?.number) {
    dorsalTexto = `${log.dorsalRefundData.name || ""} #${log.dorsalRefundData.number || ""}`.trim();
  }

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
    dorsalTexto,
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
  const [comisionContrapedido, setComisionContrapedido] = useState(400); 
  const [generandoTiquete, setGenerandoTiquete] = useState(false);
  const [ventasSeleccionadas, setVentasSeleccionadas] = useState([]);

  // 📄 Estados para el paginado de la tabla
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // ✏️ Contrapedido por vendedor persistente por mes
  const [contrapedidosMes, setContrapedidosMes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chemasport_contrapedidos_mes") || "{}");
    } catch {
      return {};
    }
  });

  // Estado para controlar qué bloque de contrapedido se está editando
  const [editandoContrapVendedor, setEditandoContrapVendedor] = useState(null);
  const [tempContrapValor, setTempContrapValor] = useState("");

  // ✏️ Estados para Precios Personalizados en la Tabla
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

  // 🔥 MODAL UNIFICADO DE FACTURACIÓN
  const [modalFacturar, setModalFacturar] = useState({
    isOpen: false,
    ventas: [],
    precio: "",
    incluyeEnvio: false,
    precioEnvio: "2500",
    tipoEmision: "interno",
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

  // 🔑 AQUÍ PUEDES AGREGAR EL NOMBRE EXACTO DEL USUARIO AUTORIZADO ADEMÁS DEL SUPER ADMIN
  const puedeEditarContrapedidos = useMemo(() => {
    if (esSuperAdmin) return true;
    const usuarioAutorizadoExtra = "Johanna"; // Cambia esto por el nombre real del usuario
    return normText(nombreUsuarioActual) === normText(usuarioAutorizadoExtra);
  }, [esSuperAdmin, nombreUsuarioActual]);

  const puedeAnularVenta = (venta) => {
    if (esSuperAdmin) return true;
    if (!nombreUsuarioActual || !venta?.vendedor) return false;
    return normText(venta.vendedor) === normText(nombreUsuarioActual);
  };

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

  // 🔥 CARGA TODAS LAS PÁGINAS DEL HISTORIAL DEL MES
  const fetchVentas = async () => {
    setLoading(true);
    setVentasSeleccionadas([]); 
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "history";
      let pageN = 1;
      const pageSize = 3000;
      const acumulados = [];
      const vistos = new Set();

      while (true) {
        const params = new URLSearchParams({
          page: String(pageN),
          limit: String(pageSize),
          month: selectedMonth,
          _: String(Date.now())
        });
        const res = await fetch(`${API_BASE}/api/history?` + params.toString(), {
          headers: {
            "Content-Type": "application/json",
            "x-super": "true",
            "x-roles": roles
          },
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

        let nuevosEnEstaPagina = 0;
        items.forEach((it) => {
          const idKey = String(it?._id || it?.id || `${it?.date}_${it?.item}_${it?.details}`);
          if (!vistos.has(idKey)) {
            vistos.add(idKey);
            acumulados.push(it);
            nuevosEnEstaPagina += 1;
          }
        });

        if (
          !data?.total ||
          acumulados.length >= data.total ||
          items.length === 0 ||
          nuevosEnEstaPagina === 0 ||
          pageN >= 5
        ) {
          break;
        }
        pageN += 1;
      }

      setLogs(acumulados);
    } catch (err) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchVentas();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  const ventasFiltradas = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const procesadas = logs.map((log) => {
      const parsed = parseSaleDetails(log);
      const actionStr = String(log?.action || "").toLowerCase();
      const detailsStr = String(log?.details || "").toLowerCase();
      const esVenta = actionStr.includes("vend") || (parsed.totalUnidades > 0 && !actionStr.includes("ajust") && !actionStr.includes("actualiz") && !detailsStr.includes("ajuste"));
      return { ...log, ...parsed, esVenta };
    }).filter((v) => v.esVenta && v.totalUnidades > 0);

    return procesadas.sort((a, b) => {
      const tA = a.date ? new Date(a.date).getTime() : 0;
      const tB = b.date ? new Date(b.date).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return String(b._id || "").localeCompare(String(a._id || ""));
    });
  }, [logs]);

  // Guardar el número exacto digitado en el input de contrapedido (Permitido para el usuario autorizado)
  const guardarContrapedidoDirecto = (vendedor) => {
    if (!puedeEditarContrapedidos) {
      toastHOT.error("No tienes permisos para modificar los contrapedidos.");
      return;
    }
    const num = Math.max(0, Number(tempContrapValor) || 0);
    setContrapedidosMes((prev) => {
      const mesActualObj = prev[selectedMonth] || {};
      const actualizado = {
        ...prev,
        [selectedMonth]: {
          ...mesActualObj,
          [vendedor]: num
        }
      };
      try {
        localStorage.setItem("chemasport_contrapedidos_mes", JSON.stringify(actualizado));
      } catch (e) {
        console.error(e);
      }
      return actualizado;
    });
    setEditandoContrapVendedor(null);
    setTempContrapValor("");
    toastHOT.success("Contrapedido actualizado.");
  };

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
          } catch {}
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

  const obtenerPrecioVenta = (venta) => {
    if (preciosPersonalizados[venta._id] !== undefined) {
      return Number(preciosPersonalizados[venta._id]);
    }

    const cantidad = Number(venta.totalUnidades) || 1;

    if (venta.productId && catalogoMap.byId[venta.productId]) {
      return catalogoMap.byId[venta.productId] * cantidad;
    }

    const baseName = normBaseName(venta.item);
    const catFromLog = extractCatFromItem(venta.item);
    const fullText = normText(venta.item);

    if (catFromLog && catalogoMap.byFullKey[`${baseName}_${catFromLog}`]) {
      return catalogoMap.byFullKey[`${baseName}_${catFromLog}`] * cantidad;
    }

    if (catalogoMap.byFullKey[fullText]) {
      return catalogoMap.byFullKey[fullText] * cantidad;
    }

    if (baseName && catalogoMap.byBaseName[baseName]) {
      return catalogoMap.byBaseName[baseName] * cantidad;
    }

    if (venta.precioEnLog > 0) {
      return venta.precioEnLog;
    }

    const itemLower = String(venta.item || "").toLowerCase();
    let unitarioFallback = 20000;
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
      if (EXCLUDED_USERS.has(normText(vend))) return;
      if (!conteo[vend]) conteo[vend] = { ventas: 0, unidades: 0 };
      conteo[vend].ventas += 1;
      conteo[vend].unidades += v.totalUnidades;
    });

    const mesContrapedidos = contrapedidosMes[selectedMonth] || {};

    return Object.entries(conteo)
      .filter(([vendedor]) => !EXCLUDED_USERS.has(normText(vendedor)))
      .map(([vendedor, stats]) => {
        const contrapedidoUds = Number(mesContrapedidos[vendedor]) || 0;
        const stockUds = stats.unidades;
        const totalUdsCombinadas = stockUds + contrapedidoUds;
        
        // Comisión total: Stock * 800 + Contrapedido * 400
        const totalComision = (stockUds * comisionPorPrenda) + (contrapedidoUds * comisionContrapedido);

        return {
          vendedor,
          ventas: stats.ventas,
          unidades: stockUds,
          contrapedidoUds,
          totalUdsCombinadas,
          totalComision
        };
      })
      .filter((item) => storedUser?.isSuperUser || item.totalUdsCombinadas > 0)
      .sort((a, b) => b.totalUdsCombinadas - a.totalUdsCombinadas);
  }, [ventasFiltradas, comisionPorPrenda, comisionContrapedido, contrapedidosMes, selectedMonth, storedUser?.isSuperUser]);

  const tablaVentas = useMemo(() => {
    if (!searchFilter.trim()) return ventasFiltradas;
    const q = searchFilter.toLowerCase();
    return ventasFiltradas.filter((v) => v.vendedor.toLowerCase().includes(q) || v.cliente.toLowerCase().includes(q) || String(v.item || "").toLowerCase().includes(q) || String(v.dorsalTexto || "").toLowerCase().includes(q));
  }, [ventasFiltradas, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(tablaVentas.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const tablaVentasPaginadas = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return tablaVentas.slice(start, start + itemsPerPage);
  }, [tablaVentas, safeCurrentPage, itemsPerPage]);

  const top1 = ranking.at(0) || null;
  const top2 = ranking.at(1) || null;
  const top3 = ranking.at(2) || null;
  const restoRanking = ranking.slice(3);
  
  const totalPrendasStockMes = ventasFiltradas.reduce((acc, v) => acc + v.totalUnidades, 0);
  const totalPrendasContrapedidoMes = Object.entries(contrapedidosMes[selectedMonth] || {})
    .filter(([vend]) => !EXCLUDED_USERS.has(normText(vend)))
    .reduce((a, [, b]) => a + Number(b), 0);
  const totalPrendasMes = totalPrendasStockMes + totalPrendasContrapedidoMes;
  const totalComisionesMes = ranking.reduce((acc, r) => acc + r.totalComision, 0);

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

  const imprimirTicketNativo = (ventasArray, consecutivoOficial, totalCobrado, datosCliente = {}) => {
    const printWindow = window.open("", "_blank", "width=400,height=650");
    if (!printWindow) return alert("Por favor permite las ventanas emergentes.");

    const fechaHoy = datosCliente.fechaHora || new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" });
    const clienteNombre = datosCliente.nombre || ventasArray[0]?.cliente || "Cliente de Contado";
    const vendedorNombre = ventasArray[0]?.vendedor || "Caja";

    const itemsHTML = ventasArray.map((v) => {
      const cant = Number(v.totalUnidades) || 1;
      const subtotalLinea = Number(v.precioUnitarioCustom) > 0
        ? Math.round(Number(v.precioUnitarioCustom) * cant)
        : Math.round(typeof obtenerPrecioVenta === "function" ? obtenerPrecioVenta(v) : (Number(v.precio || 0) * cant));

      return `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: 13px; font-weight: 900; color: #000; margin-bottom: 6px;">
          <span style="flex: 1; padding-right: 8px;">
            ${cant}x ${v.item} ${v.tallasTexto ? `(Talla: ${v.tallasTexto})` : ''} ${v.dorsalTexto ? `[Impresión: ${v.dorsalTexto}]` : ''}
          </span>
          <span style="font-weight: 900; white-space: nowrap;">
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
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              color: #000000; 
              font-weight: 700;
              margin: 0; 
              padding: 6px 4px 8px 24px; 
              width: 100%; 
              max-width: 72mm; 
              font-size: 12px; 
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: 900; }
            .divider { border-bottom: 2px dashed #000000; margin: 8px 0; }
            h1 { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .ticket-info {
              padding-left: 3mm;
            }
            p { margin: 3px 0; font-weight: 700; }
            .logo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 8px; }
            .logo-img { max-width: 130px; height: auto; object-fit: contain; filter: grayscale(100%) contrast(250%); }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="logo-container">
              <img id="ticket-logo" src="${window.location.origin}/logo.png" alt="ChemaSport ER" class="logo-img" onerror="this.style.display='none'" />
            </div>
            <h1>CHEMASPORT ER</h1>
            <p>Ropa y Artículos Deportivos</p>
            <p>Tel: +50660369857</p>
            <p style="font-size: 11px; margin-top: 4px;">50 metros oeste de la bomba Delta, Grecia</p>
            <p style="font-size: 11px;">CJ: 3102916554</p>
            <p style="font-size: 11px; margin-bottom: 5px;">chemasport__er@outlook.com</p>
          </div>
          <div class="divider"></div>
          <div class="ticket-info">
            <p><span class="font-bold">Comprobante N°:</span> ${consecutivoOficial}</p>
            <p><span class="font-bold">Fecha:</span> ${fechaHoy}</p>
            <p><span class="font-bold">Cliente:</span> ${clienteNombre}</p>
            ${datosCliente.cedula ? `<p><span class="font-bold">Cédula:</span> ${datosCliente.cedula}</p>` : ""}
            ${datosCliente.telefono ? `<p><span class="font-bold">Tel:</span> ${datosCliente.telefono}</p>` : ""}
            <p><span class="font-bold">Atendió:</span> ${vendedorNombre}</p>
          </div>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px; margin-bottom: 8px;">
            <span>CANT. DESCRIPCIÓN</span>
            <span>IMPORTE</span>
          </div>
          ${itemsHTML}
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 900; margin-top: 10px;">
            <span>TOTAL:</span>
            <span>₡${Number(totalCobrado).toLocaleString("es-CR")}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px; font-weight: 900;">
            <p>¡Gracias por su compra!</p>
            <p style="font-size: 11px;">Conserve este tiquete para reclamos.</p>
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
      tipoEmision: "interno",
      tipoIdentificacion: "01",
      cedula: "",
      nombre: clienteInicial,
      telefono: "",
      correo: ""
    });
  };

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

    const sumaOriginalPrendas = modalFacturar.ventas.reduce((acc, v) => acc + obtenerPrecioVenta(v), 0);
    const factorPrendas = sumaOriginalPrendas > 0 ? (precioPrendas / sumaOriginalPrendas) : 1;

    const ventasParaEmitir = modalFacturar.ventas.map((v) => {
      const cant = Number(v.totalUnidades) || 1;
      const totalFilaAjustado = obtenerPrecioVenta(v) * factorPrendas;
      return {
        ...v,
        precioUnitarioCustom: Number((totalFilaAjustado / cant).toFixed(5))
      };
    });

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
              <div class="summary-label">Prendas (Stock + Contrap.)</div>
              <div class="summary-value">${totalPrendasMes} uds.</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Comisiones</div>
              <div class="summary-value">₡${totalComisionesMes.toLocaleString("es-CR")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Tarifas (Stock/Contrap.)</div>
              <div class="summary-value">₡${comisionPorPrenda}/₡${comisionContrapedido}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Líder del Mes</div>
              <div class="summary-value">${top1?.vendedor || "N/A"} (${top1?.totalUdsCombinadas || 0})</div>
            </div>
          </div>

          <div class="section-title">1. Resumen por Vendedor (Stock & Contrapedido)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">Pos.</th>
                <th style="width: 32%;">Vendedor</th>
                <th class="text-right" style="width: 15%;">Stock (₡${comisionPorPrenda})</th>
                <th class="text-right" style="width: 18%;">Contrap. (₡${comisionContrapedido})</th>
                <th class="text-right" style="width: 12%;">Total Uds.</th>
                <th class="text-right" style="width: 15%;">Comisión</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((r, i) => `
                <tr>
                  <td class="font-bold">${i + 1}º</td>
                  <td class="font-bold">${r.vendedor}</td>
                  <td class="text-right">${r.unidades}</td>
                  <td class="text-right">${r.contrapedidoUds}</td>
                  <td class="text-right font-bold">${r.totalUdsCombinadas}</td>
                  <td class="text-right font-bold">₡${r.totalComision.toLocaleString("es-CR")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">2. Registro Detallado de Ventas (Stock)</div>
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
                    <td>${v.item}${v.tallasTexto ? ` (${v.tallasTexto})` : ""}${v.dorsalTexto ? ` [Impresión: ${v.dorsalTexto}]` : ""}</td>
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
    <div className="min-h-screen adm-page pt-8 sm:pt-10 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black relative">
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
            <p className="text-zinc-500 text-sm font-medium mt-1">Stock (₡{comisionPorPrenda}) y Contrapedido (₡{comisionContrapedido}) acumulados del mes.</p>
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

            {/* Configuración de Tarifas (Solo Super Admin) */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${esSuperAdmin ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-100 border-zinc-200 opacity-80'}`}>
              {!esSuperAdmin ? <FaLock className="text-zinc-400" size={10} title="Solo administradores" /> : <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock:</span>}
              <input type="number" min="0" step="100" value={comisionPorPrenda} onChange={(e) => setComisionPorPrenda(Number(e.target.value) || 0)} disabled={!esSuperAdmin} className={`w-16 bg-transparent text-xs font-black text-black outline-none ${!esSuperAdmin ? 'cursor-not-allowed text-zinc-500' : ''}`} title="Tarifa Stock (₡800)" />
              <span className="text-zinc-300">|</span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Contrap:</span>
              <input type="number" min="0" step="100" value={comisionContrapedido} onChange={(e) => setComisionContrapedido(Number(e.target.value) || 0)} disabled={!esSuperAdmin} className={`w-16 bg-transparent text-xs font-black text-black outline-none ${!esSuperAdmin ? 'cursor-not-allowed text-zinc-500' : ''}`} title="Tarifa Contrapedido (₡400)" />
            </div>
          </div>
        </div>

        {/* Podio Top 3 con soporte para edición directa de contrapedido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-end">
          {/* 2º LUGAR */}
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-2 md:order-1">
            <div className="w-12 h-12 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xl font-black mb-3 shadow-inner">🥈</div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">2º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">{top2?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <div className="flex justify-around text-center mb-2 items-center">
                <div>
                  <p className="text-xl font-black text-black">{top2?.unidades || 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">Stock</p>
                </div>
                <div className="border-r border-zinc-200 h-6"></div>
                <div>
                  {puedeEditarContrapedidos && top2?.vendedor ? (
                    editandoContrapVendedor === top2.vendedor ? (
                      <div className="inline-flex items-center bg-white border border-black rounded-lg overflow-hidden shadow-sm">
                        <input 
                          type="number" 
                          min="0"
                          value={tempContrapValor} 
                          onChange={(e) => setTempContrapValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") guardarContrapedidoDirecto(top2.vendedor);
                            if (e.key === "Escape") setEditandoContrapVendedor(null);
                          }}
                          autoFocus
                          className="w-12 text-center text-sm font-black text-emerald-800 bg-transparent outline-none py-0.5"
                        />
                        <button type="button" onClick={() => guardarContrapedidoDirecto(top2.vendedor)} className="bg-emerald-600 text-white px-1.5 py-1 cursor-pointer"><FaCheck size={9} /></button>
                        <button type="button" onClick={() => setEditandoContrapVendedor(null)} className="bg-zinc-200 text-zinc-700 px-1.5 py-1 cursor-pointer"><FaTimes size={9} /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoContrapVendedor(top2.vendedor);
                          setTempContrapValor(String(top2.contrapedidoUds));
                        }}
                        className="text-xl font-black text-emerald-700 hover:underline cursor-pointer"
                        title="Clic para editar contrapedido"
                      >
                        +{top2?.contrapedidoUds || 0} 
                      </button>
                    )
                  ) : (
                    <p className="text-xl font-black text-emerald-700">+{top2?.contrapedidoUds || 0}</p>
                  )}
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">Contrap.</p>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Total: <strong>{top2?.totalUdsCombinadas || 0}</strong> prendas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">₡{(top2?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>

          {/* 1º LUGAR (LÍDER) */}
          <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-3xl p-7 border-2 border-amber-400 shadow-xl flex flex-col items-center text-center relative order-1 md:order-2 -mt-4 md:-mt-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-black flex items-center justify-center text-3xl font-black mb-3 shadow-md">🥇</div>
            <span className="text-xs font-black tracking-widest text-amber-600 uppercase flex items-center gap-1">★ LÍDER EN VENTAS ★</span>
            <h3 className="text-2xl sm:text-3xl font-black text-black mt-1 truncate max-w-full">{top1?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-amber-50/60 rounded-2xl p-4 border border-amber-200">
              <div className="flex justify-around text-center mb-2 items-center">
                <div>
                  <p className="text-2xl font-black text-black">{top1?.unidades || 0}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase">Stock</p>
                </div>
                <div className="border-r border-amber-300 h-8"></div>
                <div>
                  {puedeEditarContrapedidos && top1?.vendedor ? (
                    editandoContrapVendedor === top1.vendedor ? (
                      <div className="inline-flex items-center bg-white border border-black rounded-lg overflow-hidden shadow-sm">
                        <input 
                          type="number" 
                          min="0"
                          value={tempContrapValor} 
                          onChange={(e) => setTempContrapValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") guardarContrapedidoDirecto(top1.vendedor);
                            if (e.key === "Escape") setEditandoContrapVendedor(null);
                          }}
                          autoFocus
                          className="w-14 text-center text-base font-black text-emerald-800 bg-transparent outline-none py-0.5"
                        />
                        <button type="button" onClick={() => guardarContrapedidoDirecto(top1.vendedor)} className="bg-emerald-600 text-white px-2 py-1 cursor-pointer"><FaCheck size={10} /></button>
                        <button type="button" onClick={() => setEditandoContrapVendedor(null)} className="bg-zinc-200 text-zinc-700 px-2 py-1 cursor-pointer"><FaTimes size={10} /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoContrapVendedor(top1.vendedor);
                          setTempContrapValor(String(top1.contrapedidoUds));
                        }}
                        className="text-2xl font-black text-emerald-700 hover:underline cursor-pointer"
                        title="Clic para editar contrapedido"
                      >
                        +{top1?.contrapedidoUds || 0} 
                      </button>
                    )
                  ) : (
                    <p className="text-2xl font-black text-emerald-700">+{top1?.contrapedidoUds || 0}</p>
                  )}
                  <p className="text-[9px] font-bold text-zinc-500 uppercase">Contrap.</p>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Total: <strong>{top1?.totalUdsCombinadas || 0}</strong> prendas</p>
              <p className="text-lg font-black text-emerald-600 mt-2">₡{(top1?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>

          {/* 3º LUGAR */}
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-3">
            <div className="w-12 h-12 rounded-full bg-amber-700/20 text-amber-800 flex items-center justify-center text-xl font-black mb-3 shadow-inner">🥉</div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">3º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">{top3?.vendedor || "Sin ventas"}</h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <div className="flex justify-around text-center mb-2 items-center">
                <div>
                  <p className="text-xl font-black text-black">{top3?.unidades || 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">Stock</p>
                </div>
                <div className="border-r border-zinc-200 h-6"></div>
                <div>
                  {puedeEditarContrapedidos && top3?.vendedor ? (
                    editandoContrapVendedor === top3.vendedor ? (
                      <div className="inline-flex items-center bg-white border border-black rounded-lg overflow-hidden shadow-sm">
                        <input 
                          type="number" 
                          min="0"
                          value={tempContrapValor} 
                          onChange={(e) => setTempContrapValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") guardarContrapedidoDirecto(top3.vendedor);
                            if (e.key === "Escape") setEditandoContrapVendedor(null);
                          }}
                          autoFocus
                          className="w-12 text-center text-sm font-black text-emerald-800 bg-transparent outline-none py-0.5"
                        />
                        <button type="button" onClick={() => guardarContrapedidoDirecto(top3.vendedor)} className="bg-emerald-600 text-white px-1.5 py-1 cursor-pointer"><FaCheck size={9} /></button>
                        <button type="button" onClick={() => setEditandoContrapVendedor(null)} className="bg-zinc-200 text-zinc-700 px-1.5 py-1 cursor-pointer"><FaTimes size={9} /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoContrapVendedor(top3.vendedor);
                          setTempContrapValor(String(top3.contrapedidoUds));
                        }}
                        className="text-xl font-black text-emerald-700 hover:underline cursor-pointer"
                        title="Clic para editar contrapedido"
                      >
                        +{top3?.contrapedidoUds || 0} 
                      </button>
                    )
                  ) : (
                    <p className="text-xl font-black text-emerald-700">+{top3?.contrapedidoUds || 0}</p>
                  )}
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">Contrap.</p>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Total: <strong>{top3?.totalUdsCombinadas || 0}</strong> prendas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">₡{(top3?.totalComision || 0).toLocaleString("es-CR")}</p>
            </div>
          </div>
        </div>

        {/* Posiciones Generales - Optimizado Responsivo Celular con Bloque Directo */}
        {restoRanking.length > 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-4 sm:p-6 mb-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 ml-1">Posiciones Generales</h3>
            <div className="space-y-3 sm:space-y-2">
              {restoRanking.map((item, idx) => {
                const estaEditandoEste = editandoContrapVendedor === item.vendedor;

                return (
                  <div key={item.vendedor} className="py-3 px-3.5 bg-zinc-50/60 sm:bg-transparent border border-zinc-100 sm:border-0 rounded-2xl sm:rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                    
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 shrink-0 rounded-full bg-zinc-200/70 font-black text-xs text-zinc-800 flex items-center justify-center">{idx + 4}</span>
                      <span className="font-black text-sm sm:text-base text-black truncate">{item.vendedor}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-y-2 gap-x-4 sm:gap-6 text-right pt-2 sm:pt-0 border-t border-zinc-200/50 sm:border-t-0">
                      
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                        <span>Stock: <strong className="text-black">{item.unidades}</strong></span>
                        <span className="text-zinc-300">|</span>
                        
                        {/* Contrapedido: Bloque clickeable o Input directo */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700">Contrap:</span>
                          {puedeEditarContrapedidos ? (
                            estaEditandoEste ? (
                              <div className="inline-flex items-center bg-white border-2 border-black rounded-lg shadow-sm overflow-hidden">
                                <input 
                                  type="number" 
                                  min="0"
                                  value={tempContrapValor} 
                                  onChange={(e) => setTempContrapValor(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") guardarContrapedidoDirecto(item.vendedor);
                                    if (e.key === "Escape") setEditandoContrapVendedor(null);
                                  }}
                                  autoFocus
                                  className="w-14 text-center text-xs font-black text-emerald-800 bg-transparent outline-none py-1"
                                />
                                <button 
                                  type="button" 
                                  onClick={() => guardarContrapedidoDirecto(item.vendedor)}
                                  className="bg-emerald-600 text-white px-2 py-1 hover:bg-emerald-700 cursor-pointer"
                                  title="Guardar"
                                >
                                  <FaCheck size={10} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => setEditandoContrapVendedor(null)}
                                  className="bg-zinc-200 text-zinc-700 px-2 py-1 hover:bg-zinc-300 cursor-pointer"
                                  title="Cancelar"
                                >
                                  <FaTimes size={10} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditandoContrapVendedor(item.vendedor);
                                  setTempContrapValor(String(item.contrapedidoUds));
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 font-black text-xs transition-all cursor-pointer shadow-sm"
                                title="Hacer clic para editar número exacto"
                              >
                                +{item.contrapedidoUds} 
                              </button>
                            )
                          ) : (
                            <strong className="text-emerald-800">+{item.contrapedidoUds}</strong>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-6 ml-auto sm:ml-0">
                        <div>
                          <span className="font-black text-sm sm:text-base text-black">{item.totalUdsCombinadas}</span>
                          <span className="text-[10px] text-zinc-400 font-bold uppercase ml-1">TOT.</span>
                        </div>
                        <span className="font-black text-sm sm:text-base text-emerald-600 min-w-[85px] sm:w-24 text-right">
                          ₡{item.totalComision.toLocaleString("es-CR")}
                        </span>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla de ventas detalladas */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">Detalle de Ventas del Periodo</h2>
              {!loading && tablaVentas.length > 0 && (
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5">
                  Mostrando {(safeCurrentPage - 1) * itemsPerPage + 1} - {Math.min(safeCurrentPage * itemsPerPage, tablaVentas.length)} de {tablaVentas.length} ventas
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {ventasSeleccionadas.length > 0 && (
                <button onClick={() => abrirModalFacturacion(ventasSeleccionadas)} disabled={generandoTiquete} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap">
                  <FaReceipt size={14} /> Emitir {ventasSeleccionadas.length} en 1 Tiquete
                </button>
              )}
              <div className="relative w-full sm:w-64">
                <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Buscar por cliente o empleado ..." className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black" />
                <FaSearch className="absolute left-3.5 top-3 -translate-y-1/2 text-zinc-400" size={13} />
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
            <>
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
                    {tablaVentasPaginadas.map((venta) => {
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
                                <button onClick={() => guardarPrecioFila(venta._id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer" title="Guardar precio"><FaCheck size={10} /></button>
                                <button onClick={() => setEditandoPrecioId(null)} className="p-1.5 bg-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-300 transition-colors cursor-pointer" title="Cancelar"><FaTimes size={10} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-black text-emerald-700 text-xs">₡{precioActual.toLocaleString("es-CR")}</span>
                                <button onClick={() => { setEditandoPrecioId(venta._id); setTempPrecioFila(String(precioActual)); }} className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all cursor-pointer" title="Personalizar precio"><FaEdit size={12} /></button>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-zinc-700">
                            <span className="font-bold text-black block">{venta.item}</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {venta.tallasTexto && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold">
                                  Tallas: {venta.tallasTexto}
                                </span>
                              )}
                              {venta.dorsalTexto && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-mono text-[10px] font-black uppercase">
                                  Impresión: {venta.dorsalTexto}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-black text-right text-sm text-black">{venta.totalUnidades}</td>
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex justify-center items-center gap-3">
                              <button onClick={() => abrirModalFacturacion([venta])} disabled={generandoTiquete} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer" title="Emitir Tiquete / Factura"><FaReceipt size={14} /></button>
                              {permitidoAnular ? (
                                <button onClick={() => confirmarAnulacion(venta)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer" title="Anular Venta"><FaTrash size={13} /></button>
                              ) : (
                                <button type="button" onClick={() => toastHOT.error(`Solo puedes anular tus propias ventas (esta venta es de ${venta.vendedor}).`)} className="p-2 text-zinc-200 cursor-not-allowed rounded-xl" title="Acción restringida"><FaTrash size={13} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                    Página {safeCurrentPage} de {totalPages}
                  </span>
                  <nav className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safeCurrentPage === 1} className="p-2.5 text-xs text-white bg-black rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"><FaChevronLeft size={11} /></button>
                    {buildPages(safeCurrentPage, totalPages).map((n, i, nums) => {
                      const prev = nums[i - 1];
                      const showDots = i > 0 && n - prev > 1;
                      const isCurrent = n === safeCurrentPage;
                      return (
                        <span key={n} className="flex items-center gap-1.5">
                          {showDots && <span className="px-1.5 text-zinc-400 font-bold text-xs">...</span>}
                          <button type="button" onClick={() => setCurrentPage(n)} className={`min-w-[34px] h-9 px-2.5 text-xs font-black rounded-xl transition-all cursor-pointer border ${isCurrent ? "bg-black text-white border-black shadow-sm" : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-black hover:bg-zinc-100"}`}>{n}</button>
                        </span>
                      );
                    })}
                    <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safeCurrentPage === totalPages} className="p-2.5 text-xs text-white bg-black rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"><FaChevronRight size={11} /></button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL DE FACTURACIÓN */}
      {modalFacturar.isOpen && (
        <ModalShell
          onClose={() => setModalFacturar((m) => ({ ...m, isOpen: false }))}
          size="md"
          icon={FaReceipt}
          eyebrow="Facturación"
          title="Emitir comprobante"
          subtitle={modalFacturar.ventas.length === 1 ? `${modalFacturar.ventas[0].totalUnidades}x ${modalFacturar.ventas[0].item}` : `${modalFacturar.ventas.length} ventas seleccionadas`}
          closeOnBackdrop={!generandoTiquete}
          footer={(close) => (
            <>
              <button type="button" onClick={close} className="md-btn is-flat">Cancelar</button>
              <button type="button" onClick={confirmarYEmitirFactura} disabled={generandoTiquete} className="md-btn is-success">
                {generandoTiquete && <span className="md-spinner" aria-hidden="true" />}
                {generandoTiquete ? "Emitiendo…" : `Emitir · ₡${((Number(modalFacturar.precio) || 0) + (modalFacturar.incluyeEnvio ? Number(modalFacturar.precioEnvio) || 0 : 0)).toLocaleString("de-DE")}`}
              </button>
            </>
          )}
        >
          {/* 💰 MONTOS */}
          <label className="md-field">
            <span className="md-label">Monto de productos *</span>
            <div className="md-affix">
              <span className="md-affix-sign">₡</span>
              <input type="number" inputMode="numeric" value={modalFacturar.precio} onChange={(e) => setModalFacturar({ ...modalFacturar, precio: e.target.value })} className="md-input is-money is-green" />
            </div>
          </label>

          <div className="md-section">
            <label className="md-switch">
              <span className="md-switch-text">
                <b className="flex items-center gap-2"><FaTruck className="text-gray-500" size={13} /> Agregar envío</b>
                <small>{modalFacturar.incluyeEnvio ? `+ ₡${(Number(modalFacturar.precioEnvio) || 0).toLocaleString("de-DE")} al total` : "Se suma como línea aparte"}</small>
              </span>
              <input type="checkbox" checked={modalFacturar.incluyeEnvio} onChange={(e) => setModalFacturar({ ...modalFacturar, incluyeEnvio: e.target.checked })} />
              <span className="md-track" style={{ "--on": "#16a34a" }} />
            </label>
            {modalFacturar.incluyeEnvio && (
              <label className="md-field">
                <span className="md-label">Costo del envío *</span>
                <div className="md-affix">
                  <span className="md-affix-sign">₡</span>
                  <input type="number" inputMode="numeric" value={modalFacturar.precioEnvio} onChange={(e) => setModalFacturar({ ...modalFacturar, precioEnvio: e.target.value })} className="md-input is-money" style={{ background: "#fff" }} />
                </div>
              </label>
            )}
          </div>

          {/* 🧾 TIPO DE COMPROBANTE */}
          <label className="md-field">
            <span className="md-label">Tipo de comprobante *</span>
            <select value={modalFacturar.tipoEmision} onChange={(e) => setModalFacturar({ ...modalFacturar, tipoEmision: e.target.value })} disabled={!esSuperAdmin} className="md-input">
              <option value="interno">Ticket normal (uso interno)</option>
              {esSuperAdmin && <option value="hacienda">Tiquete electrónico (Hacienda)</option>}
            </select>
          </label>

          {/* 👤 CLIENTE */}
          <div className="md-section">
            <span className="md-section-title">Cliente</span>

            <div className="relative">
              <button type="button" onClick={() => setMostrarListaContactos((prev) => !prev)} className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 rounded-xl text-xs font-black text-gray-900 transition-colors cursor-pointer">
                <span className="flex items-center gap-2"><FaStar className="text-yellow-500" size={13} /><span>Favoritos / Alegra ({contactosAlegra.length})</span></span>
                <span className="text-[10px] uppercase tracking-wider text-yellow-800 font-bold">{mostrarListaContactos ? "Cerrar ▲" : "Elegir ▼"}</span>
              </button>
              {mostrarListaContactos && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl divide-y divide-gray-100">
                  {contactosOrdenadosYFiltrados.length === 0 ? (
                    <p className="p-3 text-center text-[11px] text-gray-400 font-bold">No se encontraron contactos en Alegra.</p>
                  ) : (
                    contactosOrdenadosYFiltrados.map((c) => {
                      const esFav = favoritosIds.includes(String(c.id));
                      return (
                        <div key={c.id} onClick={() => seleccionarContactoAlegra(c)} className="flex items-center justify-between px-3 py-2.5 hover:bg-green-50 cursor-pointer transition-colors">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-black text-black truncate flex items-center gap-1.5"><FaUserCheck className="text-green-600 flex-shrink-0" size={11} /><span className="truncate">{c.nombre}</span></p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">{c.cedula ? `ID: ${c.cedula}` : ""} {c.telefono ? `· Tel: ${c.telefono}` : ""}</p>
                          </div>
                          <button type="button" onClick={(e) => toggleFavoritoContacto(c.id, e)} className="p-1.5 rounded-lg bg-transparent hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" style={{ border: 0 }}><FaStar size={13} className={esFav ? "text-yellow-400" : "text-gray-300"} /></button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="md-row">
              <label className="md-field" style={{ flex: 2 }}>
                <span className="md-label">Tipo ID *</span>
                <select value={modalFacturar.tipoIdentificacion} onChange={(e) => setModalFacturar({ ...modalFacturar, tipoIdentificacion: e.target.value })} className="md-input is-sm">
                  <option value="01">Física</option>
                  <option value="02">Jurídica</option>
                  <option value="03">DIMEX</option>
                  <option value="04">NITE</option>
                </select>
              </label>
              <label className="md-field" style={{ flex: 3 }}>
                <span className="md-label">Cédula *</span>
                <div className="md-affix">
                  <input type="text" inputMode="numeric" value={modalFacturar.cedula} onChange={(e) => setModalFacturar({ ...modalFacturar, cedula: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") buscarCedulaHacienda(); }} placeholder="101110222" className="md-input is-sm has-btn" style={{ paddingLeft: 12 }} />
                  <button type="button" onClick={buscarCedulaHacienda} className="md-affix-btn is-solid" style={{ width: 32, height: 32, marginTop: -16, right: 5 }} title="Buscar en Hacienda" aria-label="Buscar cédula"><FaSearch size={12} /></button>
                </div>
              </label>
            </div>

            <label className="md-field">
              <span className="md-label">Nombre del cliente *</span>
              <input type="text" value={modalFacturar.nombre} onChange={(e) => setModalFacturar({ ...modalFacturar, nombre: e.target.value })} placeholder="Escriba nombre…" className="md-input is-sm" />
            </label>

            <div className="md-row" style={{ flexWrap: "wrap" }}>
              <label className="md-field" style={{ minWidth: 140 }}>
                <span className="md-label">Teléfono *</span>
                <input type="tel" value={modalFacturar.telefono} onChange={(e) => setModalFacturar({ ...modalFacturar, telefono: e.target.value })} placeholder="8888-8888" className="md-input is-sm" />
              </label>
              <label className="md-field" style={{ minWidth: 180 }}>
                <span className="md-label">Correo *</span>
                <input type="email" value={modalFacturar.correo} onChange={(e) => setModalFacturar({ ...modalFacturar, correo: e.target.value })} placeholder="cliente@correo.com" className="md-input is-sm" />
              </label>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}