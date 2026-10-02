import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCheck, FaChevronDown, FaTrashAlt } from "react-icons/fa";

const categories = [
  { label: "Todos", value: "" },
  { label: "Nuevo", value: "Nuevo" },         
  { label: "Nacional", value: "Nacional" },
  { label: "Mundial 2026", value: "Mundial 2026" }, 
  { label: "Temp 26-27", value: "Temp 26-27" }, 
  { label: "Populares", value: "Populares" }, 
  { label: "Ofertas", value: "Ofertas" },     
  { label: "Player", value: "Player" },
  { label: "Fan", value: "Fan" },
  { label: "Retro", value: "Retro" },
  { label: "Balón", value: "Balón" }, 
  { label: "Mujer", value: "Mujer" },
  { label: "Niño", value: "Niño" },
  { label: "Abrigos", value: "Abrigos" },
  { label: "Llaveros", value: "Llaveros" }, 
  { label: "NBA", value: "NBA" },
  { label: "MLB", value: "MLB" },
  { label: "NFL", value: "NFL" },
  { label: "F1", value: "F1" }, 
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
const tallasAccesorios = [
  { size: "U", label: "U (Talla Única)" } 
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
  const [localSearch, setLocalSearch] = useState(searchTerm || "");
  const [isScrolled, setIsScrolled] = useState(false);

  const hasActiveFilters = (filterType !== "") || (filterSizes && filterSizes.length > 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setLocalSearch(searchTerm || "");
  }, [searchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    if (setSearchTerm) {
      setSearchTerm(val);
    }
  };

  const handleClearFilters = () => {
    if (setFilterType) setFilterType("");
    if (setFilterSizes) setFilterSizes([]);
    setLocalSearch("");
    if (setSearchTerm) setSearchTerm("");
  };

  return (
    <>
      <div 
        className={`sticky top-0 z-40 w-full transition-all duration-300 md:static md:bg-transparent md:shadow-none md:border-none ${
          isScrolled ? "shadow-lg border-b border-yellow-900" : "bg-transparent shadow-sm border-b border-gray-800"
        }`}
        // 🔥 Forzamos fondo negro al hacer scroll para que no quede transparente
        style={isScrolled ? { backgroundColor: 'white' } : {}}
      >
        <div 
          className={`w-full max-w-4xl mx-auto px-4 flex flex-row gap-3 items-center md:flex-col md:gap-4 transition-all duration-300 ${
            isScrolled ? "py-2 md:pt-6 md:pb-0" : "py-3 md:pt-6 md:pb-0"
          }`}
        >
          
          <motion.div
            className="relative w-full max-w-md group flex-1 md:flex-none"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Buscador Oscuro */}
            <input
              type="text"
              placeholder="Buscar artículo..."
              value={localSearch}
              onChange={handleInputChange}
              className="w-full pl-5 pr-4 py-3 bg-black border border-gray-800 rounded-full text-sm font-medium focus:outline-none focus:bg-black focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all shadow-inner text-white placeholder-gray-500"
            />
          </motion.div>

          <motion.div 
            className="flex shrink-0 justify-center relative"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <button
              onClick={() => {
                setIsOpen(true);
                setActiveAccordion(""); 
                onToggleTallas?.();
              }}
              // Botón Filtrar Amarillo
              className="relative z-10 flex items-center justify-center px-6 py-3 md:py-3.5 bg-yellow-500 text-black rounded-full hover:bg-yellow-400 transition-all shadow-[0_0_10px_rgba(234,179,8,0.4)] text-xs font-black tracking-wider uppercase active:scale-95 cursor-pointer border border-yellow-400"
            >
              Filtrar
            </button>

            
          </motion.div>

        </div>
      </div>

      <div className="mb-4 md:mb-6"></div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-end p-0 sm:pb-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              // 🔥 SOLUCIÓN DEFINITIVA A LA TRANSPARENCIA: style={{ backgroundColor: '#0a0a0a' }} 🔥
              className="relative w-full sm:max-w-4xl border border-gray-800 rounded-t-[32px] sm:rounded-2xl h-[65vh] sm:h-auto sm:max-h-[75vh] shadow-[0_0_40px_rgba(234,179,8,0.2)] p-6 z-10 flex flex-col justify-between overflow-y-auto font-sans pointer-events-auto"
              style={{ backgroundColor: '#0a0a0a' }}
            >
              
              {/* 🔥 SANGRE CAYENDO DESDE EL TECHO DEL MENÚ 🔥 */}
              <img 
                src="/Sangre.png" 
                alt="Mancha de sangre" 
                className="absolute top-0 right-10 w-28 opacity-60 pointer-events-none z-0" 
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                  {/* Textos forzados a blanco para que se lean sobre el negro */}
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Filtrar y ordenar</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 rounded-full bg-gray-900 text-gray-400 hover:text-yellow-500 hover:bg-gray-800 transition-colors cursor-pointer border border-gray-800"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                <div className="flex flex-col divide-y divide-gray-800">
                  <div className="py-4">
                    <button
                      onClick={() => setActiveAccordion(activeAccordion === "categoria" ? "" : "categoria")}
                      className="w-full flex text-white items-center justify-between text-sm font-bold uppercase tracking-wide py-2 cursor-pointer bg-transparent border-0 hover:text-yellow-500 transition-colors"
                    >
                      <span>Versión / Categoría</span>
                      <FaChevronDown className={`text-xs text-gray-500 transition-transform duration-300 ${activeAccordion === "categoria" ? "rotate-180 text-yellow-500" : ""}`} />
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
                              onClick={() => {
                                setFilterType(cat.value);
                                setIsOpen(false);
                              }}
                              className={`
                                flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition-none cursor-pointer border
                                ${isActive 
                                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                                  : 'bg-black text-gray-400 border-gray-800 hover:border-yellow-900 hover:text-gray-200'}
                              `}
                            >
                              <span>{cat.label}</span>
                              {isActive && <FaCheck size={10} className="text-black" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  <div className="py-4">
                    <button
                      onClick={() => setActiveAccordion(activeAccordion === "talla" ? "" : "talla")}
                      className="w-full flex items-center text-white justify-between text-sm font-bold uppercase tracking-wide py-2 cursor-pointer bg-transparent border-0 hover:text-yellow-500 transition-colors"
                    >
                      <span>Talla</span>
                      <FaChevronDown className={`text-xs text-gray-500 transition-transform duration-300 ${activeAccordion === "talla" ? "rotate-180 text-yellow-500" : ""}`} />
                    </button>
                    {activeAccordion === "talla" && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-4 pt-3 pb-2"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider mb-2">Adulto</p>
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
                                    setIsOpen(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-none border cursor-pointer ${
                                    isActive 
                                      ? "bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]" 
                                      : "bg-black text-gray-400 border-gray-800 hover:border-yellow-900 hover:text-gray-200"
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider mb-2">Niño</p>
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
                                    setIsOpen(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-none border cursor-pointer ${
                                    isActive 
                                      ? "bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]" 
                                      : "bg-black text-gray-400 border-gray-800 hover:border-yellow-900 hover:text-gray-200"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider mb-2">Accesorios</p>
                          <div className="flex flex-wrap gap-1.5">
                            {tallasAccesorios.map(({ size, label }) => {
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
                                    setIsOpen(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-none border cursor-pointer ${
                                    isActive 
                                      ? "bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]" 
                                      : "bg-black text-gray-400 border-gray-800 hover:border-yellow-900 hover:text-gray-200"
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
              
              <div className="pt-4 border-t border-gray-800 mt-4 relative z-10">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:bg-yellow-400 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(hasActiveFilters || localSearch.trim() !== "") && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed sm:bottom-20 bottom-16 left-0 right-0 z-50 flex justify-center items-center pointer-events-none"
          >
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-red-800 hover:bg-red-700 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-[0_10px_25px_-5px_rgba(153,27,27,0.8)] border border-red-600 active:scale-95 transition-transform cursor-pointer pointer-events-auto"
            >
              <FaTrashAlt size={10} />
              <span>Borrar filtros</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}