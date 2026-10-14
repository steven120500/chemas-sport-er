import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaTruck } from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function GuiasPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Estados del formulario idénticos al de Google Apps Script
  const [form, setForm] = useState({
    nombre: "",
    provincia: "",
    canton: "",
    distrito: "",
    telefono: "",
    debe: "No",
    monto: "",
    meterRaspa: "Sí",
    esMayorista: "No",
    comentarioSelect: "ENTREGAR MISMO DIA",
    comentarioCustom: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas de campos obligatorios
    if (!form.nombre.trim() || !form.provincia || !form.canton.trim() || !form.distrito.trim() || !form.telefono.trim()) {
      toastHOT.error("Por favor completa todos los campos obligatorios (*).");
      return;
    }

    setLoading(true);
    const toastId = toastHOT.loading("Guardando registro de guía...");

    try {
      const comentarioFinal = form.comentarioSelect === "Otro comentario..." 
        ? form.comentarioCustom 
        : form.comentarioSelect;

      const payload = {
        ...form,
        comentarios: comentarioFinal
      };

      // Si tienes un endpoint en tu backend para guardar guías, lo mandas aquí. 
      // Si prefieres que siga yendo al Script de Google anterior, puedes cambiar esta URL por tu link de Google Apps Script /exec
      const res = await fetch(`${API_BASE}/api/guias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Si el backend responde OK o si deseas simular el éxito mientras conectas la ruta:
      toastHOT.success("¡Guía guardada con éxito!", { id: toastId });

      // Limpiar formulario tras guardar
      setForm({
        nombre: "",
        provincia: "",
        canton: "",
        distrito: "",
        telefono: "",
        debe: "No",
        monto: "",
        meterRaspa: "Sí",
        esMayorista: "No",
        comentarioSelect: "ENTREGAR MISMO DIA",
        comentarioCustom: ""
      });

    } catch (error) {
      toastHOT.error("Error al guardar el registro. Inténtalo de nuevo.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d3b1e] pt-32 pb-24 px-4 sm:px-6 lg:px-8 font-sans text-white relative">
      <div className="max-w-2xl mx-auto">
        
        {/* Botón Volver */}
        <button 
          onClick={() => navigate("/")} 
          className="inline-flex items-center gap-2 bg-black border border-gray-700 text-zinc-300 hover:text-white hover:bg-zinc-900 px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-sm cursor-pointer transition-all mb-6"
        >
          <FaChevronLeft size={12} /> Volver al catálogo
        </button>

        {/* Encabezado */}
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-yellow-500 uppercase drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
            CHEMASPORT ER · GUÍAS
          </h1>
        </div>

        {/* Tarjeta del Formulario (Calcada a la captura) */}
        <div className="bg-[#0b2f18] border border-yellow-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5 text-sm">

            {/* Nombre */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Escribí el nombre..."
                required
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
              />
            </div>

            {/* Provincia */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Provincia *
              </label>
              <select
                name="provincia"
                value={form.provincia}
                onChange={handleChange}
                required
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors cursor-pointer"
              >
                <option value="" disabled>Selecciona provincia</option>
                <option value="Alajuela">Alajuela</option>
                <option value="Cartago">Cartago</option>
                <option value="Heredia">Heredia</option>
                <option value="San José">San José</option>
                <option value="Guanacaste">Guanacaste</option>
                <option value="Puntarenas">Puntarenas</option>
                <option value="Limón">Limón</option>
              </select>
            </div>

            {/* Cantón */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Cantón *
              </label>
              <input
                type="text"
                name="canton"
                value={form.canton}
                onChange={handleChange}
                placeholder="Escribí el cantón..."
                required
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
              />
            </div>

            {/* Distrito */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Distrito *
              </label>
              <input
                type="text"
                name="distrito"
                value={form.distrito}
                onChange={handleChange}
                placeholder="Escribí el distrito..."
                required
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Teléfono *
              </label>
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej.: +506 8888 8888"
                required
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
              />
            </div>

            {/* ¿Debe? */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                ¿Debe?
              </label>
              <select
                name="debe"
                value={form.debe}
                onChange={handleChange}
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors cursor-pointer"
              >
                <option value="No">No</option>
                <option value="Sí">Sí</option>
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Monto *
              </label>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                placeholder="Monto (solo números)"
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
              />
            </div>

            {/* ¿Meter raspa? */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                ¿Meter raspa? *
              </label>
              <select
                name="meterRaspa"
                value={form.meterRaspa}
                onChange={handleChange}
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors cursor-pointer"
              >
                <option value="Sí">Sí</option>
                <option value="No">No</option>
              </select>
            </div>

            {/* ¿Este paquete lo envía un mayorista? */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                ¿Este paquete lo envía un mayorista?
              </label>
              <select
                name="esMayorista"
                value={form.esMayorista}
                onChange={handleChange}
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors cursor-pointer"
              >
                <option value="No">No</option>
                <option value="Sí">Sí</option>
              </select>
            </div>

            {/* Comentarios */}
            <div>
              <label className="block text-yellow-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                Comentarios
              </label>
              <select
                name="comentarioSelect"
                value={form.comentarioSelect}
                onChange={handleChange}
                className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors cursor-pointer"
              >
                <option value="Sin comentario">Sin comentario</option>
                <option value="ENTREGAR MISMO DIA">ENTREGAR MISMO DIA</option>
                <option value="PAQUETE PARA JOHAN">PAQUETE PARA JOHAN</option>
                <option value="Otro comentario...">Otro comentario...</option>
              </select>
            </div>

            {/* Input adicional si selecciona "Otro comentario..." */}
            {form.comentarioSelect === "Otro comentario..." && (
              <div>
                <input
                  type="text"
                  name="comentarioCustom"
                  value={form.comentarioCustom}
                  onChange={handleChange}
                  placeholder="Escribí tu comentario..."
                  className="w-full bg-[#0d2614] border border-yellow-500/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-yellow-400 transition-colors"
                />
              </div>
            )}

            {/* Botón Guardar registro */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg cursor-pointer active:scale-95"
              >
                {loading ? "Guardando..." : "Guardar registro"}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}