import { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { FaWhatsapp, FaTimes } from 'react-icons/fa';
import { toast as toastHOT } from 'react-hot-toast';

// -------- Config --------
const API_BASE = 'https://chemas-sport-er-backend.onrender.com';

// -------- Datos auxiliares --------
const TALLAS_ADULTO = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const TALLAS_NINO   = ['16', '18', '20', '22', '24', '26', '28'];
const ACCEPTED_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/heic'];

export default function ProductModal({
  product,
  onClose,
  onUpdate,
  canEdit,
  canDelete,
  user,
}) {
  const modalRef = useRef(null);

  // -------- Estado base / edición --------
  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStock, setEditedStock] = useState({ ...(product?.stock || {}) });
  const [editedName,  setEditedName]  = useState(product?.name || '');
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedType,  setEditedType]  = useState(product?.type || 'Player');
  const [loading,     setLoading]     = useState(false);

  // -------- Galería (preferimos product.images) --------
  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      // backend guarda [{ public_id, url }]
      return product.images
        .map(i => (typeof i === 'string' ? i : i?.url))
        .filter(Boolean);
    }
    // compatibilidad con los campos viejos
    return [product?.imageSrc, product?.imageSrc2].filter(Boolean);
  }, [product]);

  const [localImages, setLocalImages] = useState(
    galleryFromProduct.map(src => ({ src, isNew: false }))
  );

  // índice actual del carrusel
  const [idx, setIdx] = useState(0);
  const hasMany = localImages.length > 1;
  const currentSrc = localImages[idx]?.src || '';

  // si cambian el producto o lo actualizan desde afuera, sincronizamos
  useEffect(() => {
    setViewProduct(product);
    setEditedStock({ ...(product?.stock || {}) });
    setEditedName(product?.name || '');
    setEditedPrice(product?.price ?? 0);
    setEditedType(product?.type || 'Player');

    const g = Array.isArray(product?.images) && product.images.length > 0
      ? product.images.map(i => (typeof i === 'string' ? i : i?.url)).filter(Boolean)
      : [product?.imageSrc, product?.imageSrc2].filter(Boolean);

    setLocalImages(g.map(src => ({ src, isNew: false })));
    setIdx(0);
  }, [product]);

  // bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // -------- Acciones --------
  const handleSave = async () => {
    try {
      setLoading(true);

      // Este PUT actualiza nombre, precio, tipo y stock (no imágenes)
      const displayName = user?.username || user?.email || 'ChemaSportER';

      const res = await fetch(`${API_BASE}/api/products/${product._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user': displayName,
        },
        body: JSON.stringify({
          stock: editedStock,
          name: editedName,
          price: editedPrice,
          type: editedType,
          // si quieres mantener compatibilidad con imageSrc/imageSrc2
          imageSrc:  localImages[0]?.src || null,
          imageSrc2: localImages[1]?.src || null,
          imageAlt: editedName,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar');

      const updated = await res.json();
      onUpdate?.(updated);            // actualiza lista externa
      setViewProduct(updated);        // refresca dentro del modal
      setIsEditing(false);
      toast.success('Producto actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Hubo un problema al actualizar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const displayName = user?.username || user?.email || 'ChemaSportER';

      const res = await fetch(`${API_BASE}/api/products/${product._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user': displayName },
      });

      if (!res.ok) throw new Error('Error al eliminar');
      onUpdate?.(null, product._id); // avisa afuera para quitarlo de la lista
      toast.success('Producto eliminado');
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (size, value) => {
    setEditedStock(prev => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
  };

  // En edición, permitir “cambiar” imágenes de manera local (no sube)
  const handleImageChange = (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato de imagen no soportado');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLocalImages(prev => {
        const copy = prev.slice();
        copy[index] = { src: reader.result, isNew: true };
        return copy;
      });
      setIdx(index);
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (index) => {
    setLocalImages(prev => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
    setIdx(0);
  };

  // tallas a mostrar según el tipo del producto
  const tallasVisibles = (viewProduct?.type === 'Niño') ? TALLAS_NINO : TALLAS_ADULTO;

  return (
    <div className="mt-32 mb-24 fixed inset-0 z-50 bg-black/40 flex items-center justify-center py-6">
      <div
        ref={modalRef}
        className="relative bg-white pt-15 p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-2 text-white bg-black rounded p-1"
          title="Cerrar"
        >
          <FaTimes size={18} />
        </button>

        {/* Encabezado: tipo + nombre o inputs si edición */}
        <div className="mb-2 text-center">
          {isEditing && canEdit ? (
            <>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-3"
              >
                {['Player','Fan','Mujer','Nacional','Abrigos','Retro','Niño','F1','NBA','MLB','NFL'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                type="text"
                className="text-center border-b-2 w-full font-semibold"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
            </>
          ) : (
            <>
              <span className="block text-xs uppercase tracking-wide text-gray-500 font-semibold">
                {viewProduct?.type}
              </span>
              <h2 className="text-xl font-bold">{viewProduct?.name}</h2>
            </>
          )}
        </div>

        {/* Galería */}
        {!isEditing ? (
          <div className="relative mb-4 flex items-center justify-center">
            {currentSrc ? (
              <img
                src={currentSrc}
                alt={viewProduct?.imageAlt || viewProduct?.name || 'Producto'}
                className="rounded-lg max-h-[400px] object-contain"
              />
            ) : (
              <div className="h-[300px] w-full grid place-items-center text-gray-400">
                Sin imagen
              </div>
            )}

            {hasMany && (
              <>
                <button
                  onClick={() => setIdx(i => (i - 1 + localImages.length) % localImages.length)}
                  className="absolute left-0 z-10 bg-white/70 hover:bg-white px-3 py-1 rounded-full shadow-md text-xl"
                >
                  &#8592;
                </button>
                <button
                  onClick={() => setIdx(i => (i + 1) % localImages.length)}
                  className="absolute right-0 z-10 bg-white/70 hover:bg-white px-3 py-1 rounded-full shadow-md text-xl"
                >
                  &#8594;
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {localImages.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full ${i === idx ? 'bg-black' : 'bg-black/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          // Edición visual de imágenes (no sube)
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            {localImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.src} alt={`img-${i}`} className="h-48 rounded object-contain" />
                <button
                  onClick={() => handleImageRemove(i)}
                  className="absolute top-0 right-0 bg-black text-white rounded-full p-1 text-sm"
                  title="Quitar"
                >
                  <FaTimes />
                </button>
                <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
              </div>
            ))}
            {localImages.length < 2 && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, localImages.length)}
              />
            )}
          </div>
        )}

        {/* Precio */}
        <div className="text-center text-lg font-semibold mb-2">
          {isEditing ? (
            <input
              type="number"
              className="text-center border-b-2 w-full font-semibold"
              value={editedPrice}
              onChange={(e) => setEditedPrice(e.target.value)}
            />
          ) : (
            <p>₡{Number(viewProduct?.price).toLocaleString('de-DE')}</p>
          )}
        </div>

        {/* Tallas / Stock */}
        <div className="mb-4">
          <p className="text-center font-semibold mb-2">Stock por talla:</p>
          <div className="grid grid-cols-3 gap-2">
            {(viewProduct?.type === 'Niño' ? TALLAS_NINO : TALLAS_ADULTO).map((talla) => (
              <div key={talla} className="text-center border rounded p-2">
                <label className="block text-sm font-medium">{talla}</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded px-1 text-center"
                    value={editedStock[talla] === 0 ? '' : (editedStock[talla] ?? '')}
                    onChange={(e) => handleStockChange(talla, e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{editedStock[talla] || 0} disponibles</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-between mt-4 gap-2 flex-wrap">
          {canEdit && isEditing && (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-full sm:w-auto flex-1 font-bold"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          )}

          {canEdit && !isEditing && (
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition w-full sm:w-auto flex-1 font-bold"
              onClick={() => setIsEditing(true)}
            >
              Editar
            </button>
          )}

          {canDelete && (
            <button
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition w-full sm:w-auto flex-1 font-bold"
              onClick={() => {
                toastHOT((t) => (
                  <span>
                    ¿Seguro que quieres eliminar?
                    <div className="mt-2 flex gap-2 justify-end">
                      <button
                        onClick={() => { toastHOT.dismiss(t.id); handleDelete(); }}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => toastHOT.dismiss(t.id)}
                        className="bg-gray-200 px-3 py-1 rounded text-sm"
                      >
                        No
                      </button>
                    </div>
                  </span>
                ), { duration: 6000 });
              }}
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        </div>

        {/* WhatsApp */}
        <a
          href={`https://wa.me/50660369857?text=${encodeURIComponent(
            `¡Hola! Me interesa la camiseta ${product?.name} ${product?.type} en la página con un valor de ₡${product?.price}. CRC. ¿Está disponible?`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-full sm:w-auto flex justify-center items-center text-center mt-4 font-bold"
          title="Enviar mensaje por WhatsApp"
        >
          <FaWhatsapp className="mr-2" />
          Enviar mensaje por WhatsApp
        </a>
      </div>
    </div>
  );
}