import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaStore, FaWarehouse, FaBoxOpen } from "react-icons/fa";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const ACCEPTED_TYPES = ["image/png", "image/jpg", "image/jpeg", "image/heic"];
const THUMB_MAX_W = 240;

function transformCloudinary(url, maxW) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return url;
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return url;
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW},dpr_auto`;
    u.pathname = `${parts[0]}/upload/${transforms}/${parts}`;
    return u.toString();
  } catch {
    return url;
  }
}

function isLikelyObjectId(v) {
  return typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
}

export default function ProductAdminEditor({
  product,
  viewProduct,
  API_BASE,
  displayName,
  onCancel,
  onSaveSuccess,
  onDeleteSuccess,
  canDelete,
}) {
  const [invMode, setInvMode] = useState("stock"); 
  const [editedTienda, setEditedTienda] = useState(product?.tienda || {}); 
  const [editedStock, setEditedStock] = useState(product?.stock || {}); 
  const [editedBodega, setEditedBodega] = useState(product?.bodega || {}); 
  
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0);
  const [editedType, setEditedType] = useState(product?.type || "Player");
  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);
  const [editedIsMundial2026, setEditedIsMundial2026] = useState(product?.isMundial2026 || false);
  const [editedIsTemporada2627, setEditedIsTemporada2627] = useState(product?.isTemporada2627 || false);
  
  const [loading, setLoading] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [confirmCommission, setConfirmCommission] = useState(false); 
  const [buyerName, setBuyerName] = useState("");

  const [localImages, setLocalImages] = useState([]);

  useEffect(() => {
    setLocalImages(
      product?.images?.length
        ? product.images.map((img) => ({ src: typeof img === "string" ? img : img.url, isNew: false }))
        : [
            ...(product?.imageSrc ? [{ src: product.imageSrc, isNew: false }] : []),
            ...(product?.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : []),
          ]
    );
  }, [product]);

  const isNino = editedType === "Niño";
  const isBalon = editedType === "Balón" || editedType === "Balones";
  const isLlavero = editedType === "Llaveros";
  const tallasVisibles = isLlavero ? ["U"] : (isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO);

  const handleStockChange = (size, value) => {
    const val = parseInt(value, 10) || 0;
    if (invMode === "tienda") setEditedTienda(prev => ({ ...prev, [size]: val }));
    else if (invMode === "stock") setEditedStock(prev => ({ ...prev, [size]: val }));
    else setEditedBodega(prev => ({ ...prev, [size]: val }));
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files?.[0];
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLocalImages((prev) => {
        const copy = prev.slice();
        if (index >= copy.length) copy.push({ src: reader.result, isNew: true });
        else copy[index] = { src: reader.result, isNew: true };
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (index) => {
    setLocalImages((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
  };

  const getInventoryChanges = () => {
    const changes = [];
    const baseTienda = viewProduct?.tienda || product?.tienda || {};
    const baseStock = viewProduct?.stock || product?.stock || {};
    const baseBodega = viewProduct?.bodega || product?.bodega || {};

    tallasVisibles.forEach((size) => {
      const oldTienda = parseInt(baseTienda[size] ?? 0, 10);
      const newTienda = parseInt(editedTienda?.[size] ?? 0, 10);
      if (oldTienda !== newTienda) changes.push(`Tienda [${size}]: ${oldTienda} -> ${newTienda}`);

      const oldStock = parseInt(baseStock[size] ?? 0, 10);
      const newStock = parseInt(editedStock?.[size] ?? 0, 10);
      if (oldStock !== newStock) changes.push(`Bodega 1 [${size}]: ${oldStock} -> ${newStock}`);

      const oldBodega = parseInt(baseBodega[size] ?? 0, 10);
      const newBodega = parseInt(editedBodega?.[size] ?? 0, 10);
      if (oldBodega !== newBodega) changes.push(`Bodega 2 [${size}]: ${oldBodega} -> ${newBodega}`);
    });
    return changes;
  };

  const checkHasDeduction = () => {
    if (isLlavero) return false;

    let decreased = false;
    const baseTienda = viewProduct?.tienda || product?.tienda || {};
    const baseStock = viewProduct?.stock || product?.stock || {};
    const baseBodega = viewProduct?.bodega || product?.bodega || {};

    tallasVisibles.forEach((size) => {
      if (parseInt(baseTienda[size] ?? 0, 10) > parseInt(editedTienda?.[size] ?? 0, 10)) decreased = true;
      if (parseInt(baseStock[size] ?? 0, 10) > parseInt(editedStock?.[size] ?? 0, 10)) decreased = true;
      if (parseInt(baseBodega[size] ?? 0, 10) > parseInt(editedBodega?.[size] ?? 0, 10)) decreased = true;
    });
    return decreased;
  };

  const handleSave = async (clientName = "", isSale = false) => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID de producto inválido");

    try {
      setLoading(true);
      const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)]));
      const cleanTienda = clean(editedTienda);
      const cleanStock = clean(editedStock);
      const cleanBodega = clean(editedBodega);

      const finalCustomer = clientName || (isSale ? "Cliente General / Tienda" : "Ajuste de inventario");
      const clientTag = isSale && finalCustomer ? `👤 Cliente: ${finalCustomer} | ` : "";

      const payload = {
        productId: id,
        name: editedName.trim(), 
        price: Math.max(0, parseInt(editedPrice, 10) || 0),
        discountPrice: Math.max(0, parseInt(editedDiscountPrice, 10) || 0), 
        type: editedType.trim(),
        tienda: cleanTienda, 
        stock: cleanStock,   
        bodega: cleanBodega, 
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc: typeof localImages[0]?.src === "string" ? localImages[0].src : null,
        imageSrc2: typeof localImages[1]?.src === "string" ? localImages[1].src : null,
        imageAlt: editedName.trim(), 
        hidden: editedHidden, 
        isMundial2026: editedIsMundial2026,
        isTemporada2627: editedIsTemporada2627, 
        customerName: finalCustomer,
        sellerName: displayName,
        user: displayName,
        isSale: Boolean(isSale),
        details: `${clientTag}[ID:${id}] | ${getInventoryChanges().join(" | ")}`, 
      };
      
      let tiendaModificada = [];
      const tiendaVieja = viewProduct?.tienda || product?.tienda || {};
      const stockViejo = viewProduct?.stock || product?.stock || {};
      const bodegaVieja = viewProduct?.bodega || product?.bodega || {};
      
      if (tallasVisibles.some((size) => parseInt(tiendaVieja[size] ?? 0, 10) !== parseInt(cleanTienda[size] ?? 0, 10))) tiendaModificada.push("Tienda");
      if (tallasVisibles.some((size) => parseInt(stockViejo[size] ?? 0, 10) !== parseInt(cleanStock[size] ?? 0, 10))) tiendaModificada.push("Bodega 1");
      if (tallasVisibles.some((size) => parseInt(bodegaVieja[size] ?? 0, 10) !== parseInt(cleanBodega[size] ?? 0, 10))) tiendaModificada.push("Bodega 2");
      const etiquetaTienda = tiendaModificada.length > 0 ? tiendaModificada.join(" y ") : "";

      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json", "x-user": displayName },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error("La foto es demasiado pesada.");
        throw new Error("Error en el servidor al guardar.");
      }

      const dbUpdatedProduct = await res.json();
      onSaveSuccess(dbUpdatedProduct);

      if (isSale) {
        toast.success(etiquetaTienda ? `Venta registrada en ${etiquetaTienda}.` : "Venta registrada correctamente.");
      } else {
        toast.success(etiquetaTienda ? `Cambio realizado en ${etiquetaTienda}.` : "Cambios guardados correctamente.");
      }

    } catch (err) {
      console.error("Error al guardar:", err);
      toast.error(err.message === "La foto es demasiado pesada." ? "La foto pesa mucho. Intenta subir una más ligera." : "Error al procesar datos");
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID inválido");

    try {
      setLoading(true);
      
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE", 
        headers: { "Content-Type": "application/json", "x-user": displayName },
      });

      if (!res.ok) throw new Error("Error en el servidor al eliminar");

      onDeleteSuccess(id);
      toast.success("Producto eliminado correctamente.");

    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("Error al eliminar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start w-full">
        {/* LADO IZQUIERDO: IMÁGENES */}
        <div className="w-full">
          <div 
            className="flex gap-4 justify-center flex-wrap p-8 rounded-3xl border border-gray-800"
            style={{ backgroundColor: '#111' }}
          >
            {localImages.map((img, i) => {
              const thumbUrl = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : "";
              return (
                <div key={i} className="relative group">
                  <img src={thumbUrl || img.src} alt={`img-${i}`} className="h-40 w-40 object-cover rounded-2xl shadow-sm border border-gray-800" />
                  <button onClick={() => handleImageRemove(i)} className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-2.5 shadow-lg hover:bg-red-700 cursor-pointer">
                    <FaTimes size={12} />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-2.5 rounded-b-2xl">
                    <label className="text-white text-xs cursor-pointer font-bold tracking-wide">
                      CAMBIAR
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
                    </label>
                  </div>
                </div>
              );
            })}
            {localImages.length < 2 && (
              <label 
                className="h-40 w-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl cursor-pointer hover:border-yellow-500 transition-colors"
                style={{ backgroundColor: '#1a1a1a' }}
              >
                <span className="text-3xl mb-1 text-yellow-500">+</span>
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-500">Añadir Foto</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, localImages.length)} />
              </label>
            )}
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="w-full flex flex-col">
          <div className="mb-8">
            <label className="block text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-widest ml-1">Tipo</label>
            <select 
              value={editedType} 
              onChange={(e) => setEditedType(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-800 rounded-xl mb-4 font-semibold outline-none cursor-pointer focus:border-yellow-500 transition-colors"
              style={{ backgroundColor: '#111', color: '#fff' }}
            >
              {["Player", "Fan", "Mujer", "Nacional", "Abrigos", "Retro", "Niño", "F1", "NBA", "MLB", "NFL", "Balón", "Llaveros"].map((t) => <option key={t} value={t} style={{ backgroundColor: '#111', color: '#fff' }}>{t}</option>)}
            </select>

            <label className="block text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-widest ml-1">Nombre</label>
            <input 
              type="text" 
              className="w-full border border-gray-800 rounded-xl px-4 py-3 text-lg font-black outline-none mb-4 focus:border-yellow-500 transition-colors" 
              style={{ backgroundColor: '#111', color: '#fff' }}
              value={editedName} 
              onChange={(e) => setEditedName(e.target.value)} 
            />

            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-widest ml-1">Precio</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-800 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-yellow-500 transition-colors" 
                  style={{ backgroundColor: '#111', color: '#fff' }}
                  value={editedPrice} 
                  onChange={(e) => setEditedPrice(e.target.value)} 
                />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-yellow-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Descuento</label>
                <input 
                  type="number" 
                  className="w-full border border-yellow-500/50 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-yellow-400 transition-colors" 
                  style={{ backgroundColor: '#111', color: '#eab308' }}
                  value={editedDiscountPrice} 
                  onChange={(e) => setEditedDiscountPrice(e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* INVENTARIO */}
          <div className="mb-8">
            <div 
              className="rounded-3xl p-6 border border-gray-800 shadow-lg"
              style={{ backgroundColor: '#111' }}
            >
              <p className="text-center font-bold text-yellow-500 uppercase tracking-widest mb-5 text-xs">Modificando Inventario</p>
              
              <div className="flex gap-2 mb-6">
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "stock" ? "border-blue-500 shadow-lg shadow-blue-900/30" : "border-gray-800 hover:border-blue-500/50"}`} 
                  style={{ 
                    backgroundColor: invMode === "stock" ? 'rgba(30, 58, 138, 0.3)' : '#1a1a1a', 
                    color: invMode === "stock" ? '#60a5fa' : '#9ca3af' 
                  }}
                  onClick={() => setInvMode("stock")}
                >
                  <FaBoxOpen size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Bodega 1</span>
                </button>
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "bodega" ? "border-purple-500 shadow-lg shadow-purple-900/30" : "border-gray-800 hover:border-purple-500/50"}`} 
                  style={{ 
                    backgroundColor: invMode === "bodega" ? 'rgba(88, 28, 135, 0.3)' : '#1a1a1a', 
                    color: invMode === "bodega" ? '#c084fc' : '#9ca3af' 
                  }}
                  onClick={() => setInvMode("bodega")}
                >
                  <FaWarehouse size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Bodega 2</span>
                </button>
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "tienda" ? "border-yellow-400 shadow-lg shadow-yellow-500/30" : "border-gray-800 hover:border-yellow-500/50"}`} 
                  style={{ 
                    backgroundColor: invMode === "tienda" ? '#eab308' : '#1a1a1a', 
                    color: invMode === "tienda" ? '#000000' : '#9ca3af' 
                  }}
                  onClick={() => setInvMode("tienda")}
                >
                  <FaStore size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Tienda</span>
                </button>
              </div>

              <div 
                className="p-5 rounded-2xl border transition-colors duration-300"
                style={{ 
                  backgroundColor: invMode === "tienda" ? 'rgba(234, 179, 8, 0.05)' : invMode === "stock" ? 'rgba(59, 130, 246, 0.05)' : 'rgba(168, 85, 247, 0.05)',
                  borderColor: invMode === "tienda" ? 'rgba(234, 179, 8, 0.2)' : invMode === "stock" ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)'
                }}
              >
                <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                  {tallasVisibles.map((size) => {
                    const currentVal = invMode === "tienda" ? editedTienda[size] : invMode === "stock" ? editedStock[size] : editedBodega[size];
                    const inputFocusColor = invMode === "tienda" ? "focus:border-yellow-500" : invMode === "stock" ? "focus:border-blue-500" : "focus:border-purple-500";
                    const labelColor = invMode === "tienda" ? "#eab308" : invMode === "stock" ? "#60a5fa" : "#c084fc";

                    return (
                      <div key={size} className="relative mt-2">
                        <div 
                          className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 px-2 text-[10px] font-black tracking-widest uppercase z-10"
                          style={{ backgroundColor: '#1a1a1a', color: labelColor }}
                        >
                          {size}
                        </div>
                        <input 
                          type="number" 
                          min="0" 
                          className={`w-full h-12 pt-1 border border-gray-700 rounded-2xl text-center font-black text-lg focus:outline-none transition-all ${inputFocusColor} ${!currentVal ? 'opacity-60 shadow-sm' : 'shadow-md shadow-black/50'}`} 
                          style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}
                          value={currentVal || ""} 
                          placeholder="0" 
                          onWheel={(e) => e.target.blur()} 
                          onChange={(e) => handleStockChange(size, e.target.value)} 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="mb-8 p-5 rounded-2xl border border-gray-800"
            style={{ backgroundColor: '#111' }}
          >
            <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest mb-4">Opciones del Sistema</p>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedHidden} onChange={(e) => setEditedHidden(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedHidden ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedHidden ? 'transform translate-x-5 bg-black' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-gray-200">Ocultar Producto</span>
                  <span className="text-xs text-gray-500 font-medium">Nadie podrá verlo en la tienda.</span>
                </div>
              </label>

              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedIsMundial2026} onChange={(e) => setEditedIsMundial2026(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedIsMundial2026 ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsMundial2026 ? 'transform translate-x-5 bg-black' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-gray-200">Torneo: Mundial 2026</span>
                  <span className="text-xs text-gray-500 font-medium">Aparecerá en el filtro especial.</span>
                </div>
              </label>

              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedIsTemporada2627} onChange={(e) => setEditedIsTemporada2627(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedIsTemporada2627 ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsTemporada2627 ? 'transform translate-x-5 bg-black' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-gray-200">Temporada 26-27</span>
                  <span className="text-xs text-gray-500 font-medium">Muestra el sello circular vintage en la chema.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-transform cursor-pointer"
              onClick={() => {
                const changes = getInventoryChanges();
                toastHOT(
                  (t) => (
                    <div className="text-center p-2 rounded-xl border border-gray-800" style={{ backgroundColor: '#111' }}>
                      <p className="font-black text-white mb-2 text-base">¿Seguro que quieres guardar estos cambios?</p>
                      {changes.length > 0 ? (
                        <div className="text-left border border-gray-800 p-3 rounded-xl mb-4 text-xs font-mono text-gray-300 max-h-32 overflow-y-auto shadow-inner" style={{ backgroundColor: '#1a1a1a' }}>
                          {changes.map((change, i) => (<div key={i} className="py-1">{change}</div>))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mb-4 font-medium">Se actualizarán los datos generales.</p>
                      )}
                      <div className="flex gap-3 justify-center mt-2">
                        <button 
                          onClick={() => { 
                            toastHOT.dismiss(t.id); 
                            if (checkHasDeduction()) {
                              setConfirmCommission(false); 
                              setShowBuyerModal(true);
                            } else {
                              handleSave("", false); 
                            }
                          }} 
                          className="bg-yellow-500 text-black px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-yellow-400 cursor-pointer shadow-md"
                        >
                          SÍ, GUARDAR
                        </button>
                        <button onClick={() => toastHOT.dismiss(t.id)} className="text-gray-300 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-800 cursor-pointer border border-gray-700" style={{ backgroundColor: '#222' }}>
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  ), { duration: 8000, style: { background: 'transparent', boxShadow: 'none', padding: 0 } }
                );
              }}
              disabled={loading}
            >
              {loading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
            </button>
            <button 
              className="w-full bg-transparent border-2 border-gray-800 text-gray-400 hover:text-white py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer transition-colors" 
              style={{ hover: { backgroundColor: '#111' } }}
              onClick={onCancel} 
              disabled={loading}
            >
              CANCELAR EDICIÓN
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 MODAL MULTI-PASO DE VENTA */}
      {showBuyerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div 
            className="rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-gray-800 flex flex-col items-center text-center relative"
            style={{ backgroundColor: '#111' }}
          >
            
            {!confirmCommission ? (
              <>
                {/* PASO 1: OBTENER EL NOMBRE */}
                <div className="w-14 h-14 rounded-2xl bg-yellow-500 text-black flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(234,179,8,0.4)] text-2xl">👤</div>
                <h3 className="text-xl font-black text-white mb-1">¿Quién compró esta camiseta?</h3>
                <p className="text-xs text-gray-400 mb-6 font-medium leading-relaxed">Notamos que rebajaste existencias del inventario. Ingresa el nombre del cliente para dejarlo registrado.</p>
                <div className="w-full relative mb-6">
                  <input 
                    type="text" 
                    placeholder="Ej: Emanuel Espinoza" 
                    className="w-full px-4 py-3.5 border border-gray-700 rounded-2xl font-bold text-white text-center text-sm focus:border-yellow-500 focus:outline-none shadow-inner transition-colors" 
                    style={{ backgroundColor: '#0a0a0a' }}
                    value={buyerName} 
                    onChange={(e) => setBuyerName(e.target.value)} 
                    autoFocus 
                  />
                </div>
                
                <div className="flex gap-3 w-full">
                  <button 
                    type="button" 
                    onClick={() => { 
                      if (!buyerName.trim()) {
                        toast.error("Debes ingresar el nombre del cliente para registrar la venta.", { style: { background: '#111', color: '#fff' }});
                        return;
                      }
                      setConfirmCommission(true); 
                    }} 
                    disabled={loading} 
                    className="flex-1 bg-yellow-500 text-black font-black py-4 rounded-2xl text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:bg-yellow-400 transition-colors cursor-pointer"
                  >
                    REGISTRAR VENTA
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { 
                      setShowBuyerModal(false); 
                      handleSave(buyerName.trim(), false);
                      setBuyerName(""); 
                    }} 
                    disabled={loading} 
                    className="flex-1 text-gray-300 font-bold py-4 rounded-2xl text-xs uppercase tracking-wider hover:bg-gray-800 transition-colors cursor-pointer border border-gray-700"
                    style={{ backgroundColor: '#222' }}
                  >
                    SOLO ACTUALIZAR
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* PASO 2: CONFIRMAR LA COMISIÓN */}
               
                <h3 className="text-xl font-black text-white mb-2">Confirmar Comisión</h3>
                <p className="text-sm text-gray-400 mb-6 font-medium leading-relaxed">¿Seguro que hiciste una venta o un cambio? </p>
                
                <div className="flex gap-3 w-full">
                  <button 
                    type="button" 
                    onClick={() => { 
                      setShowBuyerModal(false); 
                      setConfirmCommission(false);
                      handleSave(buyerName.trim(), true); 
                      setBuyerName("");     
                    }} 
                    disabled={loading} 
                    className="flex-1 bg-green-500 text-black font-black py-4 rounded-2xl text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-green-400 transition-colors cursor-pointer"
                  >
                    SÍ
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setConfirmCommission(false)} 
                    disabled={loading} 
                    className="flex-1 text-gray-300 font-bold py-4 rounded-2xl text-xs uppercase tracking-wider hover:bg-gray-800 transition-colors cursor-pointer border border-gray-700"
                    style={{ backgroundColor: '#222' }}
                  >
                    NO, VOLVER
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}