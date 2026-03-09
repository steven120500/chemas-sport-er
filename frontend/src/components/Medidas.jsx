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
    // 🧱 capa raíz con z-index altísimo + scroll general si hace falta
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop que bloquea la UI detrás */}
      <div
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Caja del modal */}
      <div className="mt-10 mb-16 fixed inset-0 z-50 bg-black/40 flex items-center justify-center py-6">
        <div className="relative bg-white pt-15 p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400">
          {/* Cerrar arriba-derecha */}
          <button
            onClick={onClose}
            className="absolute top-11 ml-4 right-3 p-2 rounded bg-black text-white hover:bg-gray-800"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <FaTimes size={24} />
          </button>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b">
            <h3 className="text-lg sm:text-xl font-semibold text-center">
              Guía de Medidas
            </h3>
          </div>

          {/* Body con scroll propio */}
          <div className="p-5 max-h-[85vh] overflow-y-auto">
            {sections.map(({ key, label, img }) => (
              <div key={key} className="mb-8 last:mb-0">
                <h4 className="text-base sm:text-lg font-bold text-center mb-3">{label}</h4>
                <div className="w-full flex justify-center">
                  <img
                    src={img}
                    alt={`Guía de medidas ${label}`}
                    className="max-h-[70vh] max-w-full object-contain rounded-md shadow"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Portal al body para evitar stacking contexts de la app
  return createPortal(modal, document.body);
}