import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaStore, FaCalendarAlt, FaSearch, 
  FaTrash, FaReceipt, FaPrint, FaMoneyBillWave, 
  FaCreditCard, FaMobileAlt, FaCashRegister, FaStar, 
  FaUserCheck, FaBoxOpen, FaPlus, FaShoppingBag, FaExclamationTriangle
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function getFechaHoyYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// 🔥 LEE EXACTAMENTE LOS CAMPOS tienda, stock (Bodega 1) y bodega (Bodega 2)
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

// Actualiza en memoria local al facturar o anular
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

export default function TiendaPage({ isSuperUser = false, user = null }) {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(() => getFechaHoyYMD());
  const [fondoCajaBase, setFondoCajaBase] = useState(() => {
    try { return Number(localStorage.getItem("chemasport_tienda_fondo_caja") || 0); } catch { return 0; }
  });

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

  const [carritoVentas, setCarritoVentas] = useState([]);

  const [facturasEmitidas, setFacturasEmitidas] = useState([]);
  const [resumenCaja, setResumenCaja] = useState({ efectivo: 0, datafono: 0, sinpe: 0, total: 0, cantidadFacturas: 0 });
  const [searchHistorialFilter, setSearchHistorialFilter] = useState("");
  const [generandoTiquete, setGenerandoTiquete] = useState(false);

  const [contactosAlegra, setContactosAlegra] = useState([]);
  const [mostrarListaContactos, setMostrarListaContactos] = useState(false);
  const [favoritosIds, setFavoritosIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chemasport_contactos_favoritos") || "[]"); } catch { return []; }
  });

  const [formCliente, setFormCliente] = useState({
    tipoEmision: "hacienda",
    metodoPago: "Efectivo",
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

  const tiposDisponibles = useMemo(() => {
    const setTipos = new Set(["Todos"]);
    catalogoBase.forEach((p) => {
      if (getAvailableSizes(p).length === 0) return;
      const t = p.type || p.tipo;
      if (t) setTipos.add(String(t).trim());
    });
    return Array.from(setTipos);
  }, [catalogoBase]);

  // Buscador con filtro por tipo, de 15 en 15 y ocultando las agotadas
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
          const remotosConStock = remotos.filter((p) => getAvailableSizes(p).length > 0);
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

  const fetchResumenTienda = async (fechaStr = selectedDate) => {
    try {
      const res = await fetch(`${API_BASE}/api/tienda/resumen?fecha=${encodeURIComponent(fechaStr)}`);
      if (!res.ok) return;
      const data = await res.json();
      const todasFacturas = Array.isArray(data?.facturas) ? data.facturas : [];
      const misFacturas = esSuperAdmin 
        ? todasFacturas 
        : todasFacturas.filter(f => String(f.vendedor || "").toLowerCase() === String(nombreUsuarioActual).toLowerCase());

      let efectivo = 0, datafono = 0, sinpe = 0, total = 0;
      misFacturas.forEach(f => {
        efectivo += Number(f.montoEfectivo || 0);
        datafono += Number(f.montoDatafono || 0);
        sinpe += Number(f.montoSinpe || 0);
        total += Number(f.totalCobrado || 0);
      });

      setResumenCaja({ efectivo, datafono, sinpe, total, cantidadFacturas: misFacturas.length });
      setFacturasEmitidas(misFacturas);
    } catch (err) {
      console.error("Error cargando resumen:", err);
    }
  };

  useEffect(() => {
    fetchResumenTienda(selectedDate);
  }, [selectedDate, nombreUsuarioActual]);

  const todasTallasDelProducto = useMemo(() => {
    return getAvailableSizes(productoSeleccionado);
  }, [productoSeleccionado]);

  // 🔥 SOLO LAS UBICACIONES QUE TIENEN UNIDADES > 0
  const ubicacionesConStock = useMemo(() => {
    const orden = ["Tienda", "Bodega 1", "Bodega 2"];
    const disponiblesSet = new Set(todasTallasDelProducto.map((x) => x.ubicacion));
    return orden.filter((ubi) => disponiblesSet.has(ubi));
  }, [todasTallasDelProducto]);

  const tallasDisponiblesActuales = useMemo(() => {
    return todasTallasDelProducto.filter((x) => x.ubicacion === ubicacionSeleccionada);
  }, [todasTallasDelProducto, ubicacionSeleccionada]);

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
    setPrecioUnitarioInput(String(getProductPrice(prod)));
  };

  const cambiarUbicacionSeleccionada = (nuevaUbi) => {
    setUbicacionSeleccionada(nuevaUbi);
    const tallasEnEsaUbi = todasTallasDelProducto.filter((x) => x.ubicacion === nuevaUbi);
    if (tallasEnEsaUbi.length > 0) {
      setTallaSeleccionada(tallasEnEsaUbi[0].talla);
    }
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
    setPrecioUnitarioInput("");
    toastHOT.success(`Prenda agregada desde ${ubicacionSeleccionada}.`);
  };

  const eliminarItemCarrito = (uid) => {
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

  const imprimirTicketNativo = (ventasArray, consecutivoOficial, totalCobrado, datosCliente = {}, metodoPago = "Efectivo") => {
    const printWindow = window.open("", "_blank", "width=400,height=650");
    if (!printWindow) return alert("Por favor permite las ventanas emergentes.");

    const fechaHoy = datosCliente.fechaHora || new Date().toLocaleString("es-CR");
    const clienteNombre = datosCliente.nombre || "Cliente de Contado";
    const vendedorNombre = nombreUsuarioActual;

    const itemsHTML = ventasArray.map((v) => {
      const cant = Number(v.totalUnidades) || 1;
      const subtotalLinea = Math.round(Number(v.precioUnitarioCustom || v.precio || 0) * cant);
      return `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="flex: 1; padding-right: 8px;">${cant}x ${v.item} (${v.tallasTexto || v.talla || 'U'})</span>
          <span style="font-weight: bold;">₡${subtotalLinea.toLocaleString("es-CR")}</span>
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
          </style>
        </head>
        <body>
          <div class="text-center">
            <h1>CHEMASPORT ER</h1>
            <p>Tienda Física Mostrador</p>
            <p>Tel: +50660369857</p>
            <p style="font-size: 10px;">50 metros oeste bomba Delta, Grecia</p>
          </div>
          <div class="divider"></div>
          <p><span class="font-bold">Comprobante N°:</span> ${consecutivoOficial}</p>
          <p><span class="font-bold">Fecha:</span> ${fechaHoy}</p>
          <p><span class="font-bold">Cliente:</span> ${clienteNombre}</p>
          ${datosCliente.cedula ? `<p><span class="font-bold">Cédula:</span> ${datosCliente.cedula}</p>` : ""}
          <p><span class="font-bold">Método Pago:</span> ${metodoPago}</p>
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
          <div class="text-center" style="margin-top: 15px;">
            <p>¡Gracias por su compra!</p>
          </div>
          <script>window.onload = function() { setTimeout(() => window.print(), 300); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const listaFinalParaCobrar = useMemo(() => {
    if (carritoVentas.length > 0) return carritoVentas;
    if (productoSeleccionado && tallaSeleccionada) {
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
        items: Array.from({ length: cant }, () => ({
          talla: tallaSeleccionada,
          tienda: ubicacionSeleccionada,
          nombre: nombreCompleto
        }))
      }];
    }
    return [];
  }, [carritoVentas, productoSeleccionado, tallaSeleccionada, ubicacionSeleccionada, cantidadVenta, precioUnitarioInput]);

  const totalCalculadoForm = useMemo(() => {
    return listaFinalParaCobrar.reduce(
      (acc, item) => acc + (Number(item.precioUnitarioCustom) || 0) * (Number(item.totalUnidades) || 1),
      0
    );
  }, [listaFinalParaCobrar]);

  const vueltoCalculado = (Number(formCliente.pagoConBillete) || 0) - totalCalculadoForm;

  const handleCobrarYFacturar = async () => {
    if (listaFinalParaCobrar.length === 0) {
      toastHOT.error("Agrega al menos una prenda para facturar.");
      return;
    }
    if (totalCalculadoForm <= 0) {
      toastHOT.error("El monto total debe ser mayor a 0.");
      return;
    }
    if (!formCliente.cedula.trim() || !formCliente.nombre.trim() || !formCliente.telefono.trim() || !formCliente.correo.trim()) {
      toastHOT.error("Todos los datos del cliente son obligatorios.");
      return;
    }

    let efecMixto = Number(formCliente.montoEfectivoMixto) || 0;
    let datMixto = Number(formCliente.montoDatafonoMixto) || 0;
    let sinpeMixto = Number(formCliente.montoSinpeMixto) || 0;

    if (formCliente.metodoPago === "Mixto") {
      const sumaMixto = efecMixto + datMixto + sinpeMixto;
      if (Math.abs(sumaMixto - totalCalculadoForm) > 1) {
        toastHOT.error(`La suma del pago mixto (₡${sumaMixto.toLocaleString("es-CR")}) debe ser igual al total.`);
        return;
      }
    }

    const ventasParaEmitir = listaFinalParaCobrar.map((item, idx) => ({
      _id: `tienda_${Date.now()}_${idx}`,
      item: item.item,
      totalUnidades: Number(item.totalUnidades) || 1,
      talla: item.talla,
      ubicacion: item.ubicacion || "Tienda",
      tallasTexto: item.tallasTexto,
      cliente: formCliente.nombre.trim(),
      vendedor: nombreUsuarioActual,
      precioUnitarioCustom: Number(item.precioUnitarioCustom),
      productId: item.productId,
      items: item.items
    }));

    const payloadTienda = {
      ventas: ventasParaEmitir,
      tipo: formCliente.tipoEmision,
      precioManual: totalCalculadoForm,
      cedula: formCliente.cedula.trim(),
      nombreCliente: formCliente.nombre.trim(),
      email: formCliente.correo.trim(),
      telefono: formCliente.telefono.trim(),
      tipoIdentificacion: formCliente.tipoIdentificacion,
      metodoPago: formCliente.metodoPago,
      montoEfectivo: formCliente.metodoPago === "Mixto" ? efecMixto : (formCliente.metodoPago === "Efectivo" ? totalCalculadoForm : 0),
      montoDatafono: formCliente.metodoPago === "Mixto" ? datMixto : (formCliente.metodoPago === "Datáfono" ? totalCalculadoForm : 0),
      montoSinpe: formCliente.metodoPago === "Mixto" ? sinpeMixto : (formCliente.metodoPago === "SINPE" ? totalCalculadoForm : 0),
      fechaYMD: selectedDate
    };

    setGenerandoTiquete(true);
    const toastId = toastHOT.loading("Emitiendo comprobante, rebajando stock y registrando venta...");

    try {
      const response = await fetch(`${API_BASE}/api/tienda/emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadTienda)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo emitir el comprobante");

      // 🔥 REBAJAR STOCK EN MEMORIA LOCAL EN EL CAMPO EXACTO (tienda / stock / bodega)
      setCatalogoBase((prev) =>
        prev.map((prod) => {
          let mod = prod;
          ventasParaEmitir.forEach((v) => {
            if (String(prod._id || prod.id) === String(v.productId)) {
              mod = ajustarStockProductoLocal(mod, v.talla, v.ubicacion, -Number(v.totalUnidades || 1));
            }
          });
          return mod;
        })
      );

      toastHOT.success("¡Cobro exitoso y stock rebajado!", { id: toastId });

      setCarritoVentas([]);
      setProductoSeleccionado(null);
      setBusquedaProducto("");
      setCantidadVenta(1);
      setPrecioUnitarioInput("");
      setFormCliente((prev) => ({ ...prev, pagoConBillete: "" }));

      fetchResumenTienda(selectedDate);

      imprimirTicketNativo(
        ventasParaEmitir,
        data.consecutivoOficial,
        data.totalCobrado,
        {
          nombre: payloadTienda.nombreCliente,
          cedula: payloadTienda.cedula,
          telefono: payloadTienda.telefono
        },
        payloadTienda.metodoPago
      );
    } catch (error) {
      toastHOT.error(`Error: ${error.message}`, { id: toastId, duration: 6000 });
    } finally {
      setGenerandoTiquete(false);
    }
  };

  // 🔥 ALERTA CON UBICACIÓN EXACTA AL ANULAR Y DEVOLUCIÓN DE STOCK
  const eliminarRegistroFacturaCaja = (factura) => {
    const detalleUbicaciones = Array.isArray(factura.ventas)
      ? factura.ventas.map((v) => {
          const ubi = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
          const talla = v.talla || v.tallasTexto || "U";
          return `${v.totalUnidades || 1}x ${v.item} (Talla ${talla}) ➔ Devolver a: ${ubi}`;
        })
      : [];

    toastHOT((t) => (
      <div className="text-center p-2.5 text-black font-sans max-w-xs">
        <div className="flex justify-center text-amber-500 mb-1.5">
          <FaExclamationTriangle size={22} />
        </div>
        <p className="font-black text-sm mb-1 uppercase tracking-wide text-red-600">
          ¿Anular esta venta?
        </p>
        <p className="text-xs text-zinc-600 mb-2">
          Se restarán <strong>₡{Number(factura.totalCobrado || 0).toLocaleString("es-CR")}</strong> de la caja y el stock se sumará de nuevo.
        </p>

        {detalleUbicaciones.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 mb-3 text-left">
            <p className="text-[10px] font-black uppercase text-amber-900 mb-1">
              ⚠️ Atención: Debes devolver o cambiar físicamente la prenda en:
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
                          if (String(prod._id || prod.id) === String(v.productId)) {
                            mod = ajustarStockProductoLocal(mod, talla, ubi, Number(v.totalUnidades || 1));
                          }
                        });
                        return mod;
                      })
                    );
                  }
                  toastHOT.success("Factura anulada y camiseta devuelta al stock.");
                  fetchResumenTienda(selectedDate);
                }
              } catch (e) {
                toastHOT.error("Error al anular.");
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer"
          >
            Sí, Anular y Devolver
          </button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer">
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 9000 });
  };

  const facturasFiltradas = useMemo(() => {
    if (!searchHistorialFilter.trim()) return facturasEmitidas;
    const q = searchHistorialFilter.toLowerCase();
    return facturasEmitidas.filter(f => {
      const cli = String(f.cliente?.nombre || "").toLowerCase();
      const cons = String(f.consecutivoOficial || "").toLowerCase();
      const met = String(f.metodoPago || "").toLowerCase();
      return cli.includes(q) || cons.includes(q) || met.includes(q);
    });
  }, [facturasEmitidas, searchHistorialFilter]);

  return (
    <div className="min-h-screen bg-white pt-36 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black relative">
      <div className="max-w-6xl mx-auto">
        
        <button 
          onClick={() => navigate("/")} 
          className="inline-flex items-center gap-2 bg-black border border-gray-600 text-zinc-300 hover:text-white hover:bg-zinc-800 px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-sm cursor-pointer transition-all mb-8"
        >
          <FaChevronLeft size={12} /> Volver al catálogo
        </button>

        {/* ENCABEZADO */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest mb-3 shadow-sm">
              <FaStore size={11} className="text-amber-400" />
              <span>MOSTRADOR DE TIENDA FÍSICA ({nombreUsuarioActual})</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
              ChemaSport ER · Punto de Venta
            </h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">
              Facturación directa y arqueo de caja exclusivo para ventas en mostrador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-2xl">
              <FaCalendarAlt className="text-zinc-400" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                className="bg-transparent text-xs sm:text-sm font-black text-black outline-none cursor-pointer" 
              />
            </div>

            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-2xl">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Base Caja: ₡</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={fondoCajaBase || ""}
                onChange={(e) => handleFondoCajaChange(e.target.value)}
                placeholder="0"
                className="w-20 bg-transparent text-sm font-black text-black outline-none"
                title="Efectivo inicial para dar vueltos"
              />
            </div>
          </div>
        </div>

        {/* 💰 TARJETAS DE CAJA CON TUS COLORES EXACTOS INTACTOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* EFECTIVO */}
          <div className="bg-yellow-50/80 border-2 border-yellow-500 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Efectivo en Caja</span>
              <div className="w-9 h-9 rounded-2xl bg-yellow-500 text-white flex items-center justify-center shadow-sm">
                <FaMoneyBillWave size={15} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-orange-950 leading-none">
                ₡{(Number(resumenCaja.efectivo || 0) + Number(fondoCajaBase || 0)).toLocaleString("es-CR")}
              </p>
              <p className="text-[11px] font-bold text-orange-600 mt-1.5">
                Ventas Efec: ₡{Number(resumenCaja.efectivo || 0).toLocaleString("es-CR")}
              </p>
            </div>
          </div>

          {/* DATÁFONO */}
          <div className="bg-blue-50/80 border-2 border-blue-500 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Total en Datáfono</span>
              <div className="w-9 h-9 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
                <FaCreditCard size={15} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-blue-950 leading-none">
                ₡{Number(resumenCaja.datafono || 0).toLocaleString("es-CR")}
              </p>
              <p className="text-[11px] font-bold text-blue-600 mt-1.5">Tarjetas hoy</p>
            </div>
          </div>

          {/* SINPE */}
          <div className="bg-purple-50/80 border-2 border-purple-500 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">Total en SINPE</span>
              <div className="w-9 h-9 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-sm">
                <FaMobileAlt size={15} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-purple-950 leading-none">
                ₡{Number(resumenCaja.sinpe || 0).toLocaleString("es-CR")}
              </p>
              <p className="text-[11px] font-bold text-purple-600 mt-1.5">SINPE Móvil hoy</p>
            </div>
          </div>

          {/* GANANCIA / TOTAL */}
          <div className="bg-gradient-to-br from-green-600 to-green-500 text-white border-2 border-green-600 rounded-3xl p-5 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-green-100">Ganancia / Total Día</span>
              <div className="w-9 h-9 rounded-2xl bg-white/20 text-white flex items-center justify-center">
                <FaCashRegister size={15} />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white leading-none">
                ₡{Number(resumenCaja.total || 0).toLocaleString("es-CR")}
              </p>
              <p className="text-[11px] font-bold text-green-100 mt-1.5">
                {resumenCaja.cantidadFacturas || 0} comprobante(s) emitido(s)
              </p>
            </div>
          </div>
        </div>

        {/* 🛒 FORMULARIO DE FACTURACIÓN EN MOSTRADOR */}
        <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl mb-10 relative">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-5 mb-7">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-sm">
              <FaBoxOpen size={18} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">
                Facturar Venta en Mostrador
              </h2>
              <p className="text-xs text-zinc-400 font-bold">
                Filtra por tipo, busca la prenda disponible, selecciona ubicación y talla, y emite el comprobante.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* 🏷️ SELECTOR RÁPIDO DE FILTRO POR TIPO */}
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-2">
                Filtrar por Categoría / Tipo
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tiposDisponibles.map((t) => {
                  const activo = tipoFiltroSeleccionado === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoFiltroSeleccionado(t)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                        activo
                          ? "bg-black text-white border-black shadow-sm"
                          : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. BUSCADOR DE CAMISETAS DE 15 EN 15 CON FOTO MINIMALISTA Y UBICACIÓN */}
            <div className="relative">
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                Buscar Camiseta o Artículo *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={busquedaProducto}
                  onFocus={() => setMostrarDropdownProductos(true)}
                  onChange={(e) => {
                    setBusquedaProducto(e.target.value);
                    setMostrarDropdownProductos(true);
                  }}
                  placeholder="Escribe el equipo, jugador o categoría..."
                  className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all"
                />
                <FaSearch className="absolute left-3.5 top-5 -translate-y-1/2 text-zinc-400" size={13} />
                {buscandoProductos && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-zinc-400">
                    Buscando...
                  </span>
                )}
              </div>

              {/* Dropdown de 15 en 15 (Solo con stock > 0) */}
              {mostrarDropdownProductos && resultadosBusqueda.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-white border-2 border-zinc-900 rounded-2xl shadow-2xl z-40 divide-y divide-zinc-100">
                  {resultadosBusqueda.map((p) => {
                    const nombre = p.name || p.nombre || p.title || "Camiseta";
                    const tipo = p.type || p.tipo || "";
                    const precio = getProductPrice(p);
                    const thumb = getProductThumb(p);
                    const tallasDisp = getAvailableSizes(p);

                    return (
                      <div
                        key={p._id || p.id}
                        onClick={() => seleccionarProductoBusqueda(p)}
                        className="px-3.5 py-2.5 hover:bg-zinc-50 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-11 h-11 rounded-xl object-cover border border-zinc-200 bg-zinc-100 shrink-0" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
                              <FaShoppingBag size={14} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="font-black text-xs text-black truncate">
                              {nombre} {tipo ? <span className="text-zinc-500 font-bold">({tipo})</span> : ""}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {tallasDisp.map((t, i) => (
                                <span key={`${t.ubicacion}_${t.talla}_${i}`} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono text-[9px] font-bold">
                                  {t.ubicacion} · {t.talla}: {t.stock}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <span className="font-black text-xs text-blue-600 shrink-0">
                          ₡{precio.toLocaleString("es-CR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tarjeta de configuración con selector de Ubicación (Tienda / Bodega 1 / Bodega 2) y Tallas */}
            {productoSeleccionado && (
              <div className="p-4 sm:p-5 bg-zinc-50 border-2 border-zinc-900 rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getProductThumb(productoSeleccionado) && (
                      <img src={getProductThumb(productoSeleccionado)} alt="" className="w-12 h-12 rounded-xl object-cover border border-zinc-200 bg-white shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">Prenda Seleccionada</span>
                      <h4 className="text-sm font-black text-black truncate">
                        {productoSeleccionado.name || productoSeleccionado.nombre} {productoSeleccionado.type ? `(${productoSeleccionado.type})` : ""}
                      </h4>
                    </div>
                  </div>
                  <button type="button" onClick={() => setProductoSeleccionado(null)} className="text-[10px] font-black uppercase text-zinc-400 hover:text-red-600 cursor-pointer">
                     ✕
                  </button>
                </div>

                {/* Selector de Ubicación (Tienda, Bodega 1, Bodega 2) */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-wider mb-1.5">
                    Ubicación de donde sale la prenda *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["Tienda", "Bodega 1", "Bodega 2"].map((ubi) => {
                      const tieneEnUbi = ubicacionesConStock.includes(ubi);
                      const activa = ubicacionSeleccionada === ubi;
                      return (
                        <button
                          key={ubi}
                          type="button"
                          onClick={() => cambiarUbicacionSeleccionada(ubi)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            activa
                              ? "bg-black text-white border-black shadow-sm"
                              : tieneEnUbi
                              ? "bg-white text-gray-800 border-gray-600 hover:border-black"
                              : "bg-zinc-100 text-zinc-400 border-zinc-200"
                          }`}
                        >
                          {ubi}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selector de Tallas Disponibles */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-wider mb-1.5">
                    Selecciona Talla Disponible en {ubicacionSeleccionada} *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tallasDisponiblesActuales.map((t) => {
                      const activa = tallaSeleccionada === t.talla;
                      return (
                        <button
                          key={`${t.ubicacion}_${t.talla}`}
                          type="button"
                          onClick={() => setTallaSeleccionada(t.talla)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            activa
                              ? "bg-black text-white border-black shadow-sm"
                              : "bg-white text-gray-800 border-gray-600 hover:border-black"
                          }`}
                        >
                          {t.talla} <span className="text-[10px] opacity-75">({t.stock})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-wider mb-1">Cantidad *</label>
                    <input type="number" min="1" value={cantidadVenta} onChange={(e) => setCantidadVenta(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-black text-black outline-none focus:border-black" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-wider mb-1">Precio Unitario ₡ *</label>
                    <input type="number" value={precioUnitarioInput} onChange={(e) => setPrecioUnitarioInput(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-black text-blue-600 outline-none focus:border-black" />
                  </div>

                  <div className="flex items-end">
                    <button type="button" onClick={agregarPrendaAlCarrito} className="w-full py-2.5 px-4 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all">
                      <FaPlus size={11} className="text-amber-400" />
                      <span>Agregar a cuenta</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🛒 CARRITO DE PRENDAS PARA FACTURAR */}
            {carritoVentas.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-700">
                    Artículos en el Tiquete ({carritoVentas.length})
                  </span>
                  <span className="text-xs font-black text-blue-600">
                    Subtotal: ₡{totalCalculadoForm.toLocaleString("es-CR")}
                  </span>
                </div>

                <div className="divide-y divide-zinc-200/70">
                  {carritoVentas.map((item) => (
                    <div key={item.uid} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {item.imagen && <img src={item.imagen} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-200 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-black truncate">{item.item}</p>
                          <p className="text-[10px] font-bold text-zinc-500">
                            Cantidad: {item.totalUnidades} · Talla: {item.talla} · Ubicación: <span className="text-black font-black">{item.ubicacion || "Tienda"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1 -translate-y-1/2 text-[10px] font-black text-zinc-400">₡</span>
                          <input type="number" value={item.precioUnitarioCustom} onChange={(e) => cambiarPrecioItemCarrito(item.uid, e.target.value)} className="w-24 pl-6 pr-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-black text-black outline-none" />
                        </div>
                        <button type="button" onClick={() => eliminarItemCarrito(item.uid)} className="p-2 text-zinc-400 hover:text-red-600 rounded-lg cursor-pointer" title="Quitar">
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MÉTODO DE PAGO */}
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                Método de Pago (Para Cuadre de Caja) *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "Efectivo", activeClass: "bg-yellow-500 text-white border-yellow-500" },
                  { id: "Datáfono", activeClass: "bg-blue-500 text-white border-blue-500" },
                  { id: "SINPE", activeClass: "bg-purple-500 text-white border-purple-500" },
                  { id: "Mixto", activeClass: "bg-black text-white border-black" }
                ].map((m) => {
                  const activo = formCliente.metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormCliente({ ...formCliente, metodoPago: m.id })}
                      className={`py-3 px-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        activo ? `${m.activeClass} shadow-md` : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      {m.id}
                    </button>
                  );
                })}
              </div>

              {formCliente.metodoPago === "Efectivo" && (
                <div className="mt-3 p-3.5 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase text-yellow-800 block">Pagó con billete de:</label>
                    <input type="number" value={formCliente.pagoConBillete} onChange={(e) => setFormCliente({ ...formCliente, pagoConBillete: e.target.value })} placeholder="Ej. 25000" className="w-full mt-1 px-3 py-2 bg-white border border-yellow-300 rounded-xl text-xs font-black outline-none" />
                  </div>
                  {Number(formCliente.pagoConBillete) > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-yellow-800 block">Vuelto:</span>
                      <span className={`text-base font-black ${vueltoCalculado >= 0 ? "text-yellow-700" : "text-red-600"}`}>
                        ₡{vueltoCalculado.toLocaleString("es-CR")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {formCliente.metodoPago === "Mixto" && (
                <div className="mt-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-orange-600">Efectivo ₡</label>
                    <input type="number" value={formCliente.montoEfectivoMixto} onChange={(e) => setFormCliente({ ...formCliente, montoEfectivoMixto: e.target.value })} className="w-full mt-1 px-2.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-blue-600">Datáfono ₡</label>
                    <input type="number" value={formCliente.montoDatafonoMixto} onChange={(e) => setFormCliente({ ...formCliente, montoDatafonoMixto: e.target.value })} className="w-full mt-1 px-2.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-purple-600">SINPE ₡</label>
                    <input type="number" value={formCliente.montoSinpeMixto} onChange={(e) => setFormCliente({ ...formCliente, montoSinpeMixto: e.target.value })} className="w-full mt-1 px-2.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-black" />
                  </div>
                </div>
              )}
            </div>

            {/* TIPO DE COMPROBANTE */}
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Tipo de Comprobante *</label>
              <select value={formCliente.tipoEmision} onChange={(e) => setFormCliente({ ...formCliente, tipoEmision: e.target.value })} className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none cursor-pointer">
                <option value="hacienda">Tiquete Electrónico (Hacienda)</option>
                <option value="interno">Ticket Normal (Uso Interno)</option>
              </select>
            </div>

            {/* CLIENTES FAVORITOS / ALEGRA */}
            <div className="relative">
              <button type="button" onClick={() => setMostrarListaContactos((prev) => !prev)} className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-2xl text-xs font-black text-zinc-950 transition-all cursor-pointer">
                <span className="flex items-center gap-2">
                  <FaStar className="text-amber-500" size={14} />
                  <span>Clientes Favoritos / Alegra ({contactosAlegra.length})</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold">{mostrarListaContactos ? "Cerrar ▲" : "Elegir ▼"}</span>
              </button>

              {mostrarListaContactos && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-white border-2 border-zinc-900 rounded-2xl shadow-2xl divide-y divide-zinc-100 z-30">
                  {contactosOrdenadosYFiltrados.length === 0 ? (
                    <p className="p-4 text-center text-xs text-zinc-400 font-bold">No hay contactos guardados en Alegra.</p>
                  ) : (
                    contactosOrdenadosYFiltrados.map((c) => {
                      const esFav = favoritosIds.includes(String(c.id));
                      return (
                        <div key={c.id} onClick={() => seleccionarContactoAlegra(c)} className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-black text-black truncate flex items-center gap-1.5">
                              <FaUserCheck className="text-blue-600 shrink-0" size={12} />
                              <span className="truncate">{c.nombre}</span>
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate">
                              {c.cedula ? `ID: ${c.cedula}` : "Sin ID"} {c.telefono ? `· Tel: ${c.telefono}` : ""}
                            </p>
                          </div>
                          <button type="button" onClick={(e) => toggleFavoritoContacto(c.id, e)} className="p-2 rounded-lg hover:bg-zinc-100 cursor-pointer">
                            <FaStar size={14} className={esFav ? "text-amber-400" : "text-zinc-300"} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* CÉDULA */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Tipo ID *</label>
                <select value={formCliente.tipoIdentificacion} onChange={(e) => setFormCliente({ ...formCliente, tipoIdentificacion: e.target.value })} className="w-full px-3 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-black outline-none">
                  <option value="01">Física</option>
                  <option value="02">Jurídica</option>
                  <option value="03">DIMEX</option>
                  <option value="04">NITE</option>
                  <option value="05">Extranjero</option>
                  <option value="06">No Contrib.</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Número de Cédula *</label>
                <div className="flex gap-2">
                  <input type="text" value={formCliente.cedula} onChange={(e) => setFormCliente({ ...formCliente, cedula: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") buscarCedulaHacienda(); }} placeholder="Ej. 101110222" className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none" />
                  <button type="button" onClick={buscarCedulaHacienda} className="bg-black text-white px-5 rounded-2xl hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer shadow-sm" title="Buscar">
                    <FaSearch size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* NOMBRE */}
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Nombre del Cliente *</label>
              <input type="text" value={formCliente.nombre} onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })} placeholder="Escriba el nombre del cliente..." className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none" />
            </div>

            {/* TELÉFONO Y CORREO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Teléfono *</label>
                <input type="tel" value={formCliente.telefono} onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })} placeholder="Ej. 88888888" className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">Correo *</label>
                <input type="email" value={formCliente.correo} onChange={(e) => setFormCliente({ ...formCliente, correo: e.target.value })} placeholder="cliente@correo.com" className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none" />
              </div>
            </div>

            {/* BOTÓN COBRAR Y EMITIR */}
            <div className="pt-2">
              <button type="button" onClick={handleCobrarYFacturar} disabled={generandoTiquete} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]">
                <FaReceipt size={16} />
                <span>{generandoTiquete ? "Procesando Cobro..." : `Cobrar ₡${totalCalculadoForm.toLocaleString("es-CR")} (${listaFinalParaCobrar.length} artículo${listaFinalParaCobrar.length === 1 ? "" : "s"}) y Emitir Tiquete`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 📋 MINI-HISTORIAL CON COLUMNA DE UBICACIÓN (TIENDA, BODEGA 1, BODEGA 2) */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                Mis Comprobantes Emitidos Hoy ({nombreUsuarioActual})
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Historial de mostrador en la fecha {selectedDate}.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <input type="text" value={searchHistorialFilter} onChange={(e) => setSearchHistorialFilter(e.target.value)} placeholder="Buscar comprobante..." className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black" />
              <FaSearch className="absolute left-3.5 top-3 -translate-y-1/2 text-zinc-400" size={13} />
            </div>
          </div>

          {facturasFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-zinc-400 font-bold text-xs uppercase tracking-wider">No has emitido comprobantes en tienda para esta fecha ({selectedDate}).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 uppercase tracking-wider font-black text-[10px]">
                    <th className="py-3 px-3">Comprobante / Hora</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Artículos</th>
                    <th className="py-3 px-3">Ubicación</th>
                    <th className="py-3 px-3">Método de Pago</th>
                    <th className="py-3 px-3 text-right">Total Cobrado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {facturasFiltradas.map((f) => (
                    <tr key={f._id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-black text-black block text-xs">#{f.consecutivoOficial}</span>
                        <span className="text-[10px] text-zinc-400 font-bold">{f.fechaHora}</span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-black text-black block text-xs">{f.cliente?.nombre || "Cliente de Contado"}</span>
                        {f.cliente?.cedula && <span className="text-[10px] text-zinc-500 font-mono">ID: {f.cliente.cedula}</span>}
                      </td>

                      <td className="py-3.5 px-3 text-zinc-700">
                        {Array.isArray(f.ventas) && f.ventas.map((v, idx) => (
                          <div key={idx} className="text-[11px] font-bold text-zinc-800">
                            {v.totalUnidades || 1}x {v.item} {v.tallasTexto ? `(${v.tallasTexto})` : ""}
                          </div>
                        ))}
                      </td>

                      {/* 🔥 NUEVA COLUMNA UBICACIÓN (TIENDA, BODEGA 1, BODEGA 2) */}
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
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg border font-black text-[11px] bg-emerald-100 text-emerald-800 border-emerald-200">
                          {f.metodoPago}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-black text-blue-600 text-xs whitespace-nowrap">
                        ₡{Number(f.totalCobrado || 0).toLocaleString("es-CR")}
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button onClick={() => imprimirTicketNativo(f.ventas || [], f.consecutivoOficial, f.totalCobrado, { nombre: f.cliente?.nombre, cedula: f.cliente?.cedula, fechaHora: f.fechaHora }, f.metodoPago)} className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm" title="Reimprimir">
                            <FaPrint size={12} className="text-amber-400" />
                            <span>Reimprimir</span>
                          </button>

                          <button onClick={() => eliminarRegistroFacturaCaja(f)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer" title="Anular factura y devolver stock">
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}