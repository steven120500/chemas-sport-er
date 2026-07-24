// src/components/AddProductModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaTimes, FaImage } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import tallaPorTipo from "../utils/tallaPorTipo";

const API_BASE = import.meta.env.VITE_API_BASE || "https://chemas-sport-er-backend.onrender.com";
const MAX_IMAGES = 2;
const MAX_WIDTH = 1000;
const QUALITY = 0.75;

// ===== Helpers =====
async function convertToWebpBlob(file, maxWidth = MAX_WIDTH, quality = QUALITY) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Formato no soportado"));
    i.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    const tryType = "image/webp";
    canvas.toBlob(
      (b) => resolve(b),
      canvas.toDataURL(tryType).startsWith("data:image/webp") ? tryType : "image/png",
      quality
    );
  });

  if (!blob) throw new Error("No se pudo convertir la imagen");
  return blob;
}

async function srcToBlob(src) {
  if (!src) throw new Error("Imagen sin src");

  if (src.startsWith("blob:") || src.startsWith("http")) {
    const r = await fetch(src);
    if (!r.ok) throw new Error("No se pudo leer blob/url");
    return await r.blob();
  }

  if (src.startsWith("data:")) {
    const [meta, data] = src.split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
    const bin = atob(data);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  throw new Error("Formato de imagen no soportado");
}

export default function AddProductModal({ onAdd, onCancel, user }) {
  const [images, setImages] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [type, setType] = useState("Player");
  const [stock, setStock] = useState({});
  const [bodega, setBodega] = useState({});
  const [mode, setMode] = useState("stock");

  const [isNew, setIsNew] = useState(false);   
  const [hidden, setHidden] = useState(false); 
  const [isMundial2026, setIsMundial2026] = useState(false); 
  // 🔥 NUEVO ESTADO PARA EL SELLO TEMPORADA 26-27 🔥
  const [isTemporada2627, setIsTemporada2627] = useState(false);

  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
      setImages((prev) => {
        prev.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
        return [];
      });
    };
  }, []);

  const tallas = useMemo(() => {
    const tipos = { ...tallaPorTipo, Balón: ["3", "4", "5"], Balones: ["3", "4", "5"] };
    return tipos[type] || [];
  }, [type]);

  const handleFiles = async (filesLike) => {
    const files = Array.from(filesLike).slice(0, MAX_IMAGES - images.length);
    if (files.length === 0) return;

    try {
      setLoading(true);
      const converted = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error("Formato de imagen no soportado");
          continue;
        }
        const blob = await convertToWebpBlob(file);
        const previewUrl = URL.createObjectURL(blob);
        converted.push({ blob, previewUrl });
      }

      if (converted.length) {
        setImages((prev) => [...prev, ...converted].slice(0, MAX_IMAGES));
        toast.success("Imágenes optimizadas a WebP");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "No se pudo optimizar la imagen");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFiles([file]);
    e.target.value = "";
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => {
      const copy = prev.slice();
      const item = copy[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const visibleInv = mode === "stock" ? stock : bodega;
  const setVisibleInv = mode === "stock" ? setStock : setBodega;

  const handleInvChange = (size, value) => {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setVisibleInv((prev) => ({ ...prev, [size]: n }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      if (!name.trim() || !price || !type.trim()) {
        toast.error("Completá nombre, precio y tipo.");
        return;
      }
      if (discountPrice && Number(discountPrice) > Number(price)) {
        toast.error("El descuento no puede ser mayor al precio.");
        return;
      }
      if (!images.length) {
        toast.error("Agregá al menos una imagen.");
        return;
      }

      const displayName = user?.username || "ChemaSportER";
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("price", String(price).trim());
      if (discountPrice) formData.append("discountPrice", String(discountPrice).trim());
      formData.append("type", type.trim());

      formData.append("isNew", isNew ? "true" : "false");
      formData.append("hidden", hidden ? "true" : "false"); 
      formData.append("isMundial2026", isMundial2026 ? "true" : "false");
      // 🔥 ENVIAMOS AL BACKEND LA OPCIÓN DE TEMPORADA 26-27 🔥
      formData.append("isTemporada2627", isTemporada2627 ? "true" : "false");

      formData.append("stock", JSON.stringify(stock));
      formData.append("bodega", JSON.stringify(bodega));

      for (let i = 0; i < images.length; i++) {
        const blob = images[i].blob || (await srcToBlob(images[i].src));
        formData.append("images", blob, `product-${i}.webp`);
      }

      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        headers: { "x-user": displayName },
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Error al guardar producto (${res.status}). ${txt || ""}`.trim());
      }

      const data = await res.json();
      onAdd?.(data);
      onCancel?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error guardando el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">

      {/* 🔥 FONDO DIFUMINADO PREMIUM 🔥 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />

      {/* 🔥 CAJA DEL MODAL 🔥 */}
      <div 
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col z-10 animate-fade-in-up"
        style={{ maxHeight: '85vh' }} // Forzamos una altura máxima estricta para garantizar el scroll
      >
        
        {/* 🔥 BOTÓN DE CERRAR 🔥 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={16} />
        </button>

        {/* 🔥 ENCABEZADO ELITE 🔥 */}
        <div className="flex-none px-6 pt-8 pb-4 text-center">
          <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 shadow-sm">
            Nuevo Ingreso
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">
            Agregar Producto
          </h2>
        </div>

        {/* 🔥 BODY CON SCROLL 🔥 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 px-6 sm:px-8 pb-6 sm:pb-8 min-h-0">
          
          {/* IMÁGENES */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Imágenes ({images.length}/{MAX_IMAGES})
            </label>
            <div className="flex gap-3 flex-wrap">
              {images.map((img, i) => (
                <div key={`preview-${i}`} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt={`preview-${i}`}
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl shadow-sm border border-gray-200"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(i);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 hover:scale-110 transition-transform"
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 sm:w-28 sm:h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-black hover:border-black transition-all"
                >
                  <FaImage size={24} className="mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Subir</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* DATOS PRINCIPALES */}
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Nombre</label>
              <input
                type="text"
                placeholder="Ej. Real Madrid Local 24/25"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Precio ₡</label>
                <input
                  type="number"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Descuento ₡</label>
                <input
                  type="number"
                  placeholder="0"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-green-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Tipo de Producto</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
              >
                {Object.keys({ ...tallaPorTipo, Balón: ["3", "4", "5"] }).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* INVENTARIO (Botones estilo ProductModal) */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1 text-center">
              Gestionar Inventario
            </label>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('stock')}
                className={`flex-1 p-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition-all ${
                  mode === 'stock' ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                Tienda #1
              </button>
              <button
                type="button"
                onClick={() => setMode('bodega')}
                className={`flex-1 p-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition-all ${
                  mode === 'bodega' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-purple-200 hover:text-purple-500'
                }`}
              >
                Tienda #2
              </button>
            </div>

            <div className={`p-4 sm:p-5 rounded-2xl transition-colors duration-300 ${mode === 'stock' ? 'bg-gray-50 border border-gray-100' : 'bg-purple-50/50 border border-purple-100'}`}>
              <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                {tallas.map((size) => {
                  const inputColors = mode === "stock" 
                      ? "focus:border-black text-black border-gray-200" 
                      : "focus:border-purple-500 text-purple-900 border-purple-200";
                  
                  const labelColors = mode === "stock" ? "text-gray-500" : "text-purple-600";

                  return (
                    <div key={size} className="relative mt-2">
                      <div className={`absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-transparent px-1 text-[10px] font-black tracking-widest uppercase z-10 ${labelColors}`}>
                          {size}
                      </div>
                      <input
                          type="number"
                          min="0"
                          value={visibleInv[size] ?? ""}
                          onChange={(e) => handleInvChange(size, e.target.value)}
                          placeholder="0"
                          className={`w-full h-11 pt-1 border bg-white rounded-xl text-center font-black text-sm focus:outline-none focus:ring-0 transition-all shadow-sm ${inputColors}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* OPCIONES EXTRAS (Switches iOS) */}
          <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-100 mb-6">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
              Opciones del Sistema
            </label>
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-bold text-gray-800 select-none">Ocultar Producto</span>
                <div className="relative flex items-center">
                  <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${hidden ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${hidden ? 'transform translate-x-5' : ''}`}></div>
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-bold text-gray-800 select-none">Torneo: Mundial 2026</span>
                <div className="relative flex items-center">
                  <input type="checkbox" checked={isMundial2026} onChange={(e) => setIsMundial2026(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${isMundial2026 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${isMundial2026 ? 'transform translate-x-5' : ''}`}></div>
                </div>
              </label>

              {/* 🔥 NUEVO SWITCH: TEMPORADA 26-27 (SELLO ROJO) 🔥 */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-bold text-gray-800 select-none">Temporada 26-27 (Sello)</span>
                <div className="relative flex items-center">
                  <input type="checkbox" checked={isTemporada2627} onChange={(e) => setIsTemporada2627(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${isTemporada2627 ? 'bg-red-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${isTemporada2627 ? 'transform translate-x-5' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>

          {/* BOTÓN SUBMIT */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-black hover:bg-gray-900 text-white py-4 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg transition-transform transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 mt-2"
          >
            {loading ? "GUARDANDO..." : "GUARDAR PRODUCTO"}
          </button>

        </div>
      </div>

      {/* 🔥 ANIMACIÓN DE ENTRADA 🔥 */}
      <style>{`
        @keyframes fadeInUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}