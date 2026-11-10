import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { FaTimes, FaSearch, FaSlidersH, FaRulerHorizontal, FaEyeSlash, FaCheck } from "react-icons/fa";

// ⚠️ Estilos en index.css (sección "FILTER BAR", clases fb-*).

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

const sizeGroups = [
  { title: "Adulto", sizes: ["S", "M", "L", "XL", "XXL", "3XL", "4XL"].map((s) => ({ size: s, label: s })) },
  {
    title: "Niño",
    sizes: [
      { size: "16", label: "16", hint: "Talla 2" },
      { size: "18", label: "18", hint: "Talla 4" },
      { size: "20", label: "20", hint: "Talla 6" },
      { size: "22", label: "22", hint: "Talla 8" },
      { size: "24", label: "24", hint: "Talla 10" },
      { size: "26", label: "26", hint: "Talla 12" },
      { size: "28", label: "28", hint: "Talla 14/16" },
    ],
  },
  { title: "Accesorios", sizes: [{ size: "U", label: "Única" }] },
];

const SEARCH_DEBOUNCE_MS = 350;

export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterSizes = [],
  setFilterSizes,
  onToggleTallas,
  onOpenMedidas,
  // 🔒 Filtro de ocultos (solo Super Admin)
  esSuperAdmin = false,
  soloOcultos = false,
  setSoloOcultos,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm || "");
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dragControls = useDragControls();

  // filterType admite varios tipos separados por coma ("Player,Fan")
  const activeTypes = String(filterType || "").split(",").map((t) => t.trim()).filter(Boolean);
  const activeCount = activeTypes.length + (filterSizes?.length || 0) + (soloOcultos ? 1 : 0);
  const hasAnything = activeCount > 0 || (searchTerm || "").trim() !== "";
  const labelOf = (v) => categories.find((c) => c.value === v)?.label || v;

  const toggleType = (value) => {
    if (!value) return setFilterType?.(""); // "Todos" limpia
    const next = activeTypes.includes(value) ? activeTypes.filter((t) => t !== value) : [...activeTypes, value];
    setFilterType?.(next.join(","));
  };

  // Sincroniza si el término cambia desde afuera (URL, logo, etc.)
  useEffect(() => {
    setLocalSearch(searchTerm || "");
  }, [searchTerm]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Bloquear scroll + cerrar con Escape mientras el panel está abierto
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // 🔎 Búsqueda con debounce: no pedimos al backend en cada tecla
  const handleInputChange = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchTerm?.(val), SEARCH_DEBOUNCE_MS);
  };

  const clearSearch = () => {
    clearTimeout(debounceRef.current);
    setLocalSearch("");
    setSearchTerm?.("");
    inputRef.current?.focus();
  };

  const toggleSize = (size) => {
    setFilterSizes?.((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  };

  const clearFilters = () => {
    setFilterType?.("");
    setFilterSizes?.([]);
    setSoloOcultos?.(false);
  };

  const clearAll = () => {
    clearFilters();
    clearSearch();
  };

  const openPanel = () => {
    setIsOpen(true);
    onToggleTallas?.();
  };

  // Chips de filtros activos
  const chips = [
    searchTerm?.trim() && { key: "q", label: `“${searchTerm.trim()}”`, onRemove: clearSearch },
    ...activeTypes.map((t) => ({ key: `t-${t}`, label: labelOf(t), onRemove: () => toggleType(t) })),
    ...(filterSizes || []).map((s) => ({ key: `s-${s}`, label: `Talla ${s === "U" ? "única" : s}`, onRemove: () => toggleSize(s) })),
    soloOcultos && { key: "o", label: "Solo ocultos", onRemove: () => setSoloOcultos?.(false) },
  ].filter(Boolean);

  return (
    <>
      <div className="fb-wrap" id="filter-bar">
        <motion.div
          className="fb-bar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Buscador */}
          <label className="fb-search">
            <FaSearch className="fb-search-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              placeholder="Buscar equipo, jugador…"
              value={localSearch}
              onChange={handleInputChange}
              aria-label="Buscar productos"
            />
            <AnimatePresence>
              {localSearch && (
                <motion.button
                  type="button"
                  className="fb-search-clear"
                  onClick={clearSearch}
                  aria-label="Borrar búsqueda"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                >
                  <FaTimes />
                </motion.button>
              )}
            </AnimatePresence>
          </label>

          {/* Acciones */}
          <div className="fb-actions">
            <button type="button" className="fb-btn fb-btn--dark" onClick={openPanel} aria-label="Abrir filtros">
              <FaSlidersH />
              <span className="fb-btn-label">Filtros</span>
              <AnimatePresence>
                {activeCount > 0 && (
                  <motion.span
                    key={activeCount}
                    className="fb-count"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  >
                    {activeCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {onOpenMedidas && (
              <button type="button" className="fb-btn fb-btn--light" onClick={onOpenMedidas} aria-label="Ver guía de tallas">
                <FaRulerHorizontal />
                <span className="fb-btn-label">Guía de tallas</span>
              </button>
            )}

            {esSuperAdmin && (
              <button
                type="button"
                className={`fb-btn fb-btn--light ${soloOcultos ? "fb-btn--on" : ""}`}
                onClick={() => setSoloOcultos?.(!soloOcultos)}
                title="Ver únicamente productos ocultos del catálogo"
                aria-pressed={soloOcultos}
              >
                <FaEyeSlash />
                <span className="fb-btn-label">Ocultos</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Chips de filtros activos */}
        <AnimatePresence initial={false}>
          {chips.length > 0 && (
            <motion.div
              className="fb-chips"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <AnimatePresence initial={false}>
                {chips.map((c) => (
                  <motion.button
                    layout
                    key={c.key}
                    type="button"
                    className="fb-chip"
                    onClick={c.onRemove}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    aria-label={`Quitar filtro ${c.label}`}
                  >
                    {c.label}
                    <FaTimes className="fb-chip-x" />
                  </motion.button>
                ))}
              </AnimatePresence>
              {hasAnything && chips.length > 1 && (
                <motion.button layout type="button" className="fb-clear-all" onClick={clearAll}>
                  Limpiar todo
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== PANEL DE FILTROS (bottom sheet en móvil, modal en desktop) ===== */}
      <AnimatePresence>
        {isOpen && (
          <div className="fb-layer" role="dialog" aria-modal="true" aria-label="Filtros">
            <motion.div
              className="fb-backdrop"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="fb-sheet"
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) setIsOpen(false);
              }}
            >
              {/* Manija + encabezado: arrastrar hacia abajo cierra (móvil) */}
              <div className="fb-drag-zone" onPointerDown={(e) => dragControls.start(e)}>
                <span className="fb-handle" aria-hidden="true" />
              </div>

              <div className="fb-sheet-head" onPointerDown={(e) => dragControls.start(e)}>
                <h3>Filtros</h3>
                <button type="button" className="fb-icon-btn" onClick={() => setIsOpen(false)} aria-label="Cerrar filtros">
                  <FaTimes />
                </button>
              </div>

              <div className="fb-sheet-body">
                {/* Categoría */}
                <section className="fb-section">
                  <h4>Versión / categoría</h4>
                  <p className="fb-hint fb-hint--top">Podés elegir varias.</p>
                  <div className="fb-cat-grid">
                    {categories.map((cat, i) => {
                      const isActive = cat.value ? activeTypes.includes(cat.value) : activeTypes.length === 0;
                      return (
                        <motion.button
                          key={cat.label}
                          type="button"
                          className={`fb-cat ${isActive ? "is-active" : ""}`}
                          onClick={() => toggleType(cat.value)}
                          aria-pressed={isActive}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 + i * 0.015 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {cat.label}
                          {isActive && <FaCheck className="fb-cat-check" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </section>

                {/* Tallas */}
                <section className="fb-section">
                  <div className="fb-section-head">
                    <h4>Talla</h4>
                    {onOpenMedidas && (
                      <button
                        type="button"
                        className="fb-link"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenMedidas();
                        }}
                      >
                        <FaRulerHorizontal /> ¿No sabés tu talla?
                      </button>
                    )}
                  </div>
                  <p className="fb-hint">Podés elegir varias.</p>

                  {sizeGroups.map((g) => (
                    <div key={g.title} className="fb-size-group">
                      <span className="fb-size-title">{g.title}</span>
                      <div className="fb-size-grid">
                        {g.sizes.map(({ size, label, hint }) => {
                          const isActive = filterSizes?.includes(size);
                          return (
                            <motion.button
                              key={size}
                              type="button"
                              className={`fb-size ${isActive ? "is-active" : ""} ${hint ? "has-hint" : ""}`}
                              onClick={() => toggleSize(size)}
                              aria-pressed={isActive}
                              whileTap={{ scale: 0.92 }}
                            >
                              <span>{label}</span>
                              {hint && <small>{hint}</small>}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              <div className="fb-sheet-foot">
                <button type="button" className="fb-foot-btn fb-foot-btn--ghost" onClick={clearFilters} disabled={activeCount === 0}>
                  Limpiar
                </button>
                <button type="button" className="fb-foot-btn fb-foot-btn--dark" onClick={() => setIsOpen(false)}>
                  Ver resultados
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
