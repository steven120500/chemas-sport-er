// src/components/FilterBar.jsx
import { motion } from 'framer-motion';

const filterOptions = [
  'Todos',
  'Player',
  'Fan',
  'Mujer',
  'Nacional',
  'Abrigos',
  'Retro',
  'Niño',
  'F1',
  'NBA',
  'MLB',
  'NFL',
  'Ofertas', // ✅ nuevo botón
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
          className="px-3 py-2 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
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
        {filterOptions.map((label) => (
          <button
            key={label}
            className={`px-4 py-2 rounded-md transition whitespace-nowrap shadow-sm font-medium ${
              filterType === label || (label === 'Todos' && filterType === '')
                ? 'bg-gray-800 text-white'
                : 'bg-white text-black border border-gray-300 hover:bg-black hover:text-white'
            }`}
            onClick={() => setFilterType(label === 'Todos' ? '' : label)}
          >
            {label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
