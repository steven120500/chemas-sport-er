// src/components/AddProductModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import tallaPorTipo from "../utils/tallaPorTipo";

// === Config ===
const API_BASE = import.meta.env.VITE_API_BASE || "https://chemas-sport-er-backend.onrender.com";
const MAX_IMAGES = 2;
const MAX_WIDTH = 1000;     // reescala si es más ancho
const QUALITY = 0.75;       // calidad WebP
const MAX_IMAGE_BASE64_LEN = 13_800_000; // por si conviertes a dataURL

// === Helpers ===

// Convierte File -> Blob WebP (reescala si hace falta)
async function convertToWebpBlob(file, maxWidth = MAX_WIDTH, quality = QUALITY) {
  // 1) File -> dataURL
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  // 2) dataURL -> Image
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Formato de imagen no soportado"));
    i.src = dataUrl;
  });

  // 3) Canvas + posible reescalado
  const canvas = document.createElement("canvas");
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 4) Canvas -> Blob WebP (fallback png si no soporta webp)
  const blob = await new Promise((resolve) => {
    const tryType = "image/webp";
    canvas.toBlob(
      (b) => resolve(b),
      canvas.toDataURL(tryType).startsWith("data:image/webp") ? tryType : "image/png",
      quality
    );
  });

  if (!blob) throw new Error("No se pudo convertir la imagen");
  // (opcional) chequeo de tamaño aproximado si usas dataURL
  // const previewUrl = URL.createObjectURL(blob);

  return blob;
}

export default function AddProductModal({ onAdd, onCancel, user }) {
  const [images, setImages] = useState([]); // [{ blob, previewUrl }]
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("Player");
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const tallas = useMemo(() => tallaPorTipo[type] || [], [type]);

  // ====== Imágenes ======
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

  const handleImageDrop = async (e) => {
    e.preventDefault();
    if (!e.dataTransfer?.files?.length) return;
    await handleFiles(e.dataTransfer.files);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFiles([file]);
    // permitir volver a elegir el mismo archivo
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

  // ====== Stock ======
  const handleStockChange = (size, value) => {
    setStock((prev) => ({ ...prev, [size]: parseInt(value) || 0 }));
  };

  // ====== Submit ======
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      // Validaciones simples
      if (!name.trim() || !price || !type.trim()) {
        toast.error("Completá nombre, precio y tipo.");
        return;
      }
      if (!images.length) {
        toast.error("Agregá al menos una imagen.");
        return;
      }

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("price", String(price).trim());
      formData.append("type", type.trim());
      formData.append("stock", JSON.stringify(stock)); // el backend acepta 'stock' o 'sizes'

      // una sola imagen (si querés múltiples, hacé un loop con image[0], image[1], ...)
      formData.append("image", images[0].blob, "product.webp");

      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        body: formData, // NO pongas Content-Type aquí
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Error al guardar producto (${res.status}). ${txt || ""}`.trim());
      }

      const data = await res.json();
      toast.success("Producto guardado");
      onAdd?.(data);       // refresca lista
      onCancel?.();        // cierra modal
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error guardando el producto");
      alert("Error guardando el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleImageDrop}
    >
      <div className="bg-white mt-20 pt-15 rounded-lg max-w-md w-full shadow-lg overflow-y-auto scrollbar-thin relative p-6">
        <button onClick={onCancel} className="absolute pt-15 top-6 right-2 text-white text-white-500 hover:text-gray-800 bg-black rounded-full p-1">
          <FaTimes size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Agregar producto</h2>

        {/* Zona de imágenes */}
        <p className="text-gray-500 mb-2">
          Arrastrá y soltá hasta {MAX_IMAGES} imagen(es) o hacé clic para seleccionar (se convertirán a WebP)
        </p>

        <div className="flex gap-2 justify-center flex-wrap mb-3">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.previewUrl} alt={`preview-${i}`} className="w-24 h-24 object-cover rounded" />
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveImage(i); }}
                className="absolute -top-1 -right-1 bg-black text-white text-xs rounded-full px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {images.length < MAX_IMAGES && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 p-2 rounded w-full text-center mb-4"
            >
              Seleccionar imagen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* Nombre */}
        <input
          type="text"
          placeholder="Nombre del producto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
        />

        {/* Precio */}
        <input
          type="text"
          placeholder="Precio (₡)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
        />

        {/* Tipo */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
        >
          {Object.keys(tallaPorTipo).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Stock por talla */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {tallas.map((size) => (
            <label key={size} className="text-center">
              <span className="block mb-1 text-sm font-medium">{size}</span>
              <input
                type="number"
                min="0"
                value={stock[size] ?? ""}
                onChange={(e) => handleStockChange(size, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-center"
              />
            </label>
          ))}
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-black text-white py-2 rounded hover:bg-gray-800 transition disabled:opacity-60"
          >
            {loading ? "Agregando..." : "Agregar producto"}
          </button>

          <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}