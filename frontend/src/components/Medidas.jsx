import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

export default function Medidas({ open, onClose, currentType = "Todos" }) {
  const [showAll, setShowAll] = useState(false);

  // Bloquea el scroll de la página de atrás cuando se abre el modal
  useEffect(() => {
    if (open) {
      setShowAll(false);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open) return null;

  /* =========================================================================
     🔥 CATÁLOGO DE MEDIDAS 🔥
  ========================================================================= */
  const CATALOG = [
    // --- GRUPO: NIÑO ---
    { id: "nino-futbol", tags: ["Niño", "Todos"], label: "Fútbol Niño", img: "/medidas/Nino.jpeg", subtitle: "Corte estándar para niños" },
    { id: "nino-nba", tags: ["Niño", "Todos"], label: "NBA Niño", img: "/medidas/NBA_Nino.jpeg", subtitle: "Camisetas de baloncesto para niños" },
    { id: "nino-nacional", tags: ["Niño", "Nacional", "Todos"], label: "Nacional Niño", img: "/medidas/Nacional_Nino.jpeg", subtitle: "Selección Nacional para niños" },
    { id: "mamelucos", tags: ["Niño", "Todos"], label: "Mamelucos", img: "/medidas/Mamelucos.jpeg", subtitle: "Tallas para bebés" },

    // --- GRUPO: MUJER ---
    { id: "mujer", tags: ["Mujer", "Todos"], label: "Versión Mujer", img: "/medidas/Mujer.jpeg", subtitle: "Corte con silueta femenina" },
    { id: "mujer-nacional", tags: ["Mujer", "Nacional", "Todos"], label: "Nacional Mujer", img: "/medidas/Nacional_Mujer.jpeg", subtitle: "Selección Nacional corte femenino" },

    // --- GRUPOS ESPECÍFICOS ---
    { id: "f1", tags: ["F1", "Todos"], label: "Fórmula 1", img: "/medidas/F1.jpeg", subtitle: "Corte casual F1" },
    { id: "mlb", tags: ["MLB", "Todos"], label: "Béisbol MLB", img: "/medidas/MLB.jpeg", subtitle: "Camisolas de béisbol" },
    { id: "nfl", tags: ["NFL", "Todos"], label: "Fútbol Americano NFL", img: "/medidas/NFL.jpeg", subtitle: "Corte estándar NFL" },
    { id: "nba", tags: ["NBA", "Todos"], label: "Baloncesto NBA (Adulto)", img: "/medidas/NBA.jpeg", subtitle: "Corte estándar baloncesto" },

    // --- GRUPO: ABRIGOS Y CONJUNTOS ---
    { id: "abrigo-full", tags: ["Abrigos", "Conjuntos", "Todos"], label: "Abrigo Full Zip", img: "/medidas/Abrigo_Pantalon.jpeg", subtitle: "Chaqueta completa y pantalón" },
    { id: "abrigo-media", tags: ["Abrigos", "Conjuntos", "Todos"], label: "Conjunto Media Cremallera", img: "/medidas/AbrigoMedia_Pantalon.jpeg", subtitle: "Chaqueta de media cremallera y pantalón" },

    // --- VERSIONES ESTÁNDAR ---
    { id: "player", tags: ["Player", "Todos"], label: "Versión Player (Ajustada)", img: "/medidas/Player.jpeg", subtitle: "Corte más pegado al cuerpo." },
    { id: "fan", tags: ["Fan", "Todos"], label: "Versión Fan (Estándar)", img: "/medidas/Fan.jpeg", subtitle: "Corte recto y cómodo." },
    { id: "nacional", tags: ["Nacional", "Todos"], label: "Nacional Adulto", img: "/medidas/Nacional.jpeg", subtitle: "Selección Nacional estándar" },
    { id: "retro", tags: ["Retro", "Todos"], label: "Versión Retro", img: "/medidas/Retro.jpeg", subtitle: "Corte clásico holgado" },
  ];

  // Categorías que deben enseñar TODO el catálogo de medidas por defecto
  const SHOW_ALL_CATEGORIES = [
    "Todos",
    "Populares",
    "Nuevo",
    "Temp 26-27",
    "Temp26-27",
    "Mundial 2026",
    "Mundial 26",
    "Ofertas"
  ];

  const isFiltering = currentType && !SHOW_ALL_CATEGORIES.includes(currentType);
  const sections = (isFiltering && !showAll)
    ? CATALOG.filter((s) => s.tags.includes(currentType))
    : CATALOG;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      
      {/* 🔥 FONDO OSCURO SÓLIDO Y DIFUMINADO (Cierra al hacer clic afuera) 🔥 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 🔥 CAJA DEL MODAL CON ALTURA MÁXIMA ESTRICTA DE 85vh 🔥 */}
      <div
        style={{ maxHeight: "85vh" }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col z-10 overflow-hidden border border-gray-200 animate-fade-in-up"
      >
        {/* BOTÓN DE CERRAR */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors shadow-sm"
          title="Cerrar"
        >
          <FaTimes size={18} />
        </button>

        {/* ENCABEZADO FIJO ARRIBA */}
        <div className="text-center pt-6 pb-4 px-6 border-b border-gray-200 bg-white flex-shrink-0">
          <span className="inline-block bg-black text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-2 shadow-sm">
            Guía de Tallas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
            {(!showAll && isFiltering) ? `Medidas ${currentType}` : "Guía de Tallas"}
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Revisa las medidas para asegurar tu ajuste perfecto.
          </p>

          {/* BOTÓN "VER TODAS" */}
          {isFiltering && (
            <div className="mt-4">
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center justify-center px-6 py-2 text-xs font-black tracking-widest uppercase transition-colors duration-200 border-2 border-black rounded-full bg-black text-white hover:bg-gray-800 shadow-sm"
              >
                {showAll ? `Volver a solo ${currentType}` : "Ver todas las medidas"}
              </button>
            </div>
          )}
        </div>

        {/* 🔥 CUERPO CON SCROLL INTERNO OBLIGATORIO 🔥 */}
        <div
          style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          className="flex-1 p-4 sm:p-6 space-y-6 bg-gray-50"
        >
          {sections.length > 0 ? (
            sections.map(({ id, label, subtitle, img }) => (
              <div
                key={id}
                className="flex flex-col items-center bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* BARRA GRIS DE TÍTULO (Igual a tu foto de referencia) */}
                <div className="w-full bg-black py-3 px-4 text-center border-b border-gray-300">
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">
                    {label}
                  </h4>
                </div>

                {/* SUBTÍTULO */}
                {subtitle && (
                  <p className="text-xs text-gray-500 mt-3 px-4 text-center font-medium">
                    {subtitle}
                  </p>
                )}

                {/* IMAGEN SÓLIDA Y SIN TRANSPARENCIAS RARAS */}
                <div className="p-4 sm:p-6 w-full flex justify-center bg-white">
                  <img
                    src={img}
                    alt={`Guía de medidas ${label}`}
                    className="w-full h-auto object-contain rounded-xl shadow-sm"
                    onError={(e) => {
                      e.target.style.display = "none";
                      if (!e.target.parentElement.querySelector(".err-msg")) {
                        const msg = document.createElement("p");
                        msg.className = "err-msg text-red-500 text-xs font-bold py-6 text-center";
                        msg.innerText = "Imagen en mantenimiento";
                        e.target.parentElement.appendChild(msg);
                      }
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">
                No hay guía disponible para esta categoría
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ANIMACIÓN SUAVE */}
      <style>{`
        @keyframes fadeInUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUpModal 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );

  return createPortal(modal, document.body);
}