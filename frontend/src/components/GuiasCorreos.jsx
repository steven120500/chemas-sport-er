import React, { useState, useEffect } from "react";
import { 
  FaUser, 
  FaBoxOpen, 
  FaSearch, 
  FaPrint, 
  FaMapMarkerAlt, 
  FaCalendarAlt, 
  FaTrash, 
  FaChevronLeft, 
  FaChevronRight,
  FaSpinner,
  FaCopy
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";
import ModalShell from "./ModalShell";
import { generarPdfOficialCorreos } from "../utils/guiasPdf";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";


export default function GuiasCorreos() {
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  
  // Estados de carga individuales para mostrar su propia ruedita (spinner)
  const [loadingProvincias, setLoadingProvincias] = useState(false);
  const [loadingCantones, setLoadingCantones] = useState(false);
  const [loadingDistritos, setLoadingDistritos] = useState(false);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);

  // 📋 Duplicar guía: misma guía con otro "detalle del envío"
  const [guiaADuplicar, setGuiaADuplicar] = useState(null);
  const [detalleDuplicado, setDetalleDuplicado] = useState("");
  const [isDuplicando, setIsDuplicando] = useState(false);

  // Historial sincronizado con Backend + respaldo en localStorage
  const [historialGuias, setHistorialGuias] = useState(() => {
    try {
      const saved = localStorage.getItem("chema_historial_guias");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  
  // Paginado de la tabla histórica (10 en 10)
  const [paginaActual, setPaginaActual] = useState(1);
  const guiasPorPagina = 10;

  const [form, setForm] = useState({
    detalleEnvio: "",
    tipoIdentificacion: "",
    numeroIdentificacion: "",
    nombre: "",
    telefono: "",
    tipoEnvio: "DOM", // DOM = Domicilio, SUC = Sucursal
    provincia: "", 
    canton: "",    
    distrito: "",  
    codigoPostal: "",
    direccion: "",
    codigoSucursal: "", 
  });

  // Cargar historial compartido desde el Backend para que todos vean las guías de todos
  const cargarHistorialGlobal = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/correos/historial`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.exito && Array.isArray(data.datos)) {
        setHistorialGuias(prevLocal => {
          // Combinamos las del backend con cualquier guía previa local que no se haya subido aún
          const mapa = new Map();
          data.datos.forEach(g => mapa.set(g.enviold, g));
          prevLocal.forEach(g => {
            if (g.enviold && !mapa.has(g.enviold)) {
              mapa.set(g.enviold, g);
            }
          });
          return Array.from(mapa.values());
        });
      }
    } catch (error) {
      console.error("Error cargando historial global de Correos:", error);
    }
  };

  useEffect(() => {
    cargarHistorialGlobal();
  }, []);

  // Guardar en localStorage cada vez que cambie el historial
  useEffect(() => {
    try {
      localStorage.setItem("chema_historial_guias", JSON.stringify(historialGuias));
    } catch (e) {
      console.error("Error al guardar en localStorage", e);
    }
  }, [historialGuias]);

  // Reiniciar a la página 1 cuando se cambie la fecha del filtro
  useEffect(() => {
    setPaginaActual(1);
  }, [fechaFiltro]);

  // 1. Cargar Provincias (Con caché instantáneo en sessionStorage)
  useEffect(() => {
    const fetchProvincias = async () => {
      try {
        const cached = sessionStorage.getItem("ccr_provincias");
        if (cached) {
          setProvincias(JSON.parse(cached));
          return;
        }
      } catch (e) {}

      setLoadingProvincias(true);
      try {
        const res = await fetch(`${API_BASE}/api/correos/provincias`);
        const data = await res.json();
        if (data.exito && data.datos) {
          setProvincias(data.datos);
          try {
            sessionStorage.setItem("ccr_provincias", JSON.stringify(data.datos));
          } catch (e) {}
        }
      } catch (error) {
        console.error("Error al cargar provincias", error);
      } finally {
        setLoadingProvincias(false);
      }
    };
    fetchProvincias();
  }, []);

  // 2. Cargar Cantones al elegir Provincia (Con caché instantáneo)
  useEffect(() => {
    if (!form.provincia) return;
    // 🛡️ Si cambian la provincia antes de que responda Correos, se ignora la respuesta vieja
    let vigente = true;
    const fetchCantones = async () => {
      setForm(prev => ({ ...prev, canton: "", distrito: "", codigoPostal: "", codigoSucursal: "" }));
      setDistritos([]);
      setSucursales([]);

      const cacheKey = `ccr_cantones_${form.provincia}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setCantones(JSON.parse(cached));
          return;
        }
      } catch (e) {}

      setLoadingCantones(true);
      try {
        const res = await fetch(`${API_BASE}/api/correos/cantones/${form.provincia}`);
        const data = await res.json();
        if (vigente && data.exito && data.datos) {
          setCantones(data.datos);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.datos));
          } catch (e) {}
        }
      } catch (error) {
        console.error("Error al cargar cantones", error);
      } finally {
        if (vigente) setLoadingCantones(false);
      }
    };
    fetchCantones();
    return () => { vigente = false; };
  }, [form.provincia]);

  // 3. Cargar SOLO Distritos al elegir Cantón (Con caché instantáneo)
  useEffect(() => {
    if (!form.provincia || !form.canton) return;
    let vigente = true; // 🛡️ ignora respuestas de un cantón anterior
    const fetchDistritos = async () => {
      setForm(prev => ({ ...prev, distrito: "", codigoPostal: "", codigoSucursal: "" }));
      setSucursales([]);

      const cacheKey = `ccr_distritos_${form.provincia}_${form.canton}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setDistritos(JSON.parse(cached));
          return;
        }
      } catch (e) {}

      setLoadingDistritos(true);
      try {
        const resDist = await fetch(`${API_BASE}/api/correos/distritos/${form.provincia}/${form.canton}`);
        const dataDist = await resDist.json();
        if (vigente && dataDist.exito && dataDist.datos) {
          setDistritos(dataDist.datos);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(dataDist.datos));
          } catch (e) {}
        }
      } catch (error) {
        console.error("Error al cargar distritos", error);
      } finally {
        if (vigente) setLoadingDistritos(false);
      }
    };
    fetchDistritos();
    return () => { vigente = false; };
  }, [form.canton, form.provincia]);

  // 4. Actualizar Código Postal y cargar Sucursales HASTA QUE se elija el Distrito (y si es tipo SUC)
  useEffect(() => {
    if (!form.distrito) {
      setSucursales([]);
      return;
    }

    const distritoSeleccionado = distritos.find(d => String(d.codigo) === String(form.distrito));
    if (distritoSeleccionado) {
      setForm(prev => ({ ...prev, codigoPostal: distritoSeleccionado.codigoPostal || "" }));
    }

    // Solo cargamos sucursales del backend cuando ya eligió Provincia, Cantón, Distrito y es envío a Sucursal
    if (form.tipoEnvio === "SUC" && form.provincia && form.canton && form.distrito) {
      // 🛡️ Antes, si se cambiaba de cantón rápido, la lista del cantón anterior llegaba tarde y tapaba la nueva
      // (ej. salían 2 sucursales en Esparza, que solo tiene 1). Ahora solo se usa la respuesta del cantón actual.
      let vigente = true;
      const fetchSucursales = async () => {
        const cacheKey = `ccr_sucursales_${form.provincia}_${form.canton}`;
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setSucursales(JSON.parse(cached));
            return;
          }
        } catch (e) {}

        setLoadingSucursales(true);
        try {
          const resSuc = await fetch(`${API_BASE}/api/correos/sucursales/${form.provincia}/${form.canton}`);
          const dataSuc = await resSuc.json();
          if (!vigente) return;
          if (dataSuc.exito && dataSuc.datos) {
            setSucursales(dataSuc.datos);
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(dataSuc.datos));
            } catch (e) {}
          } else {
            setSucursales([]);
          }
        } catch (error) {
          console.error("Error al cargar sucursales", error);
          if (vigente) setSucursales([]);
        } finally {
          if (vigente) setLoadingSucursales(false);
        }
      };
      fetchSucursales();
      return () => { vigente = false; };
    }
  }, [form.distrito, form.tipoEnvio, form.provincia, form.canton, distritos]);

  // Manejador de cambios con validación estricta de teléfono a 8 dígitos
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "telefono") {
      const soloDigitos = value.replace(/\D/g, "").slice(0, 8);
      setForm({ ...form, [name]: soloDigitos });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  // Buscar nombre en Hacienda por Cédula
  const buscarNombrePorCedula = async () => {
    if (!form.numeroIdentificacion || form.numeroIdentificacion.length < 9) {
      toastHOT.error("Ingresa una cédula válida (9 o 10 dígitos) sin guiones.");
      return;
    }

    setIsSearchingCedula(true);
    const toastId = toastHOT.loading("Buscando cédula en Hacienda...");

    try {
      const res = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${form.numeroIdentificacion}`);
      if (!res.ok) throw new Error("Cédula no encontrada en Hacienda");
      const data = await res.json();
      
      if (data && data.nombre) {
        setForm(prev => ({ ...prev, nombre: data.nombre }));
        toastHOT.success("¡Nombre encontrado!", { id: toastId });
      } else {
        throw new Error("Sin resultados");
      }
    } catch (error) {
      console.error(error);
      toastHOT.error("No se encontró el nombre. Por favor, digítalo a mano.", { id: toastId });
    } finally {
      setIsSearchingCedula(false);
    }
  };

  // 🔥 Registra la guía en Correos CR, la agrega al historial y descarga el PDF.
  // La usan el formulario y "Duplicar". Lanza error si Correos no la acepta.
  const registrarGuiaCorreos = async (payload) => {
    const fechaYyyyMmDd = new Date().toISOString().split('T')[0];
    const fechaFormateada = new Date().toLocaleDateString('es-CR');

    const res = await fetch(`${API_BASE}/api/correos/generar-guia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, fechaYyyyMmDd, fechaFormateada })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.exito) {
      throw new Error(data.mensaje || "Error al generar la guía");
    }

    const numeroGuia = data.datos?.enviold || data.datos?.envioId || "PY086032498CR";
    const nuevaGuiaItem = data.guiaGuardada || {
      idUnico: Date.now() + Math.random(),
      enviold: numeroGuia,
      nombre: payload.destNombre,
      telefono: payload.destTelefono,
      tipoEnvio: payload.tipoDestino === "SUC" ? "Sucursal" : "Domicilio",
      direccion: payload.destDireccion,
      detalleEnvio: payload.observaciones,
      codigoPostal: payload.destZip,
      codigoSucursal: payload.tipoDestino === "SUC" ? payload.codigoSucursal : "",
      fechaYyyyMmDd,
      fechaFormateada
    };

    // Generar y descargar el PDF con formato oficial y código de barras
    generarPdfOficialCorreos(nuevaGuiaItem);

    setHistorialGuias(prev => [nuevaGuiaItem, ...prev.filter(g => g.enviold !== nuevaGuiaItem.enviold)]);
    setFechaFiltro(nuevaGuiaItem.fechaYyyyMmDd);
    setPaginaActual(1);
    return nuevaGuiaItem;
  };

  // 📋 Duplicar: abre el modal con el detalle vacío
  const abrirDuplicar = (guiaItem) => {
    setGuiaADuplicar(guiaItem);
    setDetalleDuplicado("");
  };

  // 📋 Genera una guía nueva igual a la original, solo cambia el detalle del envío
  const handleDuplicarGuia = async (close) => {
    const g = guiaADuplicar;
    const detalle = detalleDuplicado.trim();
    if (!g || isDuplicando) return;
    if (!detalle) {
      toastHOT.error("Escribí qué lleva el paquete (ej: Camiseta).");
      return;
    }

    const esSucursal = g.tipoEnvio === "Sucursal" || g.tipoEnvio === "SUC";
    setIsDuplicando(true);
    const toastId = toastHOT.loading(`Duplicando guía de ${g.nombre}...`);
    try {
      await registrarGuiaCorreos({
        destNombre: g.nombre,
        destDireccion: g.direccion,
        destTelefono: g.telefono,
        destZip: g.codigoPostal || "10101",
        peso: 500,
        observaciones: detalle,
        tipoDestino: esSucursal ? "SUC" : "DOM",
        codigoSucursal: esSucursal ? g.codigoSucursal : "",
      });
      toastHOT.success("¡Guía duplicada con éxito!", { id: toastId });
      close();
    } catch (error) {
      console.error(error);
      toastHOT.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsDuplicando(false);
    }
  };

  // Enviar formulario para registrar guía
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.detalleEnvio || !form.nombre || !form.telefono || !form.provincia || !form.canton || !form.distrito) {
      toastHOT.error("Por favor completa todos los campos obligatorios (*).");
      return;
    }

    if (form.telefono.length !== 8) {
      toastHOT.error("El teléfono del destinatario debe tener exactamente 8 dígitos.");
      return;
    }

    if (form.tipoEnvio === "SUC" && !form.codigoSucursal) {
      toastHOT.error("Por favor selecciona una sucursal de destino.");
      return;
    }

    if (form.tipoEnvio === "DOM" && !form.direccion) {
      toastHOT.error("Por favor ingresa la dirección exacta para la entrega a domicilio.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toastHOT.loading("Generando guía oficial en Correos CR...");

    try {
      // Obtener los nombres reales de Provincia, Cantón, Distrito y Sucursal para armar la dirección idéntica a Correos CR
      const provObj = provincias.find(p => String(p.codigo) === String(form.provincia));
      const cantObj = cantones.find(c => String(c.codigo) === String(form.canton));
      const distObj = distritos.find(d => String(d.codigo) === String(form.distrito));
      const sucObj = sucursales.find(s => String(s.codigo) === String(form.codigoSucursal));

      const provNombre = provObj ? provObj.nombre.trim() : "";
      const cantNombre = cantObj ? cantObj.nombre.trim() : "";
      const distNombre = distObj ? distObj.nombre.trim() : "";
      const sucNombre = sucObj ? sucObj.nombre.trim() : "";

      const prefijoGeografico = [provNombre, cantNombre, distNombre].filter(Boolean).join(", ");

      // Formato exacto: "Alajuela, Grecia, Grecia, Sucursal 4100: Grecia" o "Alajuela, Grecia, Grecia, Señas..."
      const direccionCompletaOficial = form.tipoEnvio === "SUC"
        ? `${prefijoGeografico}, Sucursal ${form.codigoSucursal}: ${sucNombre}`
        : `${prefijoGeografico}, ${form.direccion.trim()}`;

      const payload = {
        destNombre: form.nombre.trim(),
        destDireccion: direccionCompletaOficial,
        destTelefono: form.telefono,
        destZip: form.codigoPostal || "10101",
        peso: 500, 
        observaciones: form.detalleEnvio.trim(),
        tipoDestino: form.tipoEnvio,
        codigoSucursal: form.tipoEnvio === "SUC" ? form.codigoSucursal : "",
      };

      await registrarGuiaCorreos(payload);
      toastHOT.success("¡Guía generada con éxito!", { id: toastId });

      setForm(prev => ({ 
          ...prev, 
          detalleEnvio: "", 
          nombre: "", 
          telefono: "", 
          direccion: "",
          numeroIdentificacion: "",
          codigoSucursal: "" 
      }));
    } catch (error) {
      console.error(error);
      toastHOT.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReimprimir = (guiaItem) => {
    generarPdfOficialCorreos(guiaItem);
    toastHOT.success(`Reimprimiendo guía ${guiaItem.enviold}`);
  };

  // Eliminar una guía individual (en Backend + Estado local)
  const handleEliminarGuia = async (guiaEliminar) => {
    const idBorrar = guiaEliminar._id || guiaEliminar.enviold;
    setHistorialGuias(prev => prev.filter(item => 
      (item._id && guiaEliminar._id) 
        ? item._id !== guiaEliminar._id 
        : item.enviold !== guiaEliminar.enviold
    ));
    try {
      await fetch(`${API_BASE}/api/correos/historial/${encodeURIComponent(idBorrar)}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.error("Error eliminando guía en servidor:", e);
    }
    toastHOT.success(`Guía ${guiaEliminar.enviold} eliminada del historial`);
  };

  // Vaciar todas las guías de la fecha seleccionada (en Backend + Estado local)
  const handleVaciarDia = async () => {
    if (!window.confirm(`¿Estás seguro de borrar todas las guías del día ${fechaFiltro}?`)) return;
    setHistorialGuias(prev => prev.filter(item => item.fechaYyyyMmDd !== fechaFiltro));
    setPaginaActual(1);
    try {
      await fetch(`${API_BASE}/api/correos/historial/dia/${encodeURIComponent(fechaFiltro)}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.error("Error vaciando día en servidor:", e);
    }
    toastHOT.success("Se vaciaron las guías del día seleccionado.");
  };

  // Filtrado por día y cálculo de paginación (10 en 10)
  const guiasFiltradasPorDia = historialGuias.filter(item => item.fechaYyyyMmDd === fechaFiltro);
  const totalPaginas = Math.max(1, Math.ceil(guiasFiltradasPorDia.length / guiasPorPagina));
  const indiceInicio = (paginaActual - 1) * guiasPorPagina;
  const guiasPaginadas = guiasFiltradasPorDia.slice(indiceInicio, indiceInicio + guiasPorPagina);

  return (
    <div className="space-y-10 mb-10">
      <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl">
        
        {/* HEADER DATOS DEL PAQUETE */}
        <div className="flex items-center gap-2 mb-4">
            <FaBoxOpen className="text-[#0f2d5c]" />
            <h3 className="text-[#0f2d5c] font-bold text-lg">Datos del paquete</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* DETALLE DEL ENVIO */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Detalle del envío *
            </label>
            <textarea
              name="detalleEnvio"
              value={form.detalleEnvio}
              onChange={handleChange}
              required
              rows={3}
              placeholder="Ej. Camisa deportiva, tacos, etc."
              className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] focus:ring-1 focus:ring-[#0f2d5c] outline-none text-sm resize-none"
            />
          </div>

          {/* SECCIÓN REMITENTE FIJO (CHEMASPORT ER) */}
          <div className="border border-blue-100 bg-blue-50/40 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0f2d5c] bg-blue-100 px-3 py-1 rounded-full">
                Remitente Fijo Oficial
              </span>
              <span className="text-xs text-gray-500">Configurado automáticamente</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-700">
              <div><strong>Empresa:</strong> CHEMASPORT ER S.R.L.</div>
              <div><strong>Cédula Jurídica:</strong> 3102916554</div>
              <div><strong>Teléfono:</strong> 71103209</div>
              <div><strong>Código Postal:</strong> 20307</div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <strong>Dirección:</strong> Alajuela, Grecia, Puente de Piedra, Condominio Lomas del Bosque
            </div>
          </div>

          {/* HEADER DATOS DEL DESTINATARIO */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-6">
               <div className="flex items-center gap-2">
                  <FaUser className="text-[#0f2d5c]" />
                  <h3 className="text-[#0f2d5c] font-bold text-lg">Datos del destinatario</h3>
               </div>
          </div>

          {/* IDENTIFICACION Y TELEFONO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de identificación
                  </label>
                  <select
                      name="tipoIdentificacion"
                      value={form.tipoIdentificacion}
                      onChange={handleChange}
                      className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm"
                  >
                      <option value="">Seleccione tipo de identificación</option>
                      <option value="Fisica">Cédula Física</option>
                      <option value="Juridica">Cédula Jurídica</option>
                      <option value="Dimex">DIMEX</option>
                      <option value="Nite">NITE</option>
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Número de identificación
                  </label>
                  <div className="relative flex">
                    <input
                        type="text"
                        name="numeroIdentificacion"
                        value={form.numeroIdentificacion}
                        onChange={handleChange}
                        placeholder="Sin guiones"
                        className="w-full p-3 border border-gray-300 rounded-l-md focus:border-[#0f2d5c] outline-none text-sm"
                    />
                    <button
                        type="button"
                        onClick={buscarNombrePorCedula}
                        disabled={isSearchingCedula}
                        className="bg-[#0f2d5c] text-white px-4 rounded-r-md hover:bg-blue-900 transition-colors disabled:opacity-70 flex items-center justify-center cursor-pointer"
                        title="Buscar nombre en Hacienda"
                    >
                        {isSearchingCedula ? <FaSpinner className="animate-spin" /> : <FaSearch />}
                    </button>
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre completo *
                  </label>
                  <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm font-semibold text-[#0f2d5c]"
                  />
              </div>
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Teléfono * <span className="text-xs text-gray-500 font-normal">(Exactamente 8 dígitos, sin guiones)</span>
                  </label>
                  <input
                      type="text"
                      name="telefono"
                      value={form.telefono}
                      onChange={handleChange}
                      required
                      maxLength="8"
                      placeholder="Ej. 88888888"
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm"
                  />
              </div>
          </div>

          {/* TIPO DE ENVIO Y GEOGRAFIA */}
          <div className="border-t border-gray-200 pt-6">
              <div className="w-full md:w-1/2 mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de Envío *
                  </label>
                  <select
                      name="tipoEnvio"
                      value={form.tipoEnvio}
                      onChange={handleChange}
                      className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm"
                  >
                      <option value="DOM">A domicilio</option>
                      <option value="SUC">A sucursal</option>
                  </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* PROVINCIA */}
                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          Provincia *
                          {loadingProvincias && (
                            <span className="flex items-center gap-1 text-xs text-[#0f2d5c] font-normal">
                              <FaSpinner className="animate-spin" /> Cargando...
                            </span>
                          )}
                      </label>
                      <select
                          name="provincia"
                          value={form.provincia}
                          onChange={handleChange}
                          required
                          disabled={loadingProvincias}
                          className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm disabled:bg-gray-100"
                      >
                          <option value="" disabled>
                            {loadingProvincias ? "Cargando provincias..." : "Seleccione..."}
                          </option>
                          {provincias.map(p => (
                              <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
                          ))}
                      </select>
                  </div>

                  {/* CANTÓN */}
                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          Cantón *
                          {loadingCantones && (
                            <span className="flex items-center gap-1 text-xs text-[#0f2d5c] font-normal">
                              <FaSpinner className="animate-spin" /> Cargando...
                            </span>
                          )}
                      </label>
                      <select
                          name="canton"
                          value={form.canton}
                          onChange={handleChange}
                          required
                          disabled={!form.provincia || loadingCantones || cantones.length === 0}
                          className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm disabled:bg-gray-100"
                      >
                          <option value="" disabled>
                            {loadingCantones ? "Cargando cantones..." : "Seleccione..."}
                          </option>
                          {cantones.map(c => (
                              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                          ))}
                      </select>
                  </div>

                  {/* DISTRITO */}
                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          Distrito *
                          {loadingDistritos && (
                            <span className="flex items-center gap-1 text-xs text-[#0f2d5c] font-normal">
                              <FaSpinner className="animate-spin" /> Cargando...
                            </span>
                          )}
                      </label>
                      <select
                          name="distrito"
                          value={form.distrito}
                          onChange={handleChange}
                          required
                          disabled={!form.canton || loadingDistritos || distritos.length === 0}
                          className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm disabled:bg-gray-100"
                      >
                          <option value="" disabled>
                            {loadingDistritos ? "Cargando distritos..." : "Seleccione..."}
                          </option>
                          {distritos.map(d => (
                              <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                          ))}
                      </select>
                  </div>
              </div>

              {/* SUCURSALES (Aparece SOLO cuando es tipo SUC y YA se seleccionó el Distrito) */}
              {form.tipoEnvio === "SUC" && form.distrito && (
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-sm font-bold text-[#0f2d5c] mb-3 flex items-center gap-2">
                    <FaMapMarkerAlt /> Seleccione la sucursal de destino *
                  </label>
                  
                  {loadingSucursales ? (
                    <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-[#0f2d5c] font-semibold bg-white rounded-xl border border-gray-200">
                      <FaSpinner className="animate-spin text-xl" />
                      <span>Cargando sucursales disponibles...</span>
                    </div>
                  ) : sucursales.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No hay sucursales disponibles para este cantón. Seleccione otro cantón.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {sucursales.map(suc => (
                        <label 
                          key={suc.codigo} 
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer bg-white ${
                            form.codigoSucursal === suc.codigo ? "border-[#0f2d5c] bg-blue-50/30 shadow-md" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="codigoSucursal"
                            value={suc.codigo}
                            checked={form.codigoSucursal === suc.codigo}
                            onChange={(e) => setForm(prev => ({ ...prev, codigoSucursal: e.target.value }))}
                            className="mt-1 text-[#0f2d5c]"
                          />
                          <div className="text-xs text-gray-700 space-y-1">
                            <p className="font-bold text-[#0f2d5c] text-sm">{suc.nombre}</p>
                            <p><strong>Dirección:</strong> {suc.direccion}</p>
                            <p><strong>Horario:</strong> {suc.horario}</p>
                            <p className="text-blue-600 font-semibold">Código de sucursal: {suc.codigo}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CODIGO POSTAL */}
              <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Código postal
                  </label>
                  <input
                      type="text"
                      name="codigoPostal"
                      value={form.codigoPostal}
                      readOnly
                      className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md outline-none text-sm text-gray-500 cursor-not-allowed"
                  />
              </div>

              {/* DIRECCION EXACTA (Solo si es a Domicilio) */}
              {form.tipoEnvio === "DOM" && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Señas exactas de dirección del destinatario *
                    </label>
                    <textarea
                        name="direccion"
                        value={form.direccion}
                        onChange={handleChange}
                        required={form.tipoEnvio === "DOM"}
                        rows={4}
                        placeholder="De la esquina 100 metros norte..."
                        className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm resize-none"
                    />
                </div>
              )}
          </div>

          {/* BOTON DE CREAR GUIA */}
          <div className="flex justify-end pt-4">
              <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#2ecc71] hover:bg-[#27ae60] text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70 cursor-pointer shadow-lg flex items-center gap-2"
              >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin" /> Procesando guía...
                    </>
                  ) : (
                    "Crear guía oficial"
                  )}
              </button>
          </div>
        </form>
      </div>

      {/* TABLA HISTÓRICA DE GUÍAS CON FILTRO POR DÍA, PAGINADO 10 EN 10 Y BASURERO */}
      <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-[#0f2d5c] font-bold text-lg flex items-center gap-2">
            <FaPrint /> Historial de guías por día
          </h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <FaCalendarAlt className="text-[#0f2d5c]" />
              <span className="text-xs font-semibold text-gray-600">Filtrar fecha:</span>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="bg-transparent text-sm font-semibold text-[#0f2d5c] outline-none cursor-pointer"
              />
            </div>

            {guiasFiltradasPorDia.length > 0 && (
              <button
                type="button"
                onClick={handleVaciarDia}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Borrar todas las guías de este día"
              >
                <FaTrash /> Vaciar día
              </button>
            )}
          </div>
        </div>

        {guiasFiltradasPorDia.length === 0 ? (
          <p className="text-gray-500 text-sm italic text-center py-6">
            No hay guías registradas para la fecha seleccionada ({fechaFiltro}).
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                    <th className="p-3">N° de Guía</th>
                    <th className="p-3">Destinatario</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {guiasPaginadas.map((item, index) => (
                    <tr key={item._id || item.idUnico || index} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="p-3 font-bold text-[#0f2d5c]">{item.enviold}</td>
                      <td className="p-3 font-semibold">{item.nombre}</td>
                      <td className="p-3 text-gray-600">{item.telefono}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${item.tipoEnvio === 'Domicilio' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {item.tipoEnvio}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{item.fechaFormateada}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReimprimir(item)}
                            className="bg-[#0f2d5c] hover:bg-blue-900 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FaPrint /> Reimprimir PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirDuplicar(item)}
                            className="bg-[#0f2d5c] hover:bg-blue-900 text-white p-2 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Duplicar guía (mismo destinatario, otro contenido)"
                          >
                            <FaCopy />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarGuia(item)}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Eliminar guía del historial"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN (10 EN 10) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100 text-xs text-gray-600">
              <span>
                Mostrando <strong>{indiceInicio + 1}</strong> a{" "}
                <strong>{Math.min(indiceInicio + guiasPorPagina, guiasFiltradasPorDia.length)}</strong> de{" "}
                <strong>{guiasFiltradasPorDia.length}</strong> guías
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-[#0f2d5c] text-white hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                >
                  <FaChevronLeft /> Anterior
                </button>
                <span className="px-3 py-1.5 font-bold text-[#0f2d5c]">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-[#0f2d5c] text-white hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                >
                  Siguiente <FaChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 📋 MODAL DUPLICAR GUÍA */}
      {guiaADuplicar && (
        <ModalShell
          onClose={() => setGuiaADuplicar(null)}
          dismissible={!isDuplicando}
          size="sm"
          icon={FaCopy}
          eyebrow="Correos CR"
          title="Duplicar guía"
          subtitle={`${guiaADuplicar.nombre} · ${guiaADuplicar.tipoEnvio}`}
          footer={(close) => (
            <>
              <button type="button" className="md-btn is-ghost" onClick={close} disabled={isDuplicando}>
                Cancelar
              </button>
              <button type="button" className="md-btn is-primary" onClick={() => handleDuplicarGuia(close)} disabled={isDuplicando}>
                {isDuplicando ? "Generando..." : "Generar guía"}
              </button>
            </>
          )}
        >
          {(close) => (
            <form onSubmit={(e) => { e.preventDefault(); handleDuplicarGuia(close); }}>
              <div className="md-field">
                <label className="md-label" htmlFor="detalle-duplicado">¿Qué querés poner en el detalle del envío?</label>
                <input
                  id="detalle-duplicado"
                  className="md-input"
                  value={detalleDuplicado}
                  onChange={(e) => setDetalleDuplicado(e.target.value)}
                  placeholder="Ej: Paquete, Camiseta..."
                  autoFocus
                  disabled={isDuplicando}
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                El resto de la guía (destinatario, teléfono y dirección) queda igual:{" "}
                <span className="text-gray-700">{guiaADuplicar.direccion}</span>
              </p>
            </form>
          )}
        </ModalShell>
      )}
    </div>
  );
}