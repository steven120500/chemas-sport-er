import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaChevronLeft, FaChevronRight, FaWhatsapp, FaRulerCombined, FaInfoCircle, FaTshirt } from "react-icons/fa";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion"; 
import ProductAdminEditor from "./ProductAdminEditor"; 
import Medidas from "./Medidas";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const MODAL_IMG_MAX_W = 800;

/* =====================================================================
   🎯 PANEL DE CALIBRACIÓN DEL DORSAL (BARÇA, MADRID, BOCA, RIVER)
   ===================================================================== */
const getDorsalLayout = (teamFont) => {
  if (teamFont === 'madrid') {
    return {
      boxWidth: "80%",      
      offsetY: "-15%",       
      offsetX: "-1%",       
      nameY: 123,           
      nameCurve: 120,       
      nameSize: 38,         
      numberY: 285,         
      numberSize: 195,      
      colorTop: "#1A362D",    
      colorMid: "#122A21",    
      colorBottom: "#0A1712", 
      stroke: "rgba(255, 255, 255, 0.15)" 
    };
  }
  
  if (teamFont === 'boca') {
    return {
      boxWidth: "80%",       
      offsetY: "-20%",       
      offsetX: "-0%",       
      nameY: 125,           
      nameCurve: 120,       
      nameSize: 38,         
      numberY: 295,         
      numberSize: 200,      
      colorTop: "#FFFFFF",  
      colorMid: "#F3F4F6",  
      colorBottom: "#E5E7EB", 
      stroke: "rgba(0,0,0,0.1)" 
    };
  }

  if (teamFont === 'river') {
    return {
      boxWidth: "85%",      
      offsetY: "-12%",       
      offsetX: "0%",       
      nameY: 120,           
      nameCurve: 128,       
      nameSize: 38,         
      numberY: 290,         
      numberSize: 198,      
      colorTop: "#333333",  
      colorMid: "#111111",  
      colorBottom: "#000000", 
      stroke: "#FFFFFF"     
    };
  }

  // Por defecto (Barcelona)
  return {
    boxWidth: "90%",      
    offsetY: "-20%",       
    offsetX: "-3%",       
    nameY: 170,           
    nameCurve: 70,       
    nameSize: 50,         
    numberY: 272,         
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
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW},dpr_auto`;
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
    const val = e.target.value;
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

  // 🔥 DETERMINAMOS QUÉ TIPOGRAFÍA Y DISEÑO USAR 🔥
  const getActiveFontFamily = (fontType) => {
    if (fontType === 'madrid') return "'FontMadrid', sans-serif";
    if (fontType === 'boca') return "'FontBoca', sans-serif";
    if (fontType === 'river') return "'FontRiver', sans-serif";
    return "'FontBarca', sans-serif";
  };
  
  const activeFontFamily = getActiveFontFamily(viewProduct?.teamFont);
  const currentLayout = getDorsalLayout(viewProduct?.teamFont);
  
  return (
    <div 
      className="min-h-screen pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up text-black bg-white"
    >
      {/* 🔥 CARGA DIRECTA DESDE /public/fonts/ CON LOS NOMBRES EXACTOS DE TUS ARCHIVOS 🔥 */}
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

        @keyframes heatPressStamp {
          0% {
            opacity: 0;
            transform: scale(1.08) translateY(-6px);
            filter: brightness(1.35) blur(3px);
          }
          50% {
            opacity: 0.96;
            transform: scale(0.99) translateY(0px);
            filter: brightness(1.05) blur(0px);
          }
          100% {
            opacity: 0.95;
            transform: scale(1) translateY(0px);
            filter: brightness(1) blur(0px);
          }
        }

        .animate-heat-press {
          animation: heatPressStamp 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      {/* Pre-cargador invisible para que el navegador tenga lista la fuente antes de elegir dorsal */}
      <div aria-hidden="true" className="opacity-0 pointer-events-none fixed -top-96 -left-96 select-none">
        <span style={{ fontFamily: "'FontBarca'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontMadrid'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontBoca'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
        <span style={{ fontFamily: "'FontRiver'" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</span>
      </div>

      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => { if (isEditing) unlockProduct(); onClose(); }}
          className="flex items-center gap-2 text-gray-500 bg-transparent hover:text-black transition-colors mb-8 font-bold uppercase tracking-widest text-xs cursor-pointer"
        >
          <FaChevronLeft size={14} /> Volver al catálogo
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* LADO IZQUIERDO: GALERÍA DE VISUALIZACIÓN + ESTAMPADO CENTRADO */}
            <div className="w-full">
              <div className="relative flex items-center justify-center bg-gray-50 rounded-3xl p-6 border border-gray-200 shadow-sm overflow-hidden">
                {displayUrl ? (
                  <div className="relative inline-flex items-center justify-center w-full">
                    <img
                      src={displayUrl}
                      alt={viewProduct?.name || "Producto"}
                      className="w-full max-h-[600px] object-contain drop-shadow-lg rounded-2xl select-none"
                      loading="lazy"
                    />

                    {/* 🔥 CAPA DE DORSAL CON ANIMACIÓN PREMIUM (ENTRADA Y SALIDA) 🔥 */}
                    <AnimatePresence mode="wait">
                      {selectedDorsal && idx === 1 && (
                        <motion.div
                          key={dorsalAnimKey}
                          variants={heatPressVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="absolute inset-0 pointer-events-none flex items-center justify-center select-none"
                        >
                          <div
                            style={{
                              width: currentLayout.boxWidth,
                              transform: `translate(${currentLayout.offsetX}, ${currentLayout.offsetY})`,
                            }}
                          >
                            {/* 🔥 SVG CONFIGURADO PARA PREVENIR RECORTES EN MÓVIL (VIEWBOX EXTENDIDO) 🔥 */}
                            <svg
                              viewBox="-100 -50 500 450"
                              preserveAspectRatio="xMidYMid meet"
                              className="w-full h-auto overflow-visible"
                            >
                              <defs>
                                <path
                                  id="dorsalArcPath"
                                  d={`M -20,${currentLayout.nameY} Q 150,${currentLayout.nameCurve} 320,${currentLayout.nameY}`}
                                  fill="transparent"
                                />

                                <linearGradient id="dorsalColorGrad" x1="0%" y1="0%" x2="15%" y2="100%">
                                  <stop offset="0%" stopColor={currentLayout.colorTop} />
                                  <stop offset="55%" stopColor={currentLayout.colorMid} />
                                  <stop offset="100%" stopColor={currentLayout.colorBottom} />
                                </linearGradient>

                                {/* FilterUnits engaña al iPhone para no recortar la sombra */}
                                <filter id="dorsalDropShadow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="500">
                                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="rgba(0,0,0,0.42)" />
                                </filter>
                              </defs>

                              {/* 1. NOMBRE DEL JUGADOR CENTRADO EN LA ESPALDA ALTA */}
                              {selectedDorsal.name && (
                                <g filter="url(#dorsalDropShadow)">
                                  <text
                                    fill="url(#dorsalColorGrad)"
                                    stroke={currentLayout.stroke}
                                    strokeWidth="0.5"
                                    style={{
                                      fontFamily: activeFontFamily,
                                      fontSize: `${
                                        selectedDorsal.name.length > 9
                                          ? currentLayout.nameSize - 5
                                          : currentLayout.nameSize
                                      }px`,
                                      letterSpacing: "2px",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    <textPath href="#dorsalArcPath" startOffset="50%" textAnchor="middle">
                                      {selectedDorsal.name.toUpperCase()}
                                    </textPath>
                                  </text>
                                </g>
                              )}

                              {/* 2. NÚMERO CENTRADO EN EL MEDIO DE LA CAMISETA */}
                              {numStr && (
                                <g filter="url(#dorsalDropShadow)">
                                  <text
                                    x="150"
                                    y={currentLayout.numberY}
                                    textAnchor="middle"
                                    fill="url(#dorsalColorGrad)"
                                    stroke={currentLayout.stroke}
                                    strokeWidth="0.8"
                                    style={{
                                      fontFamily: activeFontFamily,
                                      fontSize: `${currentLayout.numberSize}px`,
                                      letterSpacing: numStr.length > 1 ? "-5px" : "0px",
                                    }}
                                  >
                                    {numStr}
                                  </text>
                                </g>
                              )}
                            </svg>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="h-[400px] w-full grid place-items-center text-gray-400 bg-gray-100 rounded-3xl"><span className="font-semibold">Sin imagen</span></div>
                )}

                {hasMany && (
                  <>
                    <button onClick={() => setIdx((i) => (i - 1 + galleryFromProduct.length) % galleryFromProduct.length)} className="absolute left-4 z-10 bg-white text-black p-4 rounded-full transition-all hover:scale-105 hover:border-black cursor-pointer shadow-md border border-gray-200"><FaChevronLeft size={20} /></button>
                    <button onClick={() => setIdx((i) => (i + 1) % galleryFromProduct.length)} className="absolute right-4 z-10 bg-white text-black p-4 rounded-full transition-all hover:scale-105 hover:border-black cursor-pointer shadow-md border border-gray-200"><FaChevronRight size={20} /></button>
                    <div className="absolute bottom-6 bg-white border border-gray-200 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">{idx + 1} / {galleryFromProduct.length}</div>
                  </>
                )}
              </div>
            </div>

            {/* LADO DERECHO: INFO Y TALLAS / UNIDADES */}
            <div className="w-full flex flex-col">
              <div className="mb-8">
                <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm border border-black">{viewProduct?.type}</span>
                <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-black leading-tight tracking-tight mb-6">{viewProduct?.name}</h1>
                {hasDiscount ? (
                  <div className="flex flex-col items-start mb-6">
                      <span className="bg-green-500 border border-green-600 text-white text-[10px] font-black px-3 py-1 rounded-full mb-2 uppercase tracking-widest shadow-sm">Oferta</span>
                      <div className="flex items-end gap-4">
                        <p className="line-through text-gray-400 text-2xl font-medium pb-1">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                        <p className="text-5xl font-black text-black tracking-tight">₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}</p>
                      </div>
                  </div>
                ) : (
                  <p className="text-5xl font-black text-black tracking-tight mb-6">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                )}

                {/* 🔥 AVISO PREMIUM DE CORTE AJUSTADO (Solo en Player y Mujer) 🔥 */}
                {isCorteAjustado && (
                  <div className="relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex-shrink-0 bg-black text-white p-2.5 rounded-xl shadow-sm">
                        <FaInfoCircle size={18} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-widest text-black">
                            Corte Ajustado (Slim Fit)
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 font-medium mt-0.5 leading-snug">
                          Esta prenda viene reducida. <span className="text-black font-black underline decoration-gray-300 underline-offset-4">Te recomendamos pedir al menos una talla más</span> de la que usas habitualmente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🔥 SELECT DESPLEGABLE DE DORSALES (SOLO SI HAY STOCK > 0) 🔥 */}
              {availableDorsals.length > 0 && (
                <div className="mb-8 p-5 rounded-3xl border border-gray-200 bg-gray-50 shadow-sm">
                  <label className="block text-xs font-black text-black uppercase tracking-widest mb-2.5 flex items-center gap-2">
                    <FaTshirt className="text-black" size={14} />
                    Seleccionar Dorsal (Opcional)
                  </label>

                  <div className="relative">
                    <select
                      value={selectedDorsalIndex}
                      onChange={handleDorsalSelectChange}
                      className="w-full appearance-none bg-white border-2 border-gray-300 hover:border-black focus:border-black rounded-2xl px-4 py-3.5 pr-10 text-sm font-black text-black uppercase tracking-wider outline-none transition-all cursor-pointer shadow-sm"
                    >
                      <option value="">Sin Dorsal (Camiseta Lisa)</option>
                      {availableDorsals.map((opt, i) => (
                        <option key={`dorsal-opt-${i}`} value={i}>
                          {opt.name ? opt.name.toUpperCase() : "JUGADOR"} — #{opt.number}
                          {canEdit ? ` (${opt.quantity} disp.)` : ""}
                        </option>
                      ))}
                    </select>

                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-black">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-8">
                {/* 🔥 CABECERA DE TALLAS + BOTÓN PREMIUM DE VER MEDIDAS 🔥 */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    {isLlavero ? 'Selecciona la Unidad' : 'Selecciona una Talla'} {storeView === 'tienda' ? '(Tienda)' : storeView === 'bodega1' ? '(Bodega 1)' : storeView === 'bodega2' ? '(Bodega 2)' : ''}
                  </p>

                  {!isLlavero && !isBalon && (
                    <button
                      type="button"
                      onClick={() => setOpenMedidas(true)}
                      className="flex items-center gap-2 bg-white hover:bg-black text-black hover:text-white border border-gray-300 hover:border-black px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      <FaRulerCombined size={13} />
                      Guía de Medidas
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {tallasVisibles.map((size) => {
                      const total = getTotalBySize(size);
                      const isAgotado = total === 0;
                      const isBodega2 = storeView === 'bodega2';
                      const isSelected = selectedSize === size;

                      return (
                          <div 
                            key={size} 
                            onClick={() => {
                              if (!isAgotado) setSelectedSize(size);
                            }}
                            className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl border-2 transition-all select-none overflow-hidden 
                              ${isAgotado 
                                  ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed' 
                                  : isSelected
                                      ? 'border-black bg-black shadow-md scale-[1.02] cursor-pointer'
                                      : isBodega2 
                                          ? 'border-gray-300 bg-gray-50 shadow-sm cursor-pointer hover:border-black' 
                                          : 'border-gray-300 bg-white shadow-sm cursor-pointer hover:border-black'
                              }`}
                          >
                              <span className={`text-base font-black z-10 ${isAgotado ? 'text-gray-400' : isSelected ? 'text-white' : 'text-black'}`}>
                                {size}
                              </span>
                              {canEdit && (
                                <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-widest z-10 ${isAgotado ? 'text-gray-400' : isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {isAgotado ? 'Agotado' : `${total} disp.`}
                                </span>
                              )}
                              {isAgotado && <svg className="absolute inset-0 w-full h-full text-gray-200" preserveAspectRatio="none" viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
                          </div>
                      );
                  })}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex flex-col gap-3">
                  {canEdit && (
                    <button onClick={handleEditClick} disabled={loading} className="w-full bg-black hover:bg-zinc-800 text-white flex items-center justify-center gap-2 py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-md cursor-pointer disabled:opacity-50 transition-colors">
                      {loading ? "PROCESANDO..." : "MODIFICAR PRODUCTO"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="w-full bg-transparent border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer transition-colors"
                      disabled={loading}
                      onClick={() => {
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
                      }}
                    >
                      ELIMINAR PRODUCTO
                    </button>
                  )}

                  <a
                    href={selectedSize ? whatsappUrl : '#'}
                    onClick={(e) => {
                      if (!selectedSize) {
                        e.preventDefault();
                        toastHOT.error(isLlavero ? "Debes seleccionar la unidad antes de comprar." : "Debes seleccionar una talla antes de comprar.", { 
                          style: { borderRadius: '12px', background: '#000', color: '#fff' }
                        });
                      }
                    }}
                    target={selectedSize ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className="w-full bg-green-500 hover:bg-green-600 text-white outline-none focus:outline-none border-none py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-md transition-transform hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-3 mt-2"
                  >
                    <FaWhatsapp size={22} />
                    COMPRAR POR WHATSAPP
                  </a>
                  
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      <Medidas
        open={openMedidas}
        onClose={() => setOpenMedidas(false)}
        currentType={viewProduct?.type || "Todos"}
      />
    </div>
  );
}