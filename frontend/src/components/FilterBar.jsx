import { motion } from 'framer-motion';

const filterOptions = ['Todos', 'Player', 'Fan', 'Mujer', 'Nacional', 'Abrigos', 'Retro', 'Niño'];

export default function FilterBar({ searchTerm, setSearchTerm, filterType, setFilterType }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 mb-8">
      {/* Input de búsqueda */}
      <motion.input
        type="text"
        placeholder="Buscar por nombre o equipo"
        className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      />

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
