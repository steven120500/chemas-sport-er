import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaChevronLeft, FaChevronRight, FaWhatsapp } from "react-icons/fa";
import { io } from "socket.io-client";
import ProductAdminEditor from "./ProductAdminEditor"; 

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const MODAL_IMG_MAX_W = 800;

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

  const displayName = user?.username || user?.email || "ChemaSportER";

  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(viewProduct?.images) && viewProduct.images.length > 0) {
      return viewProduct.images.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
    }
    return [viewProduct?.imageSrc, viewProduct?.imageSrc2].filter(Boolean);
  }, [viewProduct]);

  useEffect(() => {
    setViewProduct(product);
    setIdx(0);
    setSelectedSize(""); 
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

  const isNino = viewProduct?.type === "Niño";
  const isBalon = viewProduct?.type === "Balón" || viewProduct?.type === "Balones";
  const isLlavero = viewProduct?.type === "Llaveros";
  const tallasVisibles = isLlavero ? ["U"] : (isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO);
  
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

  const whatsappMsg = `¡Hola! Me interesa realizar este pedido:\n\n*Artículo:* ${viewProduct?.name || 'Producto'}\n\n*Talla/Unidad:* ${selectedSize || ''}\n\n*Precio:* ${formattedPrice}\n\n*Enlace del producto:* ${productLink}`;

  const whatsappUrl = `https://wa.me/50660369857?text=${encodeURIComponent(whatsappMsg)}`;

  return (
    <div 
      className="min-h-screen pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up text-white"
      // 🔥 Fondo transparente para que el degradado del App.jsx fluya directo al Footer sin rayas 🔥
      style={{ backgroundColor: 'transparent' }}
    >
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => { if (isEditing) unlockProduct(); onClose(); }}
          className="flex items-center gap-2 text-gray-400 bg-transparent hover:text-yellow-500 transition-colors mb-8 font-bold uppercase tracking-widest text-xs cursor-pointer"
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
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* LADO IZQUIERDO: GALERÍA DE VISUALIZACIÓN */}
            <div className="w-full">
              <div className="relative flex items-center justify-center bg-[#0a0a0a] rounded-3xl p-6 border border-[#222] shadow-[0_0_30px_rgba(234,179,8,0.05)]">
                {displayUrl ? (
                  <img src={displayUrl} alt={viewProduct?.name || "Producto"} className="w-full max-h-[600px] object-contain drop-shadow-2xl rounded-2xl" loading="lazy" />
                ) : (
                  <div className="h-[400px] w-full grid place-items-center text-gray-500 bg-[#111] rounded-3xl"><span className="font-semibold">Sin imagen</span></div>
                )}
                {hasMany && (
                  <>
                    <button onClick={() => setIdx((i) => (i - 1 + galleryFromProduct.length) % galleryFromProduct.length)} className="absolute left-4 z-10 bg-yellow-500 text-black p-4 rounded-full transition-all hover:scale-105 cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-400"><FaChevronLeft size={20} /></button>
                    <button onClick={() => setIdx((i) => (i + 1) % galleryFromProduct.length)} className="absolute right-4 z-10 bg-yellow-500 text-black p-4 rounded-full transition-all hover:scale-105 cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-400"><FaChevronRight size={20} /></button>
                    <div className="absolute bottom-6 bg-[#111] border border-[#333] text-yellow-500 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">{idx + 1} / {galleryFromProduct.length}</div>
                  </>
                )}
              </div>
            </div>

            {/* LADO DERECHO: INFO Y TALLAS / UNIDADES */}
            <div className="w-full flex flex-col">
              <div className="mb-8">
                <span className="inline-block bg-yellow-500 text-black px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm border border-yellow-400">{viewProduct?.type}</span>
                <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-yellow-500 leading-tight tracking-tight mb-6">{viewProduct?.name}</h1>
                {hasDiscount ? (
                  <div className="flex flex-col items-start mb-6">
                      <span className="bg-[#111] border border-[#333] text-yellow-500 text-[10px] font-black px-3 py-1 rounded-full mb-2 uppercase tracking-widest shadow-sm">Oferta</span>
                      <div className="flex items-end gap-4">
                        <p className="line-through text-gray-500 text-2xl font-medium pb-1">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                        <p className="text-5xl font-black text-yellow-500 tracking-tight drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}</p>
                      </div>
                  </div>
                ) : (
                  <p className="text-5xl font-black text-yellow-500 tracking-tight mb-6 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                )}
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  {isLlavero ? 'Selecciona la Unidad' : 'Selecciona una Talla'} {storeView === 'tienda' ? '(Tienda)' : storeView === 'bodega1' ? '(Bodega 1)' : storeView === 'bodega2' ? '(Bodega 2)' : ''}
                </p>
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
                                  ? 'border-[#222] bg-[#111] opacity-60 cursor-not-allowed' 
                                  : isSelected
                                      ? 'border-yellow-500 bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.02] cursor-pointer'
                                      : isBodega2 
                                          ? 'border-purple-900/50 bg-purple-900/20 shadow-sm cursor-pointer hover:border-purple-500' 
                                          : 'border-[#333] bg-[#0a0a0a] shadow-sm cursor-pointer hover:border-yellow-500'
                              }`}
                          >
                              <span className={`text-base font-black z-10 ${isAgotado ? 'text-gray-600' : isSelected ? 'text-black' : isBodega2 ? 'text-purple-400' : 'text-gray-300'}`}>
                                {size}
                              </span>
                              {canEdit && (
                                <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-widest z-10 ${isAgotado ? 'text-gray-600' : isSelected ? 'text-black/70' : 'text-gray-500'}`}>
                                  {isAgotado ? 'Agotado' : `${total} disp.`}
                                </span>
                              )}
                              {isAgotado && <svg className="absolute inset-0 w-full h-full text-[#333]" preserveAspectRatio="none" viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
                          </div>
                      );
                  })}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex flex-col gap-3">
                  {canEdit && (
                    <button onClick={handleEditClick} disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black flex items-center justify-center gap-2 py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-[0_5px_15px_rgba(234,179,8,0.3)] cursor-pointer disabled:opacity-50">
                      {loading ? "PROCESANDO..." : "MODIFICAR PRODUCTO"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="w-full bg-transparent border border-[#333] text-red-500 hover:bg-red-950/20 hover:border-red-900/50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer transition-colors"
                      disabled={loading}
                      onClick={() => {
                        toastHOT(
                          (t) => (
                            <div className="text-center p-2 bg-[#111] rounded-xl border border-[#333]">
                              <p className="font-black text-gray-200 mb-4 text-base">¿Eliminar este producto?</p>
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
                                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-red-700 cursor-pointer border border-red-500"
                                >
                                  ELIMINAR
                                </button>
                                <button onClick={() => toastHOT.dismiss(t.id)} className="bg-[#222] text-gray-300 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-[#333] cursor-pointer border border-[#444]">CANCELAR</button>
                              </div>
                            </div>
                          ), { duration: 6000, style: { background: 'transparent', boxShadow: 'none', padding: 0 } }
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
                          style: { borderRadius: '12px', background: '#111', color: '#fff', border: '1px solid #333' }
                        });
                      }
                    }}
                    target={selectedSize ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className="w-full bg-green-500 hover:bg-green-600 text-white hover:text-white outline-none focus:outline-none border-none decoration-transparent hover:decoration-transparent py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-[0_5px_15px_rgba(34,197,94,0.3)] transition-transform hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-3"
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
    </div>
  );
}