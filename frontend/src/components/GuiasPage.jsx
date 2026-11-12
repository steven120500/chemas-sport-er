import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaTruck, FaFilePdf, FaPlus, 
  FaMapMarkerAlt, FaUser, FaTrash, FaSearch, FaBoxOpen,
  FaStickyNote, FaStore, FaCalendarAlt, FaPrint, FaPencilAlt, FaCheck, FaTimes as FaTimesIcon,
  FaChevronRight
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";
import GuiasCorreos from "./GuiasCorreos";
import { generarPdfMensajero } from "../utils/guiasPdf";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";
const STORAGE_KEY = "chemasport_guias_registradas";

function getFechaHoyYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function limpiarMontoCR(val) {
  if (typeof val === "number" && !isNaN(val)) return Math.round(val);
  if (!val) return 0;
  const soloDigitos = String(val).replace(/\D/g, "");
  return Number(soloDigitos) || 0;
}

export default function GuiasPage() {
  const navigate = useNavigate();
  const [tipoEntrega, setTipoEntrega] = useState("mensajero");
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState(() => getFechaHoyYMD());

  // Estado para la paginación de 10 en 10
  const [paginaActual, setPaginaActual] = useState(1);
  const guiasPorPagina = 10;

  // Estado para saber qué celda específica se está editando: { rowId, field }
  const [editingCell, setEditingCell] = useState(null);
  const [tempValue, setTempValue] = useState("");
  const [tempMonto, setTempMonto] = useState(""); // 👈 monto aparte (se edita junto con "debe")

  const [guias, setGuias] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const fetchGuiasBackend = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/guias`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
          if (items.length > 0) {
            setGuias(items);
          }
        }
      } catch (err) {
        console.error("Error sincronizando guías con el backend:", err);
      }
    };
    fetchGuiasBackend();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guias));
    } catch (e) {
      console.error("Error guardando guías en localStorage:", e);
    }
  }, [guias]);

  // Reiniciar a la página 1 cuando cambie el filtro de fecha o la búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [fechaFiltro, searchFilter]);

  const [form, setForm] = useState({
    nombre: "",
    provincia: "",
    canton: "",
    distrito: "",
    telefono: "",
    debe: "No",
    monto: "",
    meterRaspa: "No",
    esMayorista: "No",
    nombreMayorista: "",
    comentarioSelect: "Sin comentario",
    comentarioCustom: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const valorFinal = name === "monto" ? value.replace(/\D/g, "") : value;
      const updated = { ...prev, [name]: valorFinal };
      if (name === "debe" && value === "No") {
        updated.monto = "";
      }
      if (name === "esMayorista" && value === "No") {
        updated.nombreMayorista = "";
      }
      if (name === "comentarioSelect" && value !== "Otro comentario...") {
        updated.comentarioCustom = "";
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.nombre.trim() || 
      !form.provincia || 
      !form.canton.trim() || 
      !form.distrito.trim() || 
      !form.telefono.trim()
    ) {
      toastHOT.error("Por favor completa todos los campos obligatorios (*).");
      return;
    }

    const montoLimpio = limpiarMontoCR(form.monto);

    if (form.debe === "Sí" && montoLimpio <= 0) {
      toastHOT.error("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    if (form.esMayorista === "Sí" && !form.nombreMayorista.trim()) {
      toastHOT.error("Por favor ingresa el nombre del mayorista.");
      return;
    }

    if (form.comentarioSelect === "Otro comentario..." && !form.comentarioCustom.trim()) {
      toastHOT.error("Por favor escribe el comentario personalizado.");
      return;
    }

    setLoading(true);
    const toastId = toastHOT.loading("Generando guía de envío...");

    const comentarioFinal = form.comentarioSelect === "Otro comentario..." 
      ? form.comentarioCustom.trim() 
      : form.comentarioSelect;

    const numeroGuia = `CS-${String(Date.now()).slice(-6)}`;
    const ahora = new Date();
    
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const fechaYMD = `${yyyy}-${mm}-${dd}`;

    const fechaFormateada = ahora.toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const horaFormateada = ahora.toLocaleTimeString("es-CR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const nuevaGuia = {
      id: Date.now(),
      numeroGuia,
      nombre: form.nombre.trim(),
      provincia: form.provincia,
      canton: form.canton.trim(),
      distrito: form.distrito.trim(),
      telefono: form.telefono.trim(),
      debe: form.debe,
      monto: form.debe === "Sí" ? String(montoLimpio) : "0",
      meterRaspa: form.meterRaspa,
      esMayorista: form.esMayorista,
      nombreMayorista: form.esMayorista === "Sí" ? form.nombreMayorista.trim() : "",
      comentarios: comentarioFinal === "Sin comentario" ? "" : comentarioFinal,
      fechaYMD,
      fecha: `${fechaFormateada} ${horaFormateada}`
    };

    try {
      const res = await fetch(`${API_BASE}/api/guias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaGuia)
      });
      const data = await res.json();
      if (data && data._id) {
        nuevaGuia._id = data._id;
      }

      setGuias((prev) => [nuevaGuia, ...prev]);
      setFechaFiltro(fechaYMD);
      setPaginaActual(1);

      setForm({
        nombre: "",
        provincia: "",
        canton: "",
        distrito: "",
        telefono: "",
        debe: "No",
        monto: "",
        meterRaspa: "No",
        esMayorista: "No",
        nombreMayorista: "",
        comentarioSelect: "Sin comentario",
        comentarioCustom: ""
      });

      toastHOT.success("¡Guía guardada con éxito en el servidor!", { id: toastId });
    } catch (error) {
      setGuias((prev) => [nuevaGuia, ...prev]);
      setPaginaActual(1);
      toastHOT.success("¡Guía guardada localmente!", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const eliminarGuia = async (gTarget) => {
    try {
      if (gTarget._id) {
        await fetch(`${API_BASE}/api/guias/${gTarget._id}`, { method: "DELETE" });
      }
    } catch (e) {
      console.error(e);
    }

    setGuias((prev) => prev.filter((g) => {
      if (gTarget._id && g._id) {
        return g._id !== gTarget._id;
      }
      return g.id !== gTarget.id;
    }));

    toastHOT.success("Guía eliminada de la tabla.");
  };

  // 🔥 EDICIÓN RÁPIDA CELDA POR CELDA CON LÁPIZ
  const iniciarEdicionCelda = (g, field) => {
    const rowId = g._id || g.id;
    setEditingCell({ rowId, field });
    setTempValue(g[field] !== undefined ? String(g[field]) : "");
    if (field === "debe") {
      const m = limpiarMontoCR(g.monto);
      setTempMonto(m > 0 ? String(m) : "");
    }
  };

  const guardarEdicionCelda = async (gTarget, field) => {
    const rowId = gTarget._id || gTarget.id;
    let cambios;

    if (field === "debe") {
      // 🔥 Deuda y monto se guardan juntos
      const debe = tempValue === "Sí" ? "Sí" : "No";
      const monto = String(limpiarMontoCR(tempMonto));
      if (debe === "Sí" && Number(monto) <= 0) {
        toastHOT.error("El monto debe ser mayor a 0.");
        return;
      }
      cambios = { debe, monto };
    } else if (field === "monto") {
      const monto = String(limpiarMontoCR(tempValue));
      if (gTarget.debe === "Sí" && Number(monto) <= 0) {
        toastHOT.error("El monto debe ser mayor a 0.");
        return;
      }
      cambios = { monto };
    } else {
      cambios = { [field]: String(tempValue).trim() };
    }

    let guiaActualizada = { ...gTarget, ...cambios };

    if (gTarget._id) {
      try {
        const res = await fetch(`${API_BASE}/api/guias/${gTarget._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambios)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo guardar el cambio.");
        if (data?.guia) guiaActualizada = data.guia;
      } catch (e) {
        console.error("Error actualizando en backend:", e);
        toastHOT.error(e.message || "No se pudo guardar el cambio.");
        return; // 👈 no cambiamos la tabla si el servidor no lo guardó
      }
    }

    setGuias((prev) => prev.map((item) => {
      const itemId = item._id || item.id;
      return itemId === rowId ? guiaActualizada : item;
    }));

    cancelarEdicionCelda();
    toastHOT.success("Campo actualizado.");
  };

  const cancelarEdicionCelda = () => {
    setEditingCell(null);
    setTempValue("");
    setTempMonto("");
  };

  const guiasFiltradas = useMemo(() => {
    return guias.filter((g) => {
      const coincideFecha = g.fechaYMD ? g.fechaYMD === fechaFiltro : true;
      if (!coincideFecha) return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        g.nombre.toLowerCase().includes(q) ||
        g.provincia.toLowerCase().includes(q) ||
        g.canton.toLowerCase().includes(q) ||
        g.distrito.toLowerCase().includes(q) ||
        g.telefono.toLowerCase().includes(q) ||
        String(g.nombreMayorista || "").toLowerCase().includes(q) ||
        String(g.numeroGuia || "").toLowerCase().includes(q)
      );
    });
  }, [guias, fechaFiltro, searchFilter]);

  // Cálculos de paginación (10 en 10)
  const totalPaginas = Math.max(1, Math.ceil(guiasFiltradas.length / guiasPorPagina));
  const indiceInicio = (paginaActual - 1) * guiasPorPagina;
  const guiasPaginadas = guiasFiltradas.slice(indiceInicio, indiceInicio + guiasPorPagina);

  const handleDescargarYCompartirPDF = async (guia) => {
    const toastId = toastHOT.loading("Generando PDF para descargar y compartir...");
    try {
      const { doc, fileName } = await generarPdfMensajero(guia);

      doc.save(fileName);

      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        toastHOT.success("¡PDF descargado! Abriendo menú para compartir...", { id: toastId });
        await navigator.share({
          files: [pdfFile]
        }).catch(() => {});
      } else {
        toastHOT.success("¡PDF descargado correctamente!", { id: toastId });
      }
    } catch (err) {
      console.error("Error generando PDF:", err);
      toastHOT.error("Error al descargar el PDF, abriendo vista de impresión...", { id: toastId });
      handleVistaImpresion(guia);
    }
  };

  const handleVistaImpresion = (guia) => {
    const printWindow = window.open("", "_blank", "width=700,height=900");
    if (!printWindow) {
      toastHOT.error("Por favor permite las ventanas emergentes para imprimir.");
      return;
    }

    const montoGuia = limpiarMontoCR(guia.monto);
    const cobroPendiente = guia.debe === "Sí" && montoGuia > 0;
    const montoFormateado = `₡${montoGuia.toLocaleString("es-CR")}`;
    const esMayorista = guia.esMayorista === "Sí";

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Mensajería Privada - ${guia.nombre}</title>
          <style>
            @page { size: 4in 6in; margin: 4mm; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 2px;
              font-size: 20px;
              line-height: 1.3;
            }
            .ticket {
              width: 100%;
              max-width: 100%;
            }
            .title {
              text-align: center;
              font-size: 26px;
              font-weight: 900;
              margin-bottom: 12px;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
            }
            .line {
              margin-bottom: 10px;
              word-break: break-word;
            }
            .bold {
              font-weight: 900;
            }
            .mayorista-bottom {
              text-align: center;
              font-size: 44px;
              font-weight: 900;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 3px dashed #000;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="title">Mensajería Privada</div>
            
            <div class="line"><span class="bold">Nombre:</span> ${guia.nombre}</div>
            <div class="line"><span class="bold">Provincia:</span> ${guia.provincia}</div>
            <div class="line"><span class="bold">Cantón:</span> ${guia.canton}</div>
            <div class="line"><span class="bold">Distrito:</span> ${guia.distrito}</div>
            <div class="line"><span class="bold">Teléfono:</span> ${guia.telefono}</div>
            <div class="line"><span class="bold">Debe:</span> ${cobroPendiente ? montoFormateado : "No"}</div>
            <div class="line"><span class="bold">Meter raspa:</span> ${guia.meterRaspa}</div>
            <div class="line"><span class="bold">Comentarios:</span> ${guia.comentarios || ""}</div>

            ${esMayorista && guia.nombreMayorista ? `
              <div class="mayorista-bottom">
                ${guia.nombreMayorista.toUpperCase()}
              </div>
            ` : ""}
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
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
      <div className="max-w-5xl mx-auto">
        
        <button 
          onClick={() => navigate("/")} 
          className="inline-flex items-center gap-2 bg-black border border-gray-600 text-zinc-300 hover:text-white hover:bg-zinc-800 px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-sm cursor-pointer transition-all mb-8"
        >
          <FaChevronLeft size={12} /> Volver al catálogo
        </button>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest mb-3 shadow-sm">
              <FaTruck size={11} className="text-amber-400" />
              <span>MENSAJERÍA Y ENVÍOS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
              ChemaSport ER · Guías
            </h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">
              Genera las guías para mensajero privado o Correos de Costa Rica y descarga su etiqueta en PDF.
            </p>
          </div>

          
        </div>

        {/* 🔥 SELECTOR DE TIPO DE ENTREGA (ESTILO CAPTURA) 🔥 */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/90 shadow-sm mb-8">
          <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3.5">
            TIPO DE ENTREGA
          </span>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setTipoEntrega("mensajero")}
              className={`py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-2 ${
                tipoEntrega === "mensajero"
                  ? "border-black bg-black text-white shadow-sm"
                  : "border-gray-200 bg-gray-200 text-gray-500 hover:border-gray-400 hover:text-black"
              }`}
            >
              Mensajero
            </button>
            <button
              type="button"
              onClick={() => setTipoEntrega("correos")}
              className={`py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-2 ${
                tipoEntrega === "correos"
                  ? "border-black bg-black text-white shadow-sm"
                  : "border-gray-200 bg-gray-200 text-gray-500 hover:border-gray-400 hover:text-black"
              }`}
            >
              Correos CR
            </button>
          </div>
        </div>

        {tipoEntrega === "correos" ? (
          <GuiasCorreos />
        ) : (
          <>
            {/* CÁPSULA DEL FORMULARIO CON TEXTAREA GRANDE PARA COMENTARIOS */}
            <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl mb-10 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-5 mb-7">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-sm">
                    <FaBoxOpen size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">
                      Registro de Guía
                    </h2>
                    <p className="text-xs text-zinc-400 font-bold">
                      Completa los datos del envío para generar el formato de mensajería
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    Nombre *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 -translate-y-1/2 text-zinc-400">
                      <FaUser size={13} />
                    </span>
                    <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Escribí el nombre..."
                      required
                      className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:bg-white focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    Provincia *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <FaMapMarkerAlt size={13} />
                    </span>
                    <select
                      name="provincia"
                      value={form.provincia}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
                    >
                      <option value="" disabled>Selecciona provincia</option>
                      <option value="Alajuela">Alajuela</option>
                      <option value="Cartago">Cartago</option>
                      <option value="Heredia">Heredia</option>
                      <option value="San José">San José</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                      Cantón *
                    </label>
                    <input
                      type="text"
                      name="canton"
                      value={form.canton}
                      onChange={handleChange}
                      placeholder="Escribí el cantón..."
                      required
                      className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:bg-white focus:border-black transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                      Distrito *
                    </label>
                    <input
                      type="text"
                      name="distrito"
                      value={form.distrito}
                      onChange={handleChange}
                      placeholder="Escribí el distrito..."
                      required
                      className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:bg-white focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    Teléfono *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-zinc-500">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </span>
                    <input
                      type="tel"
                      name="telefono"
                      value={form.telefono}
                      onChange={handleChange}
                      placeholder="Ej.: +506 8888 8888"
                      required
                      className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:bg-white focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    ¿Debe?
                  </label>
                  <select
                    name="debe"
                    value={form.debe}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>

                  {form.debe === "Sí" && (
                    <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                      <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                        Monto *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 -translate-y-1/2 text-zinc-400 font-black text-sm">
                          ₡
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="monto"
                          value={form.monto}
                          onChange={handleChange}
                          placeholder="Ej. 20000"
                          required
                          autoFocus
                          className="w-full pl-9 pr-4 py-3 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm font-black text-emerald-700 placeholder-zinc-400 outline-none focus:border-black transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    ¿Meter raspa? *
                  </label>
                  <select
                    name="meterRaspa"
                    value={form.meterRaspa}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    ¿Este paquete lo envía un mayorista?
                  </label>
                  <select
                    name="esMayorista"
                    value={form.esMayorista}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>

                  {form.esMayorista === "Sí" && (
                    <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                      <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                        Nombre del Mayorista *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-4 -translate-y-1/2 text-zinc-400">
                          <FaStore size={13} />
                        </span>
                        <input
                          type="text"
                          name="nombreMayorista"
                          value={form.nombreMayorista}
                          onChange={handleChange}
                          placeholder="Ej. VANESSA ALVARADO"
                          required
                          autoFocus
                          className="w-full px-10 pr-4 py-3 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:border-black transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 🔥 CAJA DE COMENTARIOS GRANDE (TEXTAREA AMPLIADA) */}
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                    Comentarios
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <FaStickyNote size={13} />
                    </span>
                    <select
                      name="comentarioSelect"
                      value={form.comentarioSelect}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
                    >
                      <option value="Sin comentario">Sin comentario</option>
                      <option value="ENTREGAR MISMO DIA">ENTREGAR MISMO DIA</option>
                      <option value="PAQUETE PARA JOHAN">PAQUETE PARA JOHAN</option>
                      <option value="Otro comentario...">Otro comentario...</option>
                    </select>
                  </div>

                  {form.comentarioSelect === "Otro comentario..." && (
                    <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                      <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1.5">
                        Otro comentario * (Caja grande para revisar errores)
                      </label>
                      <textarea
                        name="comentarioCustom"
                        value={form.comentarioCustom}
                        onChange={handleChange}
                        placeholder="Escribí tu comentario detallado aquí..."
                        required
                        rows={5}
                        autoFocus
                        className="w-full p-4 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm font-bold text-black placeholder-zinc-400 outline-none focus:border-black transition-all resize-y"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <FaPlus size={13} className="text-amber-400" />
                    <span>{loading ? "Guardando registro..." : "Guardar registro"}</span>
                  </button>
                </div>

              </form>
            </div>

            {/* TABLA DE GUÍAS CON EDICIÓN CELDA POR CELDA (INCLUYENDO RASPA) Y PAGINACIÓN 10 EN 10 */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-100">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                    Listado de Guías
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Haz clic en el lápiz al lado de cualquier dato (incluyendo Raspa) para editarlo directamente en la tabla.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-2xl w-full sm:w-auto">
                    <FaCalendarAlt className="text-zinc-400 shrink-0" />
                    <input 
                      type="date" 
                      value={fechaFiltro} 
                      onChange={(e) => setFechaFiltro(e.target.value)} 
                      className="bg-transparent text-xs font-black text-black outline-none cursor-pointer w-full" 
                    />
                  </div>

                  <div className="relative w-full sm:w-60">
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black"
                    />
                    <FaSearch className="absolute left-3.5 top-3 -translate-y-1/2 text-zinc-400" size={12} />
                  </div>
                </div>
              </div>

              {guiasFiltradas.length === 0 ? (
                <div className="text-center py-14 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-zinc-400 font-bold text-xs uppercase tracking-wider">
                    No hay guías registradas para esta fecha ({fechaFiltro}).
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 uppercase tracking-wider font-black text-[10px]">
                          <th className="py-3.5 px-3">Guía / Hora</th>
                          <th className="py-3.5 px-3">Nombre</th>
                          <th className="py-3.5 px-3">Destino (Provincia / Cantón / Distrito)</th>
                          <th className="py-3.5 px-3">Teléfono</th>
                          <th className="py-3.5 px-3">¿Debe? / Monto</th>
                          <th className="py-3.5 px-3">Detalles</th>
                          <th className="py-3.5 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {guiasPaginadas.map((g) => {
                          const rowId = g._id || g.id;
                          const montoGuia = limpiarMontoCR(g.monto);
                          const tieneDeuda = g.debe === "Sí" && montoGuia > 0;

                          const isEditingField = (field) => editingCell && editingCell.rowId === rowId && editingCell.field === field;

                          return (
                            <tr key={rowId} className="hover:bg-zinc-50/80 transition-colors">
                              
                              {/* GUÍA / HORA */}
                              <td className="py-4 px-3 whitespace-nowrap">
                                <span className="font-black text-black block text-xs">
                                  {g.numeroGuia || `#${String(g.id || '').slice(-4)}`}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-bold">
                                  {g.fecha}
                                </span>
                              </td>

                              {/* NOMBRE (EDITABLE CON LÁPIZ) */}
                              <td className="py-4 px-3 font-black text-black text-xs">
                                {isEditingField("nombre") ? (
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="text" 
                                      value={tempValue} 
                                      onChange={(e) => setTempValue(e.target.value)} 
                                      className="p-1.5 bg-white border border-black rounded-lg text-xs font-bold w-full"
                                      autoFocus
                                    />
                                    <button onClick={() => guardarEdicionCelda(g, "nombre")} className="p-1.5 bg-black text-white rounded-md cursor-pointer"><FaCheck size={10} /></button>
                                    <button onClick={cancelarEdicionCelda} className="p-1.5 bg-zinc-200 text-black rounded-md cursor-pointer"><FaTimesIcon size={10} /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group">
                                    <span>{g.nombre}</span>
                                    <button onClick={() => iniciarEdicionCelda(g, "nombre")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white transition-opacity cursor-pointer" title="Editar nombre">
                                      <FaPencilAlt size={11} />
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* DESTINO (PROVINCIA / CANTÓN / DISTRITO) */}
                              <td className="py-4 px-3 text-zinc-700">
                                <div className="flex items-center gap-1 group">
                                  {isEditingField("provincia") ? (
                                    <select value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-white border border-black rounded text-xs font-bold">
                                      <option value="Alajuela">Alajuela</option>
                                      <option value="Cartago">Cartago</option>
                                      <option value="Heredia">Heredia</option>
                                      <option value="San José">San José</option>
                                    </select>
                                  ) : (
                                    <span className="font-bold text-black">{g.provincia}</span>
                                  )}
                                  {isEditingField("provincia") ? (
                                    <>
                                      <button onClick={() => guardarEdicionCelda(g, "provincia")} className="p-1 bg-black text-white rounded cursor-pointer"><FaCheck size={9} /></button>
                                      <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded cursor-pointer"><FaTimesIcon size={9} /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => iniciarEdicionCelda(g, "provincia")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar provincia"><FaPencilAlt size={10} /></button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 group mt-0.5">
                                  {isEditingField("canton") ? (
                                    <input type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-white border border-black rounded text-xs font-bold w-28" autoFocus />
                                  ) : (
                                    <span className="text-zinc-800 font-semibold">{g.canton}</span>
                                  )}
                                  {isEditingField("canton") ? (
                                    <>
                                      <button onClick={() => guardarEdicionCelda(g, "canton")} className="p-1 bg-black text-white rounded cursor-pointer"><FaCheck size={9} /></button>
                                      <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded cursor-pointer"><FaTimesIcon size={9} /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => iniciarEdicionCelda(g, "canton")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar cantón"><FaPencilAlt size={10} /></button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 group mt-0.5">
                                  {isEditingField("distrito") ? (
                                    <input type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-white border border-black rounded text-xs font-bold w-28" autoFocus />
                                  ) : (
                                    <span className="text-[11px] text-zinc-500">{g.distrito}</span>
                                  )}
                                  {isEditingField("distrito") ? (
                                    <>
                                      <button onClick={() => guardarEdicionCelda(g, "distrito")} className="p-1 bg-black text-white rounded cursor-pointer"><FaCheck size={9} /></button>
                                      <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded cursor-pointer"><FaTimesIcon size={9} /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => iniciarEdicionCelda(g, "distrito")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar distrito"><FaPencilAlt size={10} /></button>
                                  )}
                                </div>
                              </td>

                              {/* TELÉFONO (EDITABLE) */}
                              <td className="py-4 px-3 font-mono font-bold text-zinc-800 whitespace-nowrap">
                                {isEditingField("telefono") ? (
                                  <div className="flex items-center gap-1">
                                    <input type="tel" value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-white border border-black rounded text-xs w-28" autoFocus />
                                    <button onClick={() => guardarEdicionCelda(g, "telefono")} className="p-1 bg-black text-white rounded cursor-pointer"><FaCheck size={9} /></button>
                                    <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded cursor-pointer"><FaTimesIcon size={9} /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group">
                                    <span>{g.telefono}</span>
                                    <button onClick={() => iniciarEdicionCelda(g, "telefono")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar teléfono"><FaPencilAlt size={10} /></button>
                                  </div>
                                )}
                              </td>

                              {/* ¿DEBE? / MONTO (EDITABLE) */}
                              <td className="py-4 px-3 whitespace-nowrap">
                                {isEditingField("debe") ? (
                                  <div className="p-2 bg-white border border-black rounded-xl space-y-2">
                                    <select value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-zinc-100 rounded text-xs font-bold">
                                      <option value="No">No</option>
                                      <option value="Sí">Sí</option>
                                    </select>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={tempMonto}
                                      onChange={(e) => setTempMonto(e.target.value.replace(/\D/g, ""))}
                                      placeholder="Monto ₡"
                                      className="p-1 bg-zinc-100 rounded text-xs font-bold w-24 text-emerald-700"
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={() => guardarEdicionCelda(g, "debe")} className="p-1 bg-black text-white rounded text-[10px] cursor-pointer">Guardar</button>
                                      <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded text-[10px] cursor-pointer">X</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group">
                                    {tieneDeuda ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-black text-xs">
                                        Sí · ₡{montoGuia.toLocaleString("es-CR")}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-[11px]">
                                        No (Pagado)
                                      </span>
                                    )}
                                    <button onClick={() => iniciarEdicionCelda(g, "debe")} className="opacity-60 hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar deuda/monto"><FaPencilAlt size={10} /></button>
                                  </div>
                                )}
                              </td>

                              {/* DETALLES Y COMENTARIOS (EDITABLES, INCLUYENDO RASPA) */}
                              <td className="py-4 px-3">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  {/* 🔥 RASPA EDITABLE CON LÁPIZ */}
                                  <div className="flex items-center gap-1 group/raspa bg-zinc-100 px-2 py-0.5 rounded-md">
                                    {isEditingField("meterRaspa") ? (
                                      <div className="flex items-center gap-1">
                                        <select value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-0.5 bg-white border border-black rounded text-[10px] font-bold">
                                          <option value="No">No</option>
                                          <option value="Sí">Sí</option>
                                        </select>
                                        <button onClick={() => guardarEdicionCelda(g, "meterRaspa")} className="p-0.5 bg-black text-white rounded"><FaCheck size={8} /></button>
                                        <button onClick={cancelarEdicionCelda} className="p-0.5 bg-zinc-200 rounded"><FaTimesIcon size={8} /></button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-zinc-800 font-bold text-[10px]">Raspa: {g.meterRaspa}</span>
                                        <button onClick={() => iniciarEdicionCelda(g, "meterRaspa")} className="opacity-0 group-hover/raspa:opacity-100 text-white hover:text-white cursor-pointer" title="Editar raspa"><FaPencilAlt size={9} /></button>
                                      </>
                                    )}
                                  </div>

                                  {g.esMayorista === "Sí" && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[10px]">
                                      Mayorista: {g.nombreMayorista || "Sí"}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 group mt-0.5">
                                  {isEditingField("comentarios") ? (
                                    <div className="flex items-center gap-1">
                                      <textarea rows={2} value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="p-1 bg-white border border-black rounded text-xs font-bold" autoFocus />
                                      <button onClick={() => guardarEdicionCelda(g, "comentarios")} className="p-1 bg-black text-white rounded cursor-pointer"><FaCheck size={9} /></button>
                                      <button onClick={cancelarEdicionCelda} className="p-1 bg-zinc-200 rounded cursor-pointer"><FaTimesIcon size={9} /></button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 group">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-zinc-500 uppercase">
                                        <FaMapMarkerAlt size={11} className="text-zinc-400 shrink-0" />
                                        <span>{g.comentarios || "Sin comentarios"}</span>
                                      </span>
                                      <button onClick={() => iniciarEdicionCelda(g, "comentarios")} className="opacity-0 group-hover:opacity-100 text-white hover:text-white cursor-pointer" title="Editar comentarios"><FaPencilAlt size={10} /></button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* ACCIONES FINALES (PDF, TÉRMICA, ELIMINAR) */}
                              <td className="py-4 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  
                                  {/* Botón Descargar y Compartir PDF */}
                                  <button
                                    onClick={() => handleDescargarYCompartirPDF(g)}
                                    className="inline-flex items-center gap-1 bg-black hover:bg-zinc-800 text-white px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                                    title="Descargar y Compartir PDF"
                                  >
                                    <FaFilePdf size={12} className="text-amber-400" />
                                    <span>PDF</span>
                                  </button>

                                  {/* Botón Impresión Directa Térmica */}
                                  <button
                                    onClick={() => handleVistaImpresion(g)}
                                    className="p-2.5 bg-black text-white rounded-xl transition-all cursor-pointer shadow-sm"
                                    title="Imprimir en térmica"
                                  >
                                    <FaPrint size={12} />
                                  </button>

                                  {/* Botón Eliminar Individual */}
                                  <button
                                    onClick={() => eliminarGuia(g)}
                                    className="p-2 text-white hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                    title="Eliminar registro"
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                </div>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* CONTROLES DE PAGINACIÓN (10 EN 10) */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-600">
                    <span>
                      Mostrando <strong>{indiceInicio + 1}</strong> a{" "}
                      <strong>{Math.min(indiceInicio + guiasPorPagina, guiasFiltradas.length)}</strong> de{" "}
                      <strong>{guiasFiltradas.length}</strong> guías
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                        disabled={paginaActual === 1}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-black text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                      >
                        <FaChevronLeft size={10} /> Anterior
                      </button>
                      <span className="px-3 py-1.5 font-bold text-black">
                        Página {paginaActual} de {totalPaginas}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaActual === totalPaginas}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-black text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                      >
                        Siguiente <FaChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}