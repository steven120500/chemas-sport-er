import React, { useState, useEffect } from "react";
import { FaUser, FaMapMarkerAlt, FaBoxOpen, FaPlus, FaStickyNote, FaPhone, FaIdCard, FaBuilding, FaSearch } from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function GuiasCorreos() {
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [distritos, setDistritos] = useState([]);
  
  const [loadingGeos, setLoadingGeos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);

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
  });

  // 1. Cargar Provincias
  useEffect(() => {
    const fetchProvincias = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/correos/provincias`);
        const data = await res.json();
        if (data.exito && data.datos) setProvincias(data.datos);
      } catch (error) {
        console.error("Error al cargar provincias", error);
      }
    };
    fetchProvincias();
  }, []);

  // 2. Cargar Cantones al elegir Provincia
  useEffect(() => {
    if (!form.provincia) return;
    const fetchCantones = async () => {
      setLoadingGeos(true);
      try {
        const res = await fetch(`${API_BASE}/api/correos/cantones/${form.provincia}`);
        const data = await res.json();
        if (data.exito && data.datos) setCantones(data.datos);
        setForm(prev => ({ ...prev, canton: "", distrito: "", codigoPostal: "" }));
        setDistritos([]);
      } catch (error) {
        console.error("Error al cargar cantones", error);
      } finally {
        setLoadingGeos(false);
      }
    };
    fetchCantones();
  }, [form.provincia]);

  // 3. Cargar Distritos al elegir Cantón
  useEffect(() => {
    if (!form.provincia || !form.canton) return;
    const fetchDistritos = async () => {
      setLoadingGeos(true);
      try {
        const res = await fetch(`${API_BASE}/api/correos/distritos/${form.provincia}/${form.canton}`);
        const data = await res.json();
        if (data.exito && data.datos) setDistritos(data.datos);
        setForm(prev => ({ ...prev, distrito: "", codigoPostal: "" }));
      } catch (error) {
        console.error("Error al cargar distritos", error);
      } finally {
        setLoadingGeos(false);
      }
    };
    fetchDistritos();
  }, [form.canton, form.provincia]);

  // 4. Actualizar Código Postal automáticamente
  useEffect(() => {
      if(!form.distrito) return;
      const distritoSeleccionado = distritos.find(d => d.codigo === form.distrito);
      if(distritoSeleccionado) {
          setForm(prev => ({...prev, codigoPostal: distritoSeleccionado.codigoPostal || ""}))
      }
  }, [form.distrito, distritos]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔥 NUEVO: Función para buscar nombre en Hacienda por número de Cédula
  const buscarNombrePorCedula = async () => {
    if (!form.numeroIdentificacion || form.numeroIdentificacion.length < 9) {
      toastHOT.error("Ingresa una cédula válida (9 o 10 dígitos) sin guiones.");
      return;
    }

    setIsSearchingCedula(true);
    const toastId = toastHOT.loading("Buscando cédula...");

    try {
      // API pública del Ministerio de Hacienda CR
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.detalleEnvio || !form.nombre || !form.telefono || !form.provincia || !form.canton || !form.distrito || !form.direccion) {
      toastHOT.error("Por favor completa todos los campos obligatorios (*).");
      return;
    }

    setIsSubmitting(true);
    const toastId = toastHOT.loading("Generando guía de Correos CR...");

    try {
      const telefonoLimpio = form.telefono.replace(/\D/g, "").slice(-8);

      const payload = {
        destNombre: form.nombre.trim(),
        destDireccion: form.direccion.trim(),
        destTelefono: telefonoLimpio,
        destZip: form.codigoPostal || "10101",
        peso: 500, // Valor interno requerido por la API de Correos
        observaciones: form.detalleEnvio.trim(),
        tipoDestino: form.tipoEnvio,
      };

      const res = await fetch(`${API_BASE}/api/correos/generar-guia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok && data.exito) {
        toastHOT.success("¡Guía generada con éxito!", { id: toastId });
        
        if (data.datos && data.datos.pdfBase64) {
          const linkSource = `data:application/pdf;base64,${data.datos.pdfBase64}`;
          const downloadLink = document.createElement("a");
          downloadLink.href = linkSource;
          downloadLink.download = `Guia_CCR_${data.datos.enviold || "Envio"}.pdf`;
          downloadLink.click();
        }
        
        // Reset parcial del formulario
        setForm(prev => ({ 
            ...prev, 
            detalleEnvio: "", 
            nombre: "", 
            telefono: "", 
            direccion: "",
            numeroIdentificacion: "" 
        }));
      } else {
        throw new Error(data.mensaje || "Error al generar la guía");
      }
    } catch (error) {
      console.error(error);
      toastHOT.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl mb-10">
      
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
            className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] focus:ring-1 focus:ring-[#0f2d5c] outline-none text-sm resize-none"
          />
        </div>

        {/* HEADER DATOS DEL DESTINATARIO */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
             <div className="flex items-center gap-2">
                <FaUser className="text-[#0f2d5c]" />
                <h3 className="text-[#0f2d5c] font-bold text-lg">Datos del destinatario</h3>
             </div>
             <button type="button" className="text-xs text-green-600 border border-green-600 rounded px-3 py-1 hover:bg-green-50">
                 Ocultar información del destinatario
             </button>
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
                      <FaSearch />
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
                    Teléfono *
                </label>
                <input
                    type="tel"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    required
                    maxLength="9"
                    className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm"
                />
            </div>
        </div>

        {/* TIPO DE ENVIO Y GEOGRAFIA */}
        <div className="border-t border-gray-200 pt-6">
            <div className="w-full md:w-1/2 mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Envío
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
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Provincia *
                    </label>
                    <select
                        name="provincia"
                        value={form.provincia}
                        onChange={handleChange}
                        required
                        className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm"
                    >
                        <option value="" disabled>Seleccione...</option>
                        {provincias.map(p => (
                            <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cantón * {loadingGeos && "..."}
                    </label>
                    <select
                        name="canton"
                        value={form.canton}
                        onChange={handleChange}
                        required
                        disabled={!form.provincia || cantones.length === 0}
                        className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm disabled:bg-gray-100"
                    >
                        <option value="" disabled>Seleccione...</option>
                        {cantones.map(c => (
                            <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Distrito * {loadingGeos && "..."}
                    </label>
                    <select
                        name="distrito"
                        value={form.distrito}
                        onChange={handleChange}
                        required
                        disabled={!form.canton || distritos.length === 0}
                        className="w-full p-3 bg-white border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm disabled:bg-gray-100"
                    >
                        <option value="" disabled>Seleccione...</option>
                        {distritos.map(d => (
                            <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

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

            {/* DIRECCION EXACTA */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Señas exactas de dirección del destinatario *
                </label>
                <textarea
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-md focus:border-[#0f2d5c] outline-none text-sm resize-none"
                />
            </div>
        </div>

        {/* BOTONES FINALES */}
        <div className="flex justify-between items-center pt-4">
            <button
                type="button"
                className="bg-[#0f2d5c] text-white px-6 py-2 rounded text-sm font-semibold hover:bg-blue-900 transition-colors cursor-pointer"
            >
                Ver mis guías
            </button>
            <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white px-8 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-70 cursor-pointer"
            >
                {isSubmitting ? "Procesando..." : "Crear guía"}
            </button>
        </div>
      </form>
    </div>
  );
}