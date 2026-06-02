// src/components/Medidas.jsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

// 🔽 importa tus PNG ya colocados en src/assets
import fanImg      from "../assets/Fan.png";
import playerImg   from "../assets/Player.png";
import ninoImg     from "../assets/Niño.png";
import mujerImg    from "../assets/Mujer.png";
import nacionalImg from "../assets/Nacional.png";
import abrigosImg  from "../assets/Abrigos.png";
import retroImg    from "../assets/Retro.png";
import f1Img       from "../assets/F1.png";
import nbaImg      from "../assets/NBA.png";
import mlbImg      from "../assets/MLB.png";
import nflImg      from "../assets/NFL.png";

export default function Medidas({ open, onClose, currentType = "Todos" }) {
  if (!open) return null;

  // Bloquea el scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const CATALOG = [
    { key: "Player",   label: "Player",   img: playerImg },
    { key: "Fan",      label: "Fan",      img: fanImg },
    { key: "Niño",     label: "Niño",     img: ninoImg },
    { key: "Nacional", label: "Nacional", img: nacionalImg },
    { key: "Retro",    label: "Retro",    img: retroImg },
  ];

  const sections = currentType && currentType !== "Todos"
    ? CATALOG.filter(s => s.key === currentType && s.img)
    : CATALOG.filter(s => s.img);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-10 sm:p-6">
      
      {/* 🔥 FONDO DIFUMINADO PREMIUM 🔥 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* 🔥 CAJA DEL MODAL (Limpia y Redondeada) 🔥 */}
      <div className="relative bg-white p-6 sm:p-8 rounded-3xl shadow-2xl max-w-lg w-full max-h-full flex flex-col z-10 animate-fade-in-up">
        
        {/* 🔥 BOTÓN DE CERRAR MINIMALISTA 🔥 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={18} />
        </button>

        {/* 🔥 ENCABEZADO ELITE 🔥 */}
        <div className="text-center mb-6 pt-2">
          <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-3 shadow-sm">
            Guía de Tallas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">
            Encuentra tu medida
          </h2>
        </div>

        {/* 🔥 BODY CON SCROLL INTERNO (Imágenes enmarcadas) 🔥 */}
        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-2 space-y-6 pb-4">
          {sections.length > 0 ? (
            sections.map(({ key, label, img }) => (
              <div key={key} className="flex flex-col items-center bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
                  {label}
                </h4>
                <img
                  src={img}
                  alt={`Guía de medidas ${label}`}
                  className="w-full h-auto object-contain rounded-xl drop-shadow-md"
                />
              </div>
            ))
          ) : (
             <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
               <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay guía disponible para esta categoría</p>
             </div>
          )}
        </div>
      </div>

      {/* 🔥 ANIMACIÓN DE ENTRADA SUAVE 🔥 */}
      <style>{`
        @keyframes fadeInUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );

  // Portal al body para evitar conflictos de z-index
  return createPortal(modal, document.body);
}