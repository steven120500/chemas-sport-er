import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FaTag, FaStar, FaTshirt } from "react-icons/fa";

// ⚠️ Estilos de la card en index.css (sección "PRODUCT CARD", clases pc-*).
// El Tailwind del CDN es 2.2.19: no soporta valores arbitrarios ni group-hover/card.

const cldUrl = (url, w, h) => {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    /\/upload\/(?!.*(f_auto|q_auto|w_|h_))/,
    `/upload/f_auto,q_auto:eco,c_fill,g_auto,e_sharpen:60,w_${w},h_${h}/`
  );
};

const ADULT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const KID_SIZES = ["16", "18", "20", "22", "24", "26", "28"];
const BALL_SIZES = ["3", "4", "5"];

/* ============ Variantes de animación (framer-motion) ============ */
const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: (i % 4) * 0.07 },
  }),
};

const badgeGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
};

const badgeItem = {
  hidden: { opacity: 0, x: -10, scale: 0.9 },
  show: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 26 } },
};

const popIn = (rotate) => ({
  hidden: { opacity: 0, scale: 0.3, rotate: rotate - 60 },
  show: {
    opacity: 1,
    scale: 1,
    rotate,
    transition: { type: "spring", stiffness: 260, damping: 16, delay: 0.45 },
  },
});

const noMotion = { hidden: { opacity: 1 }, show: { opacity: 1 } };

/* ============ Sello TEMPORADA 26-27 ============ */
function SealTemporada({ uid }) {
  const arcId = `pc-arc-${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="pc-seal-svg" aria-label="Temporada 26-27" role="img">
      <defs>
        <path id={arcId} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#ffffff" />
      <circle cx="50" cy="50" r="46" fill="#0a0a0a" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#F5C400" strokeWidth="1.5" />
      <g className="pc-seal-ring">
        <text fill="#F5C400" fontSize="12.5" fontWeight="900">
          <textPath href={`#${arcId}`} textLength="228" lengthAdjust="spacing">
            TEMPORADA ★ TEMPORADA ★
          </textPath>
        </text>
      </g>
      <text x="50" y="47" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="900">26</text>
      <line x1="40" y1="52" x2="60" y2="52" stroke="#F5C400" strokeWidth="1.5" />
      <text x="50" y="68" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="900">27</text>
    </svg>
  );
}

// 📱 Pantallas táctiles (sin hover real): la 2da foto alterna sola
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches;

export default function ProductCard({ product, onClick, user, index = 0 }) {
  const reduceMotion = useReducedMotion();
  // 💸 La 2da foto solo se descarga cuando hace falta: en desktop al pasar el mouse;
  // en celular (sin hover) cuando la card entra en pantalla, y ahí alterna sola (CSS `@media (hover: none)`).
  const [wantsAlt, setWantsAlt] = useState(false);
  if (!product) return null;

  const uid = String(product._id ?? product.id ?? index).replace(/[^a-zA-Z0-9_-]/g, "");

  const primaryImg = product.imageSrc;
  const secondaryImg =
    product.secondaryImage ||
    product.imageSrc2 ||
    product.secondImage ||
    product.foto2 ||
    product.img2 ||
    (Array.isArray(product.images) && product.images[1] && (typeof product.images[1] === "string" ? product.images[1] : product.images[1].url)) ||
    null;

  const isAdmin = user?.isSuperUser || user?.roles?.includes("edit");
  const isNino = product.type === "Niño";
  const isBalon = product.type === "Balón" || product.type === "Balones";
  const isLlavero = product.type === "Llaveros" || product.type === "LEGO"; // por unidad

  const sizesToCheck = isLlavero ? ["U"] : isBalon ? BALL_SIZES : isNino ? KID_SIZES : ADULT_SIZES;

  let totalInventory = 0;
  for (const size of sizesToCheck) {
    totalInventory +=
      Number(product.tienda?.[size] ?? 0) +
      Number(product.stock?.[size] ?? 0) +
      Number(product.bodega?.[size] ?? 0);
  }

  const isTotalAgotado = totalInventory === 0;

  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice !== null &&
    Number(product.discountPrice) > 0;

  const discountPct =
    hasDiscount && Number(product.price) > Number(product.discountPrice)
      ? Math.round((1 - Number(product.discountPrice) / Number(product.price)) * 100)
      : 0;

  const isNuevo = product.createdAt
    ? new Date() - new Date(product.createdAt) <= 5 * 24 * 60 * 60 * 1000
    : false;

  const showPersonalizable =
    product.isNumerable && Array.isArray(product.dorsalOptions) && product.dorsalOptions.length > 0 && !isTotalAgotado;

  // Tamaño de imagen pedido a Cloudinary (las cards ahora son más pequeñas en desktop)
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const W = screenWidth >= 768 ? 480 : 420;
  const H = Math.round(W * 1.15);
  const pImg = cldUrl(primaryImg, W, H) || primaryImg;
  const sImg = !isTotalAgotado && secondaryImg ? cldUrl(secondaryImg, W, H) || secondaryImg : null;

  const v = (variants) => (reduceMotion ? noMotion : variants);

  return (
    <motion.article
      custom={index}
      variants={v(cardVariants)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      whileHover={reduceMotion ? undefined : { y: -6, transition: { type: "spring", stiffness: 350, damping: 22 } }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(product)}
      onMouseEnter={() => setWantsAlt(true)}
      onViewportEnter={() => {
        if (IS_TOUCH) setWantsAlt(true);
      }}
      className={`pc-card ${isTotalAgotado ? "pc-soldout" : ""}`}
      style={isAdmin && product.hidden ? { opacity: 0.6, filter: "grayscale(1)" } : undefined}
    >
      {/* Sticker NEW */}
      {isNuevo && !isTotalAgotado && (
        <motion.div variants={v(popIn(-12))} className="pc-new shine-sutil">
          <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
            <polygon points="50,0 58,15 74,8 77,24 94,22 91,38 100,48 91,59 95,76 78,77 74,93 58,85 50,100 42,85 26,93 22,77 5,76 9,59 0,48 9,38 6,22 23,24 26,8 42,15" />
          </svg>
          <span>NEW</span>
        </motion.div>
      )}

      <div className="pc-frame">
        {/* ❄️ Capa de nieve sobre el borde superior */}
        <svg className="pc-snowcap" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0 H200 V5 C192 5 190 11 184 11 C178 11 178 6 170 6 C163 6 162 13 154 13 C146 13 147 6 138 6 C130 6 130 10 122 10 C114 10 115 5 106 5 C98 5 97 12 88 12 C80 12 80 6 72 6 C64 6 64 10 56 10 C48 10 49 5 40 5 C32 5 31 11 23 11 C15 11 14 6 7 6 C3 6 1 7 0 8 Z" />
        </svg>

        {/* 🎀 Cinta superior */}
        <div className="pc-ribbon" aria-hidden="true" />

        {/* --- FOTO --- */}
        <div className="pc-media">
          <img
            src={pImg}
            alt={product.imageAlt || product.name}
            className="pc-img"
            loading="lazy"
            decoding="async"
          />
          {sImg && wantsAlt && (
            <img
              src={sImg}
              alt=""
              aria-hidden="true"
              className="pc-img pc-img--alt"
              style={{ animationDelay: `${(index % 4) * 0.6}s` }}
              loading="lazy"
              decoding="async"
            />
          )}

          {/* ❄️ Copos suaves al pasar el mouse */}
          {!isTotalAgotado && (
            <div className="pc-flakes" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
          )}

          {isTotalAgotado && (
            <div className="pc-overlay">
              <span className="pc-stamp">Agotado</span>
            </div>
          )}

          {isAdmin && product.hidden && (
            <div className="pc-overlay pc-overlay--hidden">
              <span className="pc-stamp pc-stamp--muted">Oculto</span>
            </div>
          )}

          {/* Sello TEMPORADA 26-27 */}
          {product.isTemporada2627 === true && (
            <motion.div variants={v(popIn(-10))} className="pc-seal">
              <SealTemporada uid={uid} />
            </motion.div>
          )}
        </div>

        {/* --- BADGES SOBRE LA FOTO --- */}
        <motion.div variants={v(badgeGroup)} className="pc-badges">
          {product.type && (
            <motion.span variants={v(badgeItem)} className="pc-badge">
              <i className="pc-dot" />
              {product.type}
            </motion.span>
          )}

          {product.isPopular === true && (
            <motion.span variants={v(badgeItem)} className="pc-badge pc-badge--popular" title="Popular">
              <FaStar className="pc-badge-icon" />
              <span className="pc-badge-label">Popular</span>
            </motion.span>
          )}

          {hasDiscount && !isTotalAgotado && (
            <motion.span variants={v(badgeItem)} className="pc-badge pc-badge--sale" title="Oferta">
              <FaTag className="pc-badge-icon" />
              <span className="pc-badge-label">{discountPct > 0 ? `-${discountPct}%` : "Oferta"}</span>
            </motion.span>
          )}
        </motion.div>

        {/* --- INFORMACIÓN --- */}
        <div className="pc-info">
          <h3 className="pc-name">
            <span className="linea-hover">{product.name}</span>
          </h3>

          {showPersonalizable && (
            <span className="pc-custom">
              <FaTshirt className="pc-custom-icon" />
              Personalizable
            </span>
          )}

          <div className="pc-bottom">
            <div className="pc-prices">
              {hasDiscount ? (
                <>
                  <span className="pc-price">₡{Number(product.discountPrice).toLocaleString("de-DE")}</span>
                  <span className="pc-price-old">₡{Number(product.price).toLocaleString("de-DE")}</span>
                </>
              ) : (
                <span className="pc-price">₡{Number(product.price).toLocaleString("de-DE")}</span>
              )}
            </div>

            <div className="pc-actions">
              {sImg && (
                <div className="pc-dots" aria-hidden="true">
                  <i className="pc-dots-1" />
                  <i className="pc-dots-2" />
                </div>
              )}
              <span className="pc-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

    </motion.article>
  );
}
