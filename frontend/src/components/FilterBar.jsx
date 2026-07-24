import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSlidersH, FaTimes, FaCheck, FaChevronDown, FaTrashAlt } from "react-icons/fa";

const categories = [
  { label: "Todos", value: "" },
  { label: "Nuevo", value: "Nuevo" },         
  { label: "Nacional", value: "Nacional" },
  { label: "Mundial 2026", value: "Mundial 2026" }, 
  { label: "Populares", value: "Populares" }, 
  { label: "Ofertas", value: "Ofertas" },     
  { label: "Player", value: "Player" },
  { label: "Fan", value: "Fan" },
  { label: "Retro", value: "Retro" },
  { label: "Balón", value: "Balón" }, 
  { label: "Mujer", value: "Mujer" },
  { label: "Niño", value: "Niño" },
  { label: "Abrigos", value: "Abrigos" },
  { label: "F1", value: "F1" },
  { label: "NBA", value: "NBA" },
  { label: "MLB", value: "MLB" },
  { label: "NFL", value: "NFL" },
];

const tallasAdulto = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const tallasNino = [
  { size: "16", label: "16 (Talla 2)" },
  { size: "18", label: "18 (Talla 4)" },
  { size: "20", label: "20 (Talla 6)" },
  { size: "22", label: "22 (Talla 8)" },
  { size: "24", label: "24 (Talla 10)" },
  { size: "26", label: "26 (Talla 12)" },
  { size: "28", label: "28 (Talla 14/16)" },
];

export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterSizes = [],
  setFilterSizes,
  onToggleTallas,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(""); 

  // Detecta si hay algún filtro activo (categoría distinta de vacío o tallas seleccionadas)
  const hasActiveFilters = (filterType !== "") || (filterSizes && filterSizes.length > 0);

  // Función para limpiar los filtros
  const handleClearFilters = () => {
    if (setFilterType) setFilterType("");
    if (setFilterSizes) setFilterSizes([]);
  };

  return (
    <div className="w-full flex flex-col gap-4 pt-3 mb-6 mt-4 px-4 max-w-4xl mx-auto">
      
      {/* 1. BARRA DE BÚSQUEDA */}
      <motion.div
        className="w-full flex justify-center"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative w-full max-w-md">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar camiseta..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-100/90 border border-transparent rounded-full text-sm font-medium focus:outline-none focus:bg-white focus:border-black transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </motion.div>

      {/* 2. BOTÓN "FILTRAR Y ORDENAR" */}
      <motion.div 
        className="w-full flex justify-center"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <button
          onClick={() => {
            setIsOpen(true);
            onToggleTallas?.();
          }}
          className="flex items-center gap-2.5 px-6 py-3.5 bg-zinc-900 text-white rounded-full hover:bg-black transition-all shadow-md text-xs font-bold tracking-wider uppercase active:scale-95"
        >
          <FaSlidersH className="text-xs text-zinc-400" />
          Filtrar
        </button>
      </motion.div>

      {/* 3. MODAL UBICADO EXACTAMENTE EN EL CENTRO PERO ABAJO */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-end p-0 sm:pb-8 pointer-events-none">
            
            {/* Backdrop oscuro con blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            <motion.div
              initial={{ y: "100%", opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative w-full sm:max-w-4xl bg-white rounded-t-[32px] sm:rounded-2xl h-[65vh] sm:h-auto sm:max-h-[75vh] shadow-2xl p-6 z-10 flex flex-col justify-between overflow-y-auto font-sans pointer-events-auto"
            >
              <div>
                {/* Cabecera con título y botón de cerrar (Ya no necesitamos el botón borrar de arriba) */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-6">
                  <h3 className="text-lg font-black text-black uppercase tracking-tight">Filtrar y ordenar</h3>
                  
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                {/* Acordeones limpios */}
                <div className="flex flex-col divide-y divide-zinc-100">
                  
                  {/* Acordeón de Versión / Categoría */}
                  <div className="py-4">
                    <button
                      onClick={() => setActiveAccordion(activeAccordion === "categoria" ? "" : "categoria")}
                      className="w-full flex text-black items-center justify-between text-sm font-bold text-zinc-800 uppercase tracking-wide py-2 cursor-pointer bg-transparent border-0"
                    >
                      <span>Versión / Categoría</span>
                      <FaChevronDown className={`text-xs text-zinc-500 transition-transform duration-300 ${activeAccordion === "categoria" ? "rotate-180" : ""}`} />
                    </button>

                    {activeAccordion === "categoria" && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 pb-2"
                      >
                        {categories.map((cat) => {
                          const isActive = filterType === cat.value;
                          return (
                            <button
                              key={cat.label}
                              onClick={() => setFilterType(cat.value)}
                              className={`
                                flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-none cursor-pointer
                                ${isActive 
                                  ? 'bg-black text-white shadow-sm' 
                                  : 'bg-zinc-50 text-zinc-700 border border-zinc-200'}
                              `}
                            >
                              <span>{cat.label}</span>
                              {isActive && <FaCheck size={10} className="text-white" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  {/* Acordeón de Talla */}
                  <div className="py-4">
                    <button
                      onClick={() => setActiveAccordion(activeAccordion === "talla" ? "" : "talla")}
                      className="w-full flex items-center text-black justify-between text-sm font-bold text-zinc-800 uppercase tracking-wide py-2 cursor-pointer bg-transparent border-0"
                    >
                      <span>Talla</span>
                      <FaChevronDown className={`text-xs text-zinc-500 transition-transform duration-300 ${activeAccordion === "talla" ? "rotate-180" : ""}`} />
                    </button>

                    {activeAccordion === "talla" && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-4 pt-3 pb-2"
                      >
                        {/* Tallas Adulto */}
                        <div>
                          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Adulto</p>
                          <div className="flex flex-wrap gap-1.5">
                            {tallasAdulto.map((size) => {
                              const isActive = filterSizes?.includes(size);
                              return (
                                <button
                                  key={size}
                                  onClick={() => {
                                    if (setFilterSizes) {
                                      setFilterSizes(prev => 
                                        prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                                      );
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-none border cursor-pointer ${
                                    isActive 
                                      ? "bg-black text-white border-black shadow-sm" 
                                      : "bg-zinc-50 text-zinc-700 border-zinc-200"
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Tallas Niño */}
                        <div>
                          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Niño</p>
                          <div className="flex flex-wrap gap-1.5">
                            {tallasNino.map(({ size, label }) => {
                              const isActive = filterSizes?.includes(size);
                              return (
                                <button
                                  key={size}
                                  onClick={() => {
                                    if (setFilterSizes) {
                                      setFilterSizes(prev => 
                                        prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                                      );
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-none border cursor-pointer ${
                                    isActive 
                                      ? "bg-black text-white border-black shadow-sm" 
                                      : "bg-zinc-50 text-zinc-700 border-zinc-200"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </motion.div>
                    )}
                  </div>

                </div>
              </div>

              {/* Botón Inferior Fijo de Aplicar */}
              <div className="pt-4 border-t border-zinc-100 mt-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm tracking-wider uppercase shadow-xl transition-none cursor-pointer"
                >
                  Aplicar filtros
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

  
      <AnimatePresence>
        {hasActiveFilters && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed sm:bottom-20 bottom-16 left-0 right-0 z-50 flex justify-center items-center pointer-events-none"
          >
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-[0_10px_25px_-5px_rgba(220,38,38,0.6)] border-2 border-white/30 active:scale-95 transition-transform cursor-pointer pointer-events-auto"
            >
              <FaTrashAlt size={10} />
              <span>Borrar filtros</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}