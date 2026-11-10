import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo.png";
import {
  FaUser, FaTimes, FaHistory, FaUserPlus, FaUsers, FaSignOutAlt, FaChevronRight,
  FaPercentage, FaTruck, FaStore,
} from "react-icons/fa";

// ⚠️ Estilos en index.css (sección "HEADER", clases hd-*).

const navItems = [
  { label: "Todo", value: "" },
  { label: "Temporada 26-27", value: "Temp 26-27", dot: "#F5C400" },
  { label: "Nuevo", value: "Nuevo", dot: "#16a34a" },
  { label: "Populares", value: "Populares" },
  { label: "Mundial 2026", value: "Mundial 2026" },
  { label: "Ofertas", value: "Ofertas", dot: "#dc2626" },
  { label: "Nacional", value: "Nacional" },
  { label: "Player", value: "Player" },
  { label: "Fan", value: "Fan" },
  { label: "Retro", value: "Retro" },
  { label: "Mujer", value: "Mujer" },
  { label: "Niño", value: "Niño" },
  { label: "Balón", value: "Balón" },
  { label: "Abrigos", value: "Abrigos" },
  { label: "Llaveros", value: "Llaveros" },
  { label: "NBA", value: "NBA" },
  { label: "MLB", value: "MLB" },
  { label: "NFL", value: "NFL" },
  { label: "F1", value: "F1" },
];

const getInitials = (name) => {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

export default function Header({
  onLoginClick,
  onLogout,
  onLogoClick,
  user,
  canSeeHistory,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
  filterType,
  setFilterType,
}) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const paused = useRef(false);
  const resumeTimer = useRef(null);

  const activeTypes = String(filterType || "").split(",").map((t) => t.trim()).filter(Boolean);
  const isActive = (value) => (value ? activeTypes.includes(value) : activeTypes.length === 0);

  /* ---- Header compacto al hacer scroll ---- */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---- Auto-scroll continuo del menú (lista duplicada = bucle infinito) ---- */
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const SPEED = 0.5; // px por frame
    let acc = 0;
    let id;
    const step = () => {
      const half = el.scrollWidth / 2;
      if (!paused.current) {
        acc += SPEED;
        if (acc >= 1) {
          const px = Math.floor(acc);
          el.scrollLeft += px;
          acc -= px;
        }
      }
      // Bucle: al pasar la mitad (fin de la primera copia) vuelve al inicio sin salto visible
      if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(resumeTimer.current);
    };
  }, []);

  const pause = () => {
    clearTimeout(resumeTimer.current);
    paused.current = true;
  };
  const resumeSoon = (ms = 2000) => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      paused.current = false;
    }, ms);
  };

  /* ---- Arrastrar con mouse (desktop) ---- */
  const onMouseDown = (e) => {
    drag.current = { down: true, startX: e.pageX, startLeft: navRef.current.scrollLeft, moved: false };
  };
  const onMouseMove = (e) => {
    if (!drag.current.down) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    navRef.current.scrollLeft = drag.current.startLeft - dx;
  };
  const onMouseUp = () => {
    drag.current.down = false;
  };
  const onMouseLeave = () => {
    drag.current.down = false;
    resumeSoon(600);
  };

  const handleNavClick = (value) => {
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    if (!setFilterType) return;
    // Click en la categoría activa (única) la quita; si no, la selecciona sola
    if (value && activeTypes.length === 1 && activeTypes[0] === value) setFilterType("");
    else setFilterType(value);
  };

  /* ---- Menú lateral: bloquear scroll + Escape ---- */
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setSidebarOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  // Usuario "tienda" o super admin
  const usernameLower = String(user?.username || user?.name || user?.firstName || "").trim().toLowerCase();
  const esSoloUsuarioTienda = !isSuperUser && (
    usernameLower === "tienda" ||
    usernameLower.includes("tienda") ||
    user?.role === "tienda" ||
    user?.rol === "tienda" ||
    user?.roles?.includes("tienda")
  );
  const esAdminTienda = isSuperUser || esSoloUsuarioTienda;
  const displayName = user?.firstName || user?.username || user?.name;

  const menu = user
    ? [
        esAdminTienda && { key: "tienda", icon: FaStore, label: "Tienda física", onClick: () => navigate("/tienda"), featured: true },
        { key: "comisiones", icon: FaPercentage, label: "Comisiones", onClick: () => navigate("/comisiones") },
        { key: "guias", icon: FaTruck, label: "Guías", onClick: () => navigate("/guias") },
        !esSoloUsuarioTienda && (isSuperUser || user?.roles?.includes("add")) && {
          key: "add-user", icon: FaUserPlus, label: "Agregar usuario", onClick: () => setShowRegisterUserModal(true),
        },
        !esSoloUsuarioTienda && (isSuperUser || user?.roles?.includes("view_users")) && {
          key: "users", icon: FaUsers, label: "Ver usuarios", onClick: () => setShowUserListModal(true),
        },
        (isSuperUser || esSoloUsuarioTienda || canSeeHistory || user?.roles?.includes("history")) && {
          key: "history", icon: FaHistory, label: "Historial", onClick: () => setShowHistoryModal(true),
        },
      ].filter(Boolean)
    : [];

  return (
    <header className={`hd ${scrolled ? "is-scrolled" : ""}`}>
      {/* ---- Fila principal ---- */}
      <div className="hd-top">
        <button type="button" onClick={onLogoClick} className="hd-logo" title="Volver al inicio">
          {/* El PNG trae ~18% de margen transparente: .hd-logo-mark lo recorta al círculo real */}
          <span className="hd-logo-mark">
            <img src={logo} alt="ChemaSport ER" />
          </span>
        </button>

        <button type="button" onClick={onLogoClick} className="hd-title" aria-label="ChemaSport ER, volver al inicio">
          ChemaSport<span className="hd-title-er">ER</span>
        </button>

        <motion.button
          type="button"
          onClick={() => setSidebarOpen(true)}
          title={user ? "Menú de usuario" : "Iniciar sesión"}
          aria-label={user ? "Abrir menú de usuario" : "Iniciar sesión"}
          className={`hd-user ${user ? "is-logged" : ""}`}
          whileTap={{ scale: 0.92 }}
        >
          {user ? <span>{getInitials(displayName)}</span> : <FaUser />}
        </motion.button>
      </div>

      {/* ---- Menú de categorías ---- */}
      <div className="hd-nav-wrap">
        <nav
          ref={navRef}
          className="hd-nav"
          onMouseEnter={pause}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={pause}
          onTouchEnd={() => resumeSoon()}
          onTouchCancel={() => resumeSoon()}
          onFocus={pause}
          onBlur={() => resumeSoon()}
          aria-label="Categorías"
        >
          {[...navItems, ...navItems].map((item, idx) => {
            const active = isActive(item.value);
            const isCopy = idx >= navItems.length;
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                className={`hd-nav-item ${active ? "is-active" : ""}`}
                onClick={() => handleNavClick(item.value)}
                aria-pressed={active}
                aria-hidden={isCopy || undefined}
                tabIndex={isCopy ? -1 : undefined}
              >
                {item.dot && <i className="hd-dot" style={{ background: item.dot }} />}
                {item.label}
                <motion.span
                  className="hd-underline"
                  initial={false}
                  animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              </button>
            );
          })}
        </nav>

      </div>

      {/* ---- Menú lateral (portal: el backdrop-filter del header recortaría el position:fixed) ---- */}
      {createPortal(
      <AnimatePresence>
        {sidebarOpen && (
          <div className="hd-drawer-layer" role="dialog" aria-modal="true" aria-label="Menú de usuario">
            <motion.div
              className="hd-backdrop"
              onClick={() => setSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="hd-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              <button type="button" className="hd-drawer-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
                <FaTimes />
              </button>

              {user ? (
                <div className="hd-drawer-body">
                  <div className="hd-profile">
                    <span className="hd-avatar">{getInitials(displayName)}</span>
                    <div className="hd-profile-info">
                      <span className="hd-session"><i />Sesión activa</span>
                      <p>{displayName}</p>
                    </div>
                  </div>

                  <nav className="hd-menu">
                    {menu.map((m, i) => {
                      const Icon = m.icon;
                      return (
                        <motion.button
                          key={m.key}
                          type="button"
                          className={`hd-menu-item ${m.featured ? "is-featured" : ""}`}
                          onClick={() => {
                            m.onClick();
                            setSidebarOpen(false);
                          }}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 400, damping: 30 }}
                        >
                          <Icon className="hd-menu-icon" />
                          <span>{m.label}</span>
                          <FaChevronRight className="hd-menu-chevron" />
                        </motion.button>
                      );
                    })}
                  </nav>

                  <button
                    type="button"
                    className="hd-logout"
                    onClick={() => {
                      onLogout();
                      setSidebarOpen(false);
                    }}
                  >
                    <FaSignOutAlt />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              ) : (
                <motion.div
                  className="hd-guest"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="hd-guest-icon"><FaUser /></span>
                  <h3>¡Bienvenido!</h3>
                  <p>Iniciá sesión para administrar la tienda.</p>
                  <button
                    type="button"
                    className="hd-login"
                    onClick={() => {
                      onLoginClick();
                      setSidebarOpen(false);
                    }}
                  >
                    Iniciar sesión
                  </button>
                </motion.div>
              )}

              <div className="hd-drawer-foot">ChemaSport ER</div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </header>
  );
}
