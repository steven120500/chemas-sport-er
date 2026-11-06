import React, { useState, useEffect } from "react";
import { FaUser, FaBoxOpen, FaSearch, FaPrint, FaMapMarkerAlt, FaCalendarAlt } from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function GuiasCorreos() {
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  
  const [loadingGeos, setLoadingGeos] = useState(false);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);

  // Historial persistente en localStorage para que no se borre al refrescar
  const [historialGuias, setHistorialGuias] = useState(() => {
    try {
      const saved = localStorage.getItem("chema_historial_guias");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);

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

  // Guardar en localStorage cada vez que cambie el historial
  useEffect(() => {
    try {
      localStorage.setItem("chema_historial_guias", JSON.stringify(historialGuias));
    } catch (e) {
      console.error("Error al guardar en localStorage", e);
    }
  }, [historialGuias]);

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
        setForm(prev => ({ ...prev, canton: "", distrito: "", codigoPostal: "", codigoSucursal: "" }));
        setDistritos([]);
        setSucursales([]);
      } catch (error) {
        console.error("Error al cargar cantones", error);
      } finally {
        setLoadingGeos(false);
      }
    };
    fetchCantones();
  }, [form.provincia]);

  // 3. Cargar Distritos y Sucursales al elegir Cantón
  useEffect(() => {
    if (!form.provincia || !form.canton) return;
    const fetchGeosYSucursales = async () => {
      setLoadingGeos(true);
      setLoadingSucursales(true);
      try {
        const resDist = await fetch(`${API_BASE}/api/correos/distritos/${form.provincia}/${form.canton}`);
        const dataDist = await resDist.json();
        if (dataDist.exito && dataDist.datos) setDistritos(dataDist.datos);

        const resSuc = await fetch(`${API_BASE}/api/correos/sucursales/${form.provincia}/${form.canton}`);
        const dataSuc = await resSuc.json();
        if (dataSuc.exito && dataSuc.datos) {
          setSucursales(dataSuc.datos);
        } else {
          setSucursales([]);
        }

        setForm(prev => ({ ...prev, distrito: "", codigoPostal: "", codigoSucursal: "" }));
      } catch (error) {
        console.error("Error al cargar datos geográficos o sucursales", error);
      } finally {
        setLoadingGeos(false);
        setLoadingSucursales(false);
      }
    };
    fetchGeosYSucursales();
  }, [form.canton, form.provincia]);

  // 4. Actualizar Código Postal automáticamente
  useEffect(() => {
      if(!form.distrito) return;
      const distritoSeleccionado = distritos.find(d => d.codigo === form.distrito);
      if(distritoSeleccionado) {
          setForm(prev => ({...prev, codigoPostal: distritoSeleccionado.codigoPostal || ""}))
      }
  }, [form.distrito, distritos]);

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
      const payload = {
        destNombre: form.nombre.trim(),
        destDireccion: form.tipoEnvio === "DOM" ? form.direccion.trim() : "Retiro en sucursal",
        destTelefono: form.telefono,
        destZip: form.codigoPostal || "10101",
        peso: 500, 
        observaciones: form.detalleEnvio.trim(),
        tipoDestino: form.tipoEnvio,
        codigoSucursal: form.tipoEnvio === "SUC" ? form.codigoSucursal : ""
      };

      const res = await fetch(`${API_BASE}/api/correos/generar-guia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok && data.exito) {
        toastHOT.success("¡Guía generada con éxito!", { id: toastId });
        
        const numeroGuia = data.datos?.enviold || data.datos?.envioId || "Guia_Envio";
        
        if (data.datos && data.datos.pdfBase64) {
          const linkSource = `data:application/pdf;base64,${data.datos.pdfBase64}`;
          const downloadLink = document.createElement("a");
          downloadLink.href = linkSource;
          downloadLink.download = `${numeroGuia}.pdf`;
          downloadLink.click();
        }

        const fechaHoy = new Date().toISOString().split('T')[0];

        const nuevaGuiaItem = {
          enviold: numeroGuia,
          nombre: form.nombre,
          telefono: form.telefono,
          tipoEnvio: form.tipoEnvio === "DOM" ? "Domicilio" : "Sucursal",
          fechaYyyyMmDd: fechaHoy,
          fechaFormateada: new Date().toLocaleDateString(),
          pdfBase64: data.datos?.pdfBase64
        };
        setHistorialGuias(prev => [nuevaGuiaItem, ...prev]);
        setFechaFiltro(fechaHoy);
        
        setForm(prev => ({ 
            ...prev, 
            detalleEnvio: "", 
            nombre: "", 
            telefono: "", 
            direccion: "",
            numeroIdentificacion: "",
            codigoSucursal: "" 
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

  const handleReimprimir = (guiaItem) => {
    if (!guiaItem.pdfBase64) {
      toastHOT.error("El archivo PDF no está disponible para reimpresión.");
      return;
    }
    const linkSource = `data:application/pdf;base64,${guiaItem.pdfBase64}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = linkSource;
    downloadLink.download = `${guiaItem.enviold}.pdf`;
    downloadLink.click();
    toastHOT.success(`Reimprimiendo guía ${guiaItem.enviold}`);
  };

  const guiasFiltradasPorDia = historialGuias.filter(item => item.fechaYyyyMmDd === fechaFiltro);

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

              {/* SUCURSALES (Si el tipo de envío es SUC) */}
              {form.tipoEnvio === "SUC" && (
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-sm font-bold text-[#0f2d5c] mb-3 flex items-center gap-2">
                    <FaMapMarkerAlt /> Seleccione la sucursal de destino * {loadingSucursales && "Cargando sucursales..."}
                  </label>
                  
                  {sucursales.length === 0 && !loadingSucursales && (
                    <p className="text-sm text-gray-500 italic">No hay sucursales disponibles para este cantón. Seleccione otro cantón.</p>
                  )}

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
                  className="bg-[#2ecc71] hover:bg-[#27ae60] text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70 cursor-pointer shadow-lg"
              >
                  {isSubmitting ? "Procesando guía..." : "Crear guía oficial"}
              </button>
          </div>
        </form>
      </div>

      {/* TABLA HISTÓRICA DE GUÍAS CON FILTRO POR DÍA */}
      <div className="bg-white rounded-3xl border-2 border-zinc-200/90 p-6 sm:p-10 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-[#0f2d5c] font-bold text-lg flex items-center gap-2">
            <FaPrint /> Historial de guías por día
          </h3>
          
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
        </div>

        {guiasFiltradasPorDia.length === 0 ? (
          <p className="text-gray-500 text-sm italic text-center py-6">
            No hay guías registradas para la fecha seleccionada ({fechaFiltro}).
          </p>
        ) : (
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
                {guiasFiltradasPorDia.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="p-3 font-bold text-[#0f2d5c]">{item.enviold}</td>
                    <td className="p-3 font-semibold">{item.nombre}</td>
                    <td className="p-3 text-gray-600">{item.telefono}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${item.tipoEnvio === 'Domicilio' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.tipoEnvio}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{item.fechaFormateada}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleReimprimir(item)}
                        className="bg-[#0f2d5c] hover:bg-blue-900 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 mx-auto transition-colors cursor-pointer"
                      >
                        <FaPrint /> Reimprimir PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}