import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaChevronLeft, FaChevronRight, FaWhatsapp, FaRulerCombined, FaInfoCircle, FaTshirt, FaTruck, FaCreditCard, FaComments, FaEdit, FaTrashAlt } from "react-icons/fa";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion"; 
import ProductAdminEditor from "./ProductAdminEditor"; 
import Medidas from "./Medidas";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const MODAL_IMG_MAX_W = 1000; // fijo: nítido en pantallas retina sin descargar 2000px+

/* =====================================================================
   🎯 PANEL DE CALIBRACIÓN INDEPENDIENTE (PLAYER VS FAN)
   ===================================================================== */
const getDorsalLayout = (teamFont, productType = "") => {
  const isPlayer = productType.toLowerCase().includes("player");

  if (teamFont === 'madrid') {
    return {
      boxWidth: "60%",      
      offsetY: "-15%",       
      offsetX: "-1%",       
      nameY: 123,           
      nameCurve: 120,       
      nameSize: 38,         
      numberY: 285,         
      numberSize: 180,      
      colorTop: "#1A362D",    
      colorMid: "#122A21",    
      colorBottom: "#0A1712", 
      stroke: "rgba(255, 255, 255, 0.15)" 
    };
  }
  
  if (teamFont === 'boca') {
    return {
      // 🔥 CONFIGURACIÓN SEPARADA PARA BOCA (PLAYER / FAN) 🔥
      boxWidth: isPlayer ? "56%": "54%",       
      offsetY: isPlayer ? "-25%": "-26%",       
      offsetX: isPlayer ? "-6%": "2%",       
      nameY: 125,           
      nameCurve: 120,       
      nameSize: 38,         
      numberY: 270,         
      numberSize: 190,      
      colorTop: "#FFFFFF",  
      colorMid: "#F3F4F6",  
      colorBottom: "#E5E7EB", 
      stroke: "rgba(0,0,0,0.1)" 
    };
  }

  if (teamFont === 'river') {
    return {
      // 🔥 CONFIGURACIÓN SEPARADA PARA RIVER (PLAYER / FAN) 🔥
      boxWidth: isPlayer ? "56%": "54%",      
      offsetY: isPlayer ? "-25%": "-22%",       
      offsetX: isPlayer ? "-3%": "-2%",       
      nameY: 120,           
      nameCurve: 128,       
      nameSize: 38,         
      numberY: 280,         
      numberSize: 188,      
      colorTop: "#333333",  
      colorMid: "#111111",  
      colorBottom: "#000000", 
      stroke: "#FFFFFF"     
    };
  }

  // Por defecto (Barcelona)
  return {
    boxWidth: "60%",      
    offsetY: "-0%",       
    offsetX: "-3%",       
    nameY: 160,           
    nameCurve: 30,       
    nameSize: 50,         
    numberY: 190,         
    numberSize: 210,      
    colorTop: "#FFE600",
    colorMid: "#F5C400",
    colorBottom: "#D4A000",
    stroke: "#C79200"
  };
};

/* 🔥 VARIANTES DE ANIMACIÓN PREMIUM DE TERMOSELLADO 🔥 */
const heatPressVariants = {
  hidden: { 
    opacity: 0, 
    scale: 1.15, 
    y: -15, 
    filter: "brightness(1.5) blur(4px)" 
  },
  visible: { 
    opacity: 0.95, 
    scale: 1, 
    y: 0, 
    filter: "brightness(1) blur(0px)",
    transition: { 
      type: "spring", 
      stiffness: 140, 
      damping: 12, 
      mass: 0.8 
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.92, 
    y: 10,
    filter: "brightness(0.5) blur(2px)",
    transition: { duration: 0.25, ease: "easeInOut" } 
  }
};

function transformCloudinary(url, maxW) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return url;
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return url;
    // 💸 Sin dpr_auto: generaba versiones de hasta 3x el ancho en celulares (mucho ancho de banda)
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW}`;
    u.pathname = `${parts[0]}/upload/${transforms}/${parts[1]}`;
    return u.toString();
  } catch {
    return url;
  }
}

export default function ProductScreen({
  product,
  onClose,
  onUpdate,
  canEdit,
  canDelete,
  user,
  storeView = 'todos',
}) {
  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  
  const [selectedSize, setSelectedSize] = useState("");
  const [openMedidas, setOpenMedidas] = useState(false);

  // 🔥 ESTADOS PARA LA PERSONALIZACIÓN DE DORSAL 🔥
  const [selectedDorsalIndex, setSelectedDorsalIndex] = useState("");
  const [dorsalAnimKey, setDorsalAnimKey] = useState(0);
  const [ctaShake, setCtaShake] = useState(0);

  const displayName = user?.username || user?.email || "ChemaSportER";

  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(viewProduct?.images) && viewProduct.images.length > 0) {
      return viewProduct.images.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
    }
    return [viewProduct?.imageSrc, viewProduct?.imageSrc2].filter(Boolean);
  }, [viewProduct]);

  // 🔥 FILTRAR SOLO DORSALES CON CANTIDAD DISPONIBLE (> 0) 🔥
  const availableDorsals = useMemo(() => {
    if (!viewProduct?.isNumerable || !Array.isArray(viewProduct?.dorsalOptions)) return [];
    return viewProduct.dorsalOptions.filter((opt) => {
      const hasInfo = (opt.name && opt.name.trim() !== "") || (opt.number && opt.number.trim() !== "");
      const qty = parseInt(opt.quantity, 10);
      return hasInfo && !isNaN(qty) && qty > 0;
    });
  }, [viewProduct]);

  const selectedDorsal = useMemo(() => {
    if (selectedDorsalIndex === "" || selectedDorsalIndex === null) return null;
    return availableDorsals[Number(selectedDorsalIndex)] || null;
  }, [selectedDorsalIndex, availableDorsals]);

  useEffect(() => {
    setViewProduct(product);
    setIdx(0);
    setSelectedSize(""); 
    setSelectedDorsalIndex("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  useEffect(() => {
    const currentId = product?._id || product?.id;
    if (!currentId || isEditing) return;

    const hasAdminRole = user?.isSuperUser || user?.isAdmin || (Array.isArray(user?.roles) && user.roles.length > 0);
    if (!hasAdminRole) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3
    });

    socket.on('productoActualizado', (productoFresco) => {
      const frescoId = productoFresco?._id || productoFresco?.id;
      if (frescoId === currentId && !isEditing) {
        setViewProduct(productoFresco);
        const meta = productoFresco._lastEditMeta || {};
        const txtTienda = meta.store ? ` en ${meta.store}` : "";
        const txtCliente = meta.customer && meta.customer !== "No especificado" ? ` (Cliente: ${meta.customer})` : "";
        toast.info(
          `¡${meta.user || "Alguien"} ${meta.action || "actualizó"}${txtTienda}!${txtCliente} Pantalla actualizada.`,
          { position: "top-center", autoClose: 4000 }
        );
      }
    });

    return () => { socket.disconnect(); };
    
  }, [product?._id, product?.id, isEditing, user?.email]); 

  useEffect(() => {
    const handleUnload = () => { if (isEditing) navigator.sendBeacon(`${API_BASE}/api/products/${product?._id || product?.id}/unlock`); };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (isEditing) unlockProduct(); 
    };
  }, [isEditing]);

  const unlockProduct = async () => {
    const id = product?._id || product?.id;
    if (!id) return;
    try {
      await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/unlock`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user": displayName },
      });
    } catch (error) { console.error("Error", error); }
  };

  const handleEditClick = async () => {
    const id = product?._id || product?.id;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/lock`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user": displayName },
      });
      const data = await res.json();
      if (!res.ok) {
        setIsEditing(false);
        toast.error(`Producto bloqueado por ${data.lockedBy || 'otro usuario'}.`);
        setLoading(false);
        return;
      }
      setIsEditing(true);
      if (data.product) setViewProduct(data.product);
    } catch (err) {
      toast.error("Error al verificar bloqueo.");
    }
    setLoading(false);
  };

  const handleCancelEditClick = () => {
    setIsEditing(false);
    unlockProduct();
  };

  const handleSaveSuccess = (updatedProduct) => {
    setViewProduct(updatedProduct);
    setIsEditing(false);
    if (onUpdate) onUpdate(updatedProduct);
  };

  const handleDeleteSuccess = (id) => {
    if (onUpdate) onUpdate(null, id);
    onClose();
  };

  const handleDorsalSelectChange = (e) => {
    const val = String(e.target.value);
    setSelectedDorsalIndex(val);
    setDorsalAnimKey((prev) => prev + 1);

    if (val !== "" && galleryFromProduct.length > 1) {
      setIdx(1);
    }
  };

  const isNino = viewProduct?.type === "Niño";
  const isBalon = viewProduct?.type === "Balón" || viewProduct?.type === "Balones";
  const isLlavero = viewProduct?.type === "Llaveros";
  const tallasVisibles = isLlavero ? ["U"] : (isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO);
  
  const isCorteAjustado = useMemo(() => {
    const tipo = (viewProduct?.type || "").toLowerCase();
    const nombre = (viewProduct?.name || "").toLowerCase();
    return (
      tipo === "player" ||
      tipo === "mujer" ||
      nombre.includes("player") ||
      nombre.includes("mujer") ||
      nombre.includes("dama") ||
      nombre.includes("femenin")
    );
  }, [viewProduct?.type, viewProduct?.name]);

  const displayUrl = galleryFromProduct[idx] ? transformCloudinary(galleryFromProduct[idx], MODAL_IMG_MAX_W) : "";
  const hasDiscount = viewProduct?.discountPrice !== undefined && viewProduct?.discountPrice !== null && Number(viewProduct?.discountPrice) > 0;
  const hasMany = galleryFromProduct.length > 1;

  const getTotalBySize = (size) => {
    const t = parseInt(viewProduct?.tienda?.[size] ?? 0, 10) || 0; 
    const a = parseInt(viewProduct?.stock?.[size] ?? 0, 10) || 0; 
    const b = parseInt(viewProduct?.bodega?.[size] ?? 0, 10) || 0; 
    
    if (storeView === 'tienda') return t;
    if (storeView === 'bodega1') return a;
    if (storeView === 'bodega2') return b;
    return t + a + b; 
  };

  const finalPrice = hasDiscount ? viewProduct?.discountPrice : viewProduct?.price;
  const formattedPrice = `₡${Number(finalPrice || 0).toLocaleString("de-DE")}`;
  
  const currentProductId = viewProduct?._id || viewProduct?.id || product?._id || product?.id || "";
  const productLink = currentProductId ? `https://chemasporter.com/producto/${currentProductId}` : "https://chemasporter.com";

  const dorsalTextForWhatsapp = selectedDorsal
    ? `\n*Dorsal:* ${selectedDorsal.name ? selectedDorsal.name.toUpperCase() : ""} #${selectedDorsal.number || ""}`
    : `\n*Dorsal:* Sin dorsal (Lisa)`;

  const whatsappMsg = `¡Hola! Me interesa realizar este pedido:\n\n*Artículo:* ${viewProduct?.name || 'Producto'}\n\n*Talla/Unidad:* ${selectedSize || ''}${viewProduct?.isNumerable ? dorsalTextForWhatsapp : ''}\n\n*Precio:* ${formattedPrice}\n\n*Enlace del producto:* ${productLink}`;

  const whatsappUrl = `https://wa.me/50660369857?text=${encodeURIComponent(whatsappMsg)}`;

  const numStr = String(selectedDorsal?.number || "").trim();
  const rawNameStr = String(selectedDorsal?.name || "").trim().toUpperCase();

  // 🔥 PASAMOS EL TIPO DE PRODUCTO (Player / Fan) PARA QUE SE CALIBRE AUTOMÁTICAMENTE 🔥
  const getActiveFontFamily = (fontType) => {
    if (fontType === 'madrid') return "'FontMadrid', sans-serif";
    if (fontType === 'boca') return "'FontBoca', sans-serif";
    if (fontType === 'river') return "'FontRiver', sans-serif";
    return "'FontBarca', sans-serif";
  };
  
  const activeFontFamily = getActiveFontFamily(viewProduct?.teamFont);
  const currentLayout = getDorsalLayout(viewProduct?.teamFont, viewProduct?.type);

  const fontClassMap = {
    madrid: 'font-madrid',
    boca: 'font-boca',
    river: 'font-river',
    barca: 'font-barca'
  };
  const activeFontClass = fontClassMap[viewProduct?.teamFont] || 'font-barca';

  const controlPointY = 2 * currentLayout.nameCurve - currentLayout.nameY;

  const savings = hasDiscount && Number(viewProduct?.price) > Number(viewProduct?.discountPrice)
    ? Number(viewProduct.price) - Number(viewProduct.discountPrice)
    : 0;
  const discountPct = savings > 0 ? Math.round((savings / Number(viewProduct.price)) * 100) : 0;

  const goPrev = () => setIdx((i) => (i - 1 + galleryFromProduct.length) % galleryFromProduct.length);
  const goNext = () => setIdx((i) => (i + 1) % galleryFromProduct.length);

  const storeLabel = storeView === 'tienda' ? 'Tienda' : storeView === 'bodega1' ? 'Bodega 1' : storeView === 'bodega2' ? 'Bodega 2' : '';

  const confirmDelete = () => {
    toastHOT(
      (t) => (
        <div className="text-center p-2 bg-white rounded-xl">
          <p className="font-black text-black mb-4 text-base">¿Eliminar este producto?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={async () => {
                toastHOT.dismiss(t.id);
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(product._id || product.id)}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json", "x-user": displayName }
                  });
                  if (!res.ok) throw new Error("Error en servidor al eliminar");

                  toastHOT.success("Producto eliminado correctamente.", {
                    style: { borderRadius: '12px', background: '#000', color: '#fff', border: '1px solid #333' }
                  });
                  onUpdate?.(null, product._id || product.id);
                  onClose?.();
                } catch (err) {
                  toastHOT.error("Error al intentar eliminar.");
                  console.error(err);
                  setLoading(false);
                }
              }}
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-red-700 cursor-pointer border border-red-500 shadow-sm"
            >
              ELIMINAR
            </button>
            <button onClick={() => toastHOT.dismiss(t.id)} className="bg-gray-100 text-black px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200 cursor-pointer border border-gray-200">CANCELAR</button>
          </div>
        </div>
      ), { duration: 6000, style: { background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '16px' } }
    );
  };

  return (
    <motion.div
      className="ps-root"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <style>{`
        @font-face {
          font-family: 'FontBarca';
          src: url('/fonts/Barcelona%20Tipografia%20.ttf') format('truetype'),
               url('/fonts/Barcelona Tipografia .ttf') format('truetype'),
               url('/fonts/Barcelona%20Tipografia.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }

        @font-face {
          font-family: 'FontMadrid';
          src: url('/fonts/Real%20Madrid%20Tipografia.ttf') format('truetype'),
               url('/fonts/Real Madrid Tipografia.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }

        @font-face {
          font-family: 'FontBoca';
          src: url('/fonts/Boca%20Tipografia.ttf') format('truetype'),
               url('/fonts/Boca Tipografia.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }

        @font-face {
          font-family: 'FontRiver';
          src: url('/fonts/River%20Tipografia.ttf') format('truetype'),
               url('/fonts/River Tipografia.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }

        .font-barca { font-family: 'FontBarca', sans-serif !important; }
        .font-madrid { font-family: 'FontMadrid', sans-serif !important; }
        .font-boca { font-family: 'FontBoca', sans-serif !important; }
        .font-river { font-family: 'FontRiver', sans-serif !important; }
      `}</style>

      <div aria-hidden="true" className="opacity-0 pointer-events-none fixed -top-96 -left-96 select-none">
        <span style={{ fontFamily: "'FontBarca'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontMadrid'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontBoca'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontRiver'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
      </div>

      <div className="ps-container">
        <button
          type="button"
          onClick={() => { if (isEditing) unlockProduct(); onClose(); }}
          className="ps-back"
        >
          <FaChevronLeft /> Volver al catálogo
        </button>

        {isEditing ? (
          <ProductAdminEditor
            product={product}
            viewProduct={viewProduct}
            API_BASE={API_BASE}
            displayName={displayName}
            onCancel={handleCancelEditClick}
            onSaveSuccess={handleSaveSuccess}
            onDeleteSuccess={handleDeleteSuccess}
            canDelete={canDelete}
            user={user}
          />
        ) : (
          <div className="ps-grid">
            {/* ================= GALERÍA ================= */}
            <div className="ps-gallery">
              <div className="ps-stage">
                {displayUrl ? (
                  <motion.div
                    className="ps-swipe"
                    drag={hasMany ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.25}
                    dragSnapToOrigin
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) goNext();
                      else if (info.offset.x > 60) goPrev();
                    }}
                  >
                    {/* ⚠️ No cambiar este contenedor ni el tamaño de la imagen: el dorsal está calibrado sobre él */}
                    <div className="relative inline-flex items-center justify-center w-full">
                      <motion.img
                        key={displayUrl}
                        src={displayUrl}
                        alt={viewProduct?.name || "Producto"}
                        className="w-full object-contain rounded-2xl select-none ps-img"
                        loading="lazy"
                        draggable={false}
                        initial={{ opacity: 0.35 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.35 }}
                      />

                      <AnimatePresence mode="wait">
                        {selectedDorsal && idx === 1 && (
                          <motion.div
                            key={dorsalAnimKey}
                            variants={heatPressVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-visible"
                          >
                            <div
                              className="overflow-visible"
                              style={{
                                width: currentLayout.boxWidth,
                                transform: `translate(${currentLayout.offsetX}, ${currentLayout.offsetY})`,
                              }}
                            >
                              <svg
                                viewBox="0 0 300 340"
                                className="w-full h-auto overflow-visible"
                                style={{
                                  overflow: "visible",
                                  filter: "drop-shadow(0px 1.5px 1.5px rgba(0,0,0,0.42))",
                                  WebkitFilter: "drop-shadow(0px 1.5px 1.5px rgba(0,0,0,0.42))",
                                }}
                              >
                                <defs>
                                  <path
                                    id="dorsalArcPath"
                                    d={`M -120,${currentLayout.nameY} Q 150,${controlPointY} 420,${currentLayout.nameY}`}
                                    fill="transparent"
                                  />

                                  <linearGradient id="dorsalColorGrad" x1="0%" y1="0%" x2="15%" y2="100%">
                                    <stop offset="0%" stopColor={currentLayout.colorTop} />
                                    <stop offset="55%" stopColor={currentLayout.colorMid} />
                                    <stop offset="100%" stopColor={currentLayout.colorBottom} />
                                  </linearGradient>
                                </defs>

                                {rawNameStr && (
                                  <text
                                    fill="url(#dorsalColorGrad)"
                                    stroke={currentLayout.stroke}
                                    strokeWidth="0.5"
                                    className={activeFontClass}
                                    style={{
                                      fontFamily: activeFontFamily,
                                      fontSize: `${
                                        rawNameStr.length > 9
                                          ? currentLayout.nameSize - 5
                                          : currentLayout.nameSize
                                      }px`,
                                      textTransform: "uppercase",
                                      overflow: "visible",
                                    }}
                                  >
                                    <textPath
                                      href="#dorsalArcPath"
                                      startOffset="50%"
                                      textAnchor="middle"
                                    >
                                      {`\u00A0\u00A0${rawNameStr}\u00A0\u00A0`}
                                    </textPath>
                                  </text>
                                )}

                                {numStr && (
                                  <text
                                    x="150"
                                    y={currentLayout.numberY}
                                    textAnchor="middle"
                                    fill="url(#dorsalColorGrad)"
                                    stroke={currentLayout.stroke}
                                    strokeWidth="0.8"
                                    className={activeFontClass}
                                    style={{
                                      fontFamily: activeFontFamily,
                                      fontSize: `${currentLayout.numberSize}px`,
                                      letterSpacing: numStr.length > 1 ? "-5px" : "0px",
                                      overflow: "visible",
                                    }}
                                  >
                                    {`\u00A0${numStr}\u00A0`}
                                  </text>
                                )}
                              </svg>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <div className="ps-noimg">Sin imagen</div>
                )}

                {hasMany && (
                  <>
                    <button type="button" onClick={goPrev} className="ps-nav ps-nav--prev" aria-label="Imagen anterior"><FaChevronLeft /></button>
                    <button type="button" onClick={goNext} className="ps-nav ps-nav--next" aria-label="Imagen siguiente"><FaChevronRight /></button>
                    <div className="ps-counter">{idx + 1} / {galleryFromProduct.length}</div>
                  </>
                )}
              </div>

              {hasMany && (
                <div className="ps-thumbs">
                  {galleryFromProduct.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      className={`ps-thumb ${i === idx ? "is-active" : ""}`}
                      onClick={() => setIdx(i)}
                      aria-label={`Ver imagen ${i + 1}`}
                    >
                      <img src={transformCloudinary(url, 160)} alt="" loading="lazy" draggable={false} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ================= INFORMACIÓN ================= */}
            <div className="ps-info">
              <div className="ps-tags">
                {viewProduct?.type && <span className="ps-tag">{viewProduct.type}</span>}
                {discountPct > 0 && <span className="ps-tag ps-tag--sale">-{discountPct}%</span>}
                {viewProduct?.isTemporada2627 && <span className="ps-tag ps-tag--gold">Temporada 26/27</span>}
                {viewProduct?.isPopular && <span className="ps-tag ps-tag--light">Popular</span>}
              </div>

              <h1 className="ps-title">{viewProduct?.name}</h1>

              <div className="ps-price">
                <span className="ps-price-now">{formattedPrice}</span>
                {hasDiscount && (
                  <span className="ps-price-old">₡{Number(viewProduct.price).toLocaleString("de-DE")}</span>
                )}
                {savings > 0 && (
                  <span className="ps-price-save">Ahorrás ₡{savings.toLocaleString("de-DE")}</span>
                )}
              </div>

              {isCorteAjustado && (
                <div className="ps-fit">
                  <FaInfoCircle className="ps-fit-icon" />
                  <p>
                    <strong>Corte ajustado (slim fit).</strong> Esta prenda viene reducida: te recomendamos pedir al menos una talla más de la que usás habitualmente.
                  </p>
                </div>
              )}

              {/* Dorsal */}
              {availableDorsals.length > 0 && (
                <div className="ps-block">
                  <div className="ps-block-head">
                    <span className="ps-label"><FaTshirt /> Dorsal <em>(opcional)</em></span>
                  </div>
                  <div className="ps-dorsals">
                    <button
                      type="button"
                      className={`ps-chip ${selectedDorsalIndex === "" ? "is-active" : ""}`}
                      onClick={() => handleDorsalSelectChange({ target: { value: "" } })}
                    >
                      Lisa
                    </button>
                    {availableDorsals.map((opt, i) => (
                      <button
                        key={`dorsal-opt-${i}`}
                        type="button"
                        className={`ps-chip ${String(selectedDorsalIndex) === String(i) ? "is-active" : ""}`}
                        onClick={() => handleDorsalSelectChange({ target: { value: i } })}
                      >
                        {opt.name ? opt.name.toUpperCase() : "JUGADOR"} <b>#{opt.number}</b>
                        {canEdit && <small>{opt.quantity} disp.</small>}
                      </button>
                    ))}
                  </div>
                  {selectedDorsal && galleryFromProduct.length > 1 && (
                    <p className="ps-hint">Así se verá en la espalda 👆</p>
                  )}
                </div>
              )}

              {/* Tallas */}
              <div className="ps-block">
                <div className="ps-block-head">
                  <span className="ps-label">
                    {isLlavero ? 'Unidad' : 'Talla'}
                    {storeLabel && <em>({storeLabel})</em>}
                    {selectedSize && <b className="ps-selected">· {selectedSize}</b>}
                  </span>
                  {!isLlavero && !isBalon && (
                    <button type="button" onClick={() => setOpenMedidas(true)} className="ps-link">
                      <FaRulerCombined /> Guía de tallas
                    </button>
                  )}
                </div>

                <div className="ps-sizes">
                  {tallasVisibles.map((size) => {
                    const total = getTotalBySize(size);
                    const isAgotado = total === 0;
                    const isSelected = selectedSize === size;
                    return (
                      <motion.button
                        key={size}
                        type="button"
                        disabled={isAgotado}
                        onClick={() => setSelectedSize(size)}
                        whileTap={isAgotado ? undefined : { scale: 0.94 }}
                        className={`ps-size ${isAgotado ? "is-out" : ""} ${isSelected ? "is-active" : ""}`}
                        aria-pressed={isSelected}
                        title={isAgotado ? "Agotado" : undefined}
                      >
                        <span>{size === "U" ? "Única" : size}</span>
                        {canEdit && <small>{isAgotado ? 'Agotado' : `${total} disp.`}</small>}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Comprar */}
              <motion.a
                key={ctaShake}
                href={selectedSize ? whatsappUrl : '#'}
                onClick={(e) => {
                  if (!selectedSize) {
                    e.preventDefault();
                    setCtaShake((n) => n + 1);
                    toastHOT.error(isLlavero ? "Debes seleccionar la unidad antes de comprar." : "Debes seleccionar una talla antes de comprar.", {
                      style: { borderRadius: '12px', background: '#000', color: '#fff' }
                    });
                  }
                }}
                target={selectedSize ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className={`ps-buy ${selectedSize ? "is-ready" : ""}`}
                animate={ctaShake ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
                transition={{ duration: 0.4 }}
              >
                <FaWhatsapp />
                <span>{selectedSize ? `Comprar talla ${selectedSize === "U" ? "única" : selectedSize}` : "Comprar por WhatsApp"}</span>
              </motion.a>

              <ul className="ps-trust">
                <li><FaTruck /> Envíos a todo el país</li>
                <li><FaCreditCard /> SINPE, transferencia, efectivo o tarjeta</li>
                <li><FaComments /> Te atendemos por WhatsApp</li>
              </ul>

              {/* Admin */}
              {(canEdit || canDelete) && (
                <div className="ps-admin">
                  {canEdit && (
                    <button type="button" onClick={handleEditClick} disabled={loading} className="ps-admin-btn">
                      <FaEdit /> {loading ? "Procesando..." : "Modificar producto"}
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className="ps-admin-btn ps-admin-btn--danger" disabled={loading} onClick={confirmDelete}>
                      <FaTrashAlt /> Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Medidas
        open={openMedidas}
        onClose={() => setOpenMedidas(false)}
        currentType={viewProduct?.type || "Todos"}
      />
    </motion.div>
  );
}
