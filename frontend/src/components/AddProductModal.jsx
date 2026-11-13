// src/components/AddProductModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaTimes, FaImage, FaPlus } from "react-icons/fa";
import ModalShell from "./ModalShell";

// ⚠️ Estilos en index.css (sección "MODALES", clases md-*).
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

// 🔘 Interruptor reutilizable (estilos md-switch)
function Switch({ label, hint, checked, onChange, color = "#000" }) {
  return (
    <label className="md-switch">
      <span className="md-switch-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="md-track" style={{ "--on": color }} />
    </label>
  );
}

export default function AddProductModal({ onAdd, onCancel, user }) {
  // 🔒 Verificamos si el usuario actual es Super Admin
  const isSuperAdmin = Boolean(user?.isSuperUser);

  const [images, setImages] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [type, setType] = useState("Player");
  
  // 🔥 LAS 3 UBICACIONES DE INVENTARIO 🔥
  const [tienda, setTienda] = useState({});
  const [stock, setStock] = useState({});
  const [bodega, setBodega] = useState({});
  // 🔥 Iniciamos en Bodega 1 por defecto
  const [mode, setMode] = useState("stock"); 

  const [isNew, setIsNew] = useState(false);   
  const [hidden, setHidden] = useState(false); 
  const [isMundial2026, setIsMundial2026] = useState(false); 
  const [isTemporada2627, setIsTemporada2627] = useState(false);

  // 🔥 NUEVO: ESTADOS DE PERSONALIZACIÓN Y DORSALES 🔥
  const [isNumerable, setIsNumerable] = useState(false);
  const [teamFont, setTeamFont] = useState("barca"); // Valor por defecto
  const [dorsalOptions, setDorsalOptions] = useState([
    { name: "", number: "", quantity: "", imageUrl: "" },
    { name: "", number: "", quantity: "", imageUrl: "" },
    { name: "", number: "", quantity: "", imageUrl: "" }
  ]);

  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
        return [];
      });
    };
  }, []);

  const tallas = useMemo(() => {
    const tipos = { 
      ...tallaPorTipo, 
      Balón: ["3", "4", "5"], 
      Balones: ["3", "4", "5"],
      Llaveros: ["U"],
      LEGO: ["U"]
    };
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

  const visibleInv = mode === "tienda" ? tienda : mode === "stock" ? stock : bodega;
  const setVisibleInv = mode === "tienda" ? setTienda : mode === "stock" ? setStock : setBodega;

  const handleInvChange = (size, value) => {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setVisibleInv((prev) => ({ ...prev, [size]: n }));
  };

  const handleDorsalChange = (index, field, value) => {
    setDorsalOptions(prev => {
      const newOpts = [...prev];
      newOpts[index] = { ...newOpts[index], [field]: value };
      return newOpts;
    });
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
      formData.append("hidden", isSuperAdmin && hidden ? "true" : "false"); 
      formData.append("isMundial2026", isMundial2026 ? "true" : "false");
      formData.append("isTemporada2627", isTemporada2627 ? "true" : "false");

      // 🔥 ENVIAR LOS DATOS DE PERSONALIZACIÓN, TIPOGRAFÍA Y DORSALES AL BACKEND 🔥
      formData.append("isNumerable", isNumerable ? "true" : "false");
      if (isNumerable) {
        formData.append("teamFont", teamFont);
        formData.append("dorsalOptions", JSON.stringify(dorsalOptions));
      }

      // 🔥 ENVIAMOS LAS 3 UBICACIONES AL BACKEND 🔥
      formData.append("tienda", JSON.stringify(tienda));
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

  // 🎨 Color de cada ubicación de inventario
  const MODES = [
    { key: "stock", label: "Bodega 1", color: "#2563eb" },
    { key: "bodega", label: "Bodega 2", color: "#9333ea" },
    { key: "tienda", label: "Tienda", color: "#000000" },
  ];
  const modeColor = MODES.find((m) => m.key === mode)?.color || "#000";
  const totalUnidades = [tienda, stock, bodega]
    .flatMap((inv) => Object.values(inv))
    .reduce((acc, n) => acc + (Number(n) || 0), 0);

  return (
    <ModalShell
      onClose={onCancel}
      size="md"
      icon={FaPlus}
      eyebrow="Nuevo ingreso"
      title="Agregar producto"
      closeOnBackdrop={!loading}
      footer={(close) => (
        <>
          <button type="button" className="md-btn is-flat" onClick={close} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="md-btn is-primary" onClick={handleSubmit} disabled={loading}>
            {loading && <span className="md-spinner" aria-hidden="true" />}
            {loading ? "Guardando…" : "Guardar producto"}
          </button>
        </>
      )}
    >
      {/* IMÁGENES */}
      <div className="md-field">
        <span className="md-label">Imágenes ({images.length}/{MAX_IMAGES})</span>
        <div className="md-uploads">
          {images.map((img, i) => (
            <div key={`preview-${i}`} className="md-thumb">
              <img src={img.previewUrl} alt={`preview-${i}`} />
              {i === 0 && <em>Principal</em>}
              <button
                type="button"
                className="md-thumb-del"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(i);
                }}
                aria-label="Quitar imagen"
              >
                <FaTimes />
              </button>
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <button type="button" className="md-drop" onClick={() => fileInputRef.current?.click()}>
              <FaImage />
              <span>Subir</span>
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* DATOS PRINCIPALES */}
      <label className="md-field">
        <span className="md-label">Nombre</span>
        <input
          type="text"
          className="md-input"
          placeholder="Ej. Camiseta Barcelona Local 26/27"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="md-row">
        <label className="md-field">
          <span className="md-label">Precio</span>
          <div className="md-affix">
            <span className="md-affix-sign">₡</span>
            <input
              type="number"
              inputMode="numeric"
              className="md-input is-money"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </label>
        <label className="md-field">
          <span className="md-label">Oferta</span>
          <div className="md-affix">
            <span className="md-affix-sign">₡</span>
            <input
              type="number"
              inputMode="numeric"
              className="md-input is-money is-green"
              placeholder="0"
              value={discountPrice}
              onChange={(e) => setDiscountPrice(e.target.value)}
            />
          </div>
        </label>
      </div>

      <label className="md-field">
        <span className="md-label">Tipo de producto</span>
        <select className="md-input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.keys({ ...tallaPorTipo, Balón: ["3", "4", "5"], Balones: ["3", "4", "5"], Llaveros: ["U"], LEGO: ["U"] }).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      {/* INVENTARIO */}
      <div className="md-section">
        <span className="md-section-title">
          Inventario inicial{totalUnidades > 0 ? ` · ${totalUnidades} u.` : ""}
        </span>
        <div className="md-seg" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              className={`md-seg-btn ${mode === m.key ? "is-active" : ""}`}
              style={{ "--seg": m.color }}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="md-sizes" style={{ "--seg": modeColor }}>
          {tallas.map((size) => (
            <label key={size} className="md-size">
              <span>{size}</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={visibleInv[size] ?? ""}
                onChange={(e) => handleInvChange(size, e.target.value)}
                placeholder="0"
              />
            </label>
          ))}
        </div>
      </div>

      {/* OPCIONES EXTRAS DEL SISTEMA */}
      <div className="md-section">
        <span className="md-section-title">Opciones</span>

        {/* 🔒 SOLO SUPER ADMIN VE LA OPCIÓN DE OCULTAR PRODUCTO */}
        {isSuperAdmin && (
          <Switch label="Ocultar producto" hint="No aparece en el catálogo público" checked={hidden} onChange={setHidden} color="#dc2626" />
        )}
        <Switch label="Mundial 2026" hint="Aparece en el filtro Mundial 2026" checked={isMundial2026} onChange={setIsMundial2026} color="#D4A000" />
        <Switch label="Temporada 26-27" hint="Muestra el sello en la tarjeta" checked={isTemporada2627} onChange={setIsTemporada2627} color="#dc2626" />

        {/* 🔥 INTERRUPTOR PARA PERSONALIZAR DORSALES (SOLO SUPER ADMIN) 🔥 */}
        {isSuperAdmin && (
          <>
            <div className="md-divider" />
            <Switch label="Dorsales" hint="Nombre y número personalizables" checked={isNumerable} onChange={setIsNumerable} color="#2563eb" />
          </>
        )}

        {/* 🔥 SELECTOR DE TIPOGRAFÍA (SOLO VISIBLE SI SE ACTIVA DORSALES) 🔥 */}
        {isSuperAdmin && isNumerable && (
          <label className="md-field">
            <span className="md-label">Tipografía oficial</span>
            <select className="md-input" value={teamFont} onChange={(e) => setTeamFont(e.target.value)}>
              <option value="barca">F.C. Barcelona (26/27)</option>
              <option value="barca_visita">F.C. Barcelona Visita (dorado)</option>
              <option value="barca_tercera">F.C. Barcelona Tercera (azul/rojo)</option>
              <option value="madrid">Real Madrid</option>
              <option value="madrid_rosa">Real Madrid Tercera Rosada (beige)</option>
              <option value="madrid_verde">Real Madrid Visitante Verde (blanco)</option>
            </select>
          </label>
        )}
      </div>

      {/* 🔥 DORSALES DISPONIBLES 🔥 */}
      {isSuperAdmin && isNumerable && (
        <div className="md-section is-blue">
          <span className="md-section-title">Dorsales en imprenta</span>
          {dorsalOptions.map((opt, i) => (
            <div key={`dorsal-${i}`} className="md-row" style={{ gap: 8 }}>
              <input
                type="text"
                className="md-input is-sm"
                style={{ flex: 2, textTransform: "uppercase" }}
                placeholder="Jugador (Ej. RODRI)"
                value={opt.name}
                onChange={(e) => handleDorsalChange(i, "name", e.target.value)}
              />
              <input
                type="text"
                className="md-input is-sm is-center"
                placeholder="N°"
                value={opt.number}
                onChange={(e) => handleDorsalChange(i, "number", e.target.value)}
              />
              <input
                type="number"
                min="0"
                className="md-input is-sm is-center"
                placeholder="Cant."
                title="Cantidad de este dorsal disponible"
                value={opt.quantity}
                onChange={(e) => handleDorsalChange(i, "quantity", e.target.value)}
              />
            </div>
          ))}
          <p className="md-hint">
            Dejá vacíos los que no uses: en la tienda solo aparecen los llenos. Si la cantidad llega a 0, deja de ofrecerse.
          </p>
        </div>
      )}
    </ModalShell>
  );
}
