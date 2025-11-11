// src/components/FilterBar.jsx
import { motion } from "framer-motion";


// 🔹 Incluimos “Balones” como nueva categoría visible
const filterOptions = [
  "Todos",
  "Player",
  "Fan",
  "Mujer",
  "Niño",
  "Nacional",
  "Abrigos",
  "Retro",
  "F1",
  "NBA",
  "MLB",
  "NFL",
  "Balones", // ⚽ nueva categoría
  "Ofertas", // ✅ botón ofertas
];


export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  onToggleTallas,
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 mb-8 w-full">
      {/* 🔎 Input de búsqueda + botón filtrar por talla */}
      <motion.div
        className="flex items-center gap-2 w-full max-w-md"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <input
          type="text"
          placeholder="Buscar por nombre o equipo"
          className="flex-1 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />


        <button
          onClick={onToggleTallas}
          className="px-3 py-2 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-600 whitespace-nowrap"
        >
          Filtrar por talla
        </button>
      </motion.div>


      {/* Botones de filtros */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 overflow-x-auto w-full px-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {filterOptions.map((label) => {
          const isActive =
            filterType === label || (label === "Todos" && filterType === "");
          const isOffer = label === "Ofertas";
          const isBall = label === "Balones";


          return (
            <button
              key={label}
              className={`px-4 py-2 rounded-md transition whitespace-nowrap shadow-sm font-medium ${
                isOffer
                  ? isActive
                    ? "bg-green-600 etiqueta-oferta-verde text-white"
                    : "bg-green-500 etiqueta-oferta-verde text-black border border-green-400 hover:bg-green-600 hover:text-white"
                  : isBall
                  ? isActive
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border border-black hover:bg-white hover:text-black"
                  : isActive
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border border-black hover:text-gray-600"
              }`}
              onClick={() => setFilterType(label === "Todos" ? "" : label)}
            >
              {label}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
