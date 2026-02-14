import { motion } from "framer-motion";
import { FaChevronDown } from "react-icons/fa"; // Asegúrate de tener react-icons instalado, si no, usa un SVG simple

const categories = [
  { label: "Todos", value: "" },
  { label: "Nacional", value: "Nacional" },
  { label: "Populares", value: "Populares" }, // ⭐ Se pintará Naranja
  { label: "Ofertas", value: "Ofertas" },     // ⭐ Se pintará Verde
  { label: "Player", value: "Player" },
  { label: "Fan", value: "Fan" },
  { label: "Retro", value: "Retro" },
  { label: "Balón", value: "Balon" },
  { label: "Mujer", value: "Mujer" },
  { label: "Niño", value: "Niño" },
  { label: "Abrigos", value: "Abrigos" },
  { label: "F1", value: "F1" },
  { label: "NBA", value: "NBA" },
  { label: "MLB", value: "MLB" },
  { label: "NFL", value: "NFL" },
];

export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  onToggleTallas,
}) {
  return (
    <div className="w-full flex flex-col gap-5 mb-6 mt-2 px-4 md:px-0">
      
      {/* 1. BARRA DE BÚSQUEDA + BOTÓN TALLAS */}
      <motion.div
        className="w-full flex justify-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative w-full max-w-lg flex items-center gap-3">
          
          {/* Input Buscador */}
          <div className="relative flex-1">
             <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
            <input
              type="text"
              placeholder="Buscar camiseta..."
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Botón Tallas (Con Texto y Flecha) */}
          <button
            onClick={onToggleTallas}
            className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-md text-sm font-bold tracking-wide"
          >
            TALLAS
            
          </button>

        </div>
      </motion.div>

      {/* 2. CARRUSEL DE CATEGORÍAS (Scroll Horizontal) */}
      <motion.div
        className="w-full overflow-x-auto pb-2 scrollbar-hide mask-fade"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex gap-2 px-2 md:justify-center min-w-max">
          {categories.map((cat) => {
            const isActive = filterType === cat.value;
            
            // LÓGICA DE COLORES
            let btnClass = "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"; // Estilo base
            
            if (cat.value === "Populares") {
              // Estilo NARANJA para Populares
              btnClass = isActive 
                ? "bg-yellow-500 border-yellow-500 text-white shadow-md scale-105" 
                : "bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-orange-100";
            } 
            else if (cat.value === "Ofertas") {
              // Estilo VERDE para Ofertas
              btnClass = isActive 
                ? "bg-green-600 border-green-600 text-white shadow-md scale-105" 
                : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100";
            } 
            else if (isActive) {
              // Estilo ACTIVO (Negro) para el resto
              btnClass = "bg-black border-black text-white shadow-md scale-105";
            }

            return (
              <button
                key={cat.label}
                onClick={() => setFilterType(cat.value)}
                className={`
                  ${btnClass}
                  px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap
                `}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}