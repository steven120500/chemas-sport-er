import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify'
import { FaWhatsapp, FaTimes } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { toast as toastHOT } from 'react-hot-toast';



const tallasAdulto = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const tallasNino = ['16', '18', '20', '22', '24', '26', '28'];
const acceptedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/heic'];

export default function ProductModal({ product, onClose, onUpdate, canEdit, canDelete, user}) {
  const modalRef = useRef(null);
  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStock, setEditedStock] = useState({ ...product.stock });
  const [editedName, setEditedName] = useState(product.name);
  const [editedPrice, setEditedPrice] = useState(product.price);  
  const [editedType, setEditedType] = useState(product?.type || 'Player');
  const [images, setImages] = useState([
    { src: product.imageSrc, isNew: false },
    ...(product.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : [])
  ]);
  const [loading, setLoading] = useState(false);
  const [showSecondImage, setShowSecondImage] = useState(false);

  useEffect(() => {
    setViewProduct(product); 
  }, [product]);


  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const imageSrc = images[0]?.src || null;
      const imageSrc2 = images[1]?.src || null;

      const displayName = user?.username || user?.email || 'ChemaSportER';

      const response = await fetch(`https://chemas-sport-er-backend.onrender.com/api/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' , 'x-user' : displayName, },
        body: JSON.stringify({
          stock: editedStock,
          name: editedName,
          price: editedPrice,
          type: editedType,
          imageSrc,
          imageSrc2,
          imageAlt: editedName
        }),
      });

      if (!response.ok) throw new Error('Error al actualizar');

      const updatedProduct = await response.json();
      onUpdate(updatedProduct);                 // actualiza la lista afuera
      setViewProduct(updatedProduct);           // actualiza lo que se ve dentro
      setEditedName(updatedProduct.name);       // sincroniza inputs
      setEditedType(updatedProduct.type);
      setIsEditing(false);


    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Hubo un problema al actualizar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {

      const displayName = user?.username || user?.email || 'ChemaSportER';

      const res = await fetch(`https://chemas-sport-er-backend.onrender.com/api/products/${product._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' , 'x-user' : displayName, },

      });

      if (!res.ok) throw new Error('Error al eliminar');

     
      onUpdate(null, product._id);
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('No se pudo eliminar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (size, value) => {
    setEditedStock((prev) => ({ ...prev, [size]: parseInt(value) || 0 }));
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files[0];
    if (file && acceptedTypes.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = () => {
        const newImages = [...images];
        newImages[index] = { src: reader.result, isNew: true };
        setImages(newImages);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Formato de imagen no soportado');
    }
  };

  const handleImageRemove = (index) => {
    const updated = [...images];
    updated.splice(index, 1);
    setImages(updated);
  };

  const tallasVisibles = product.type === 'Niño' ? tallasNino : tallasAdulto;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center py-6">
    <div
      ref={modalRef}
      className="relative bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
    >

  <h2 
 className="mb-2 text-center">
{isEditing && canEdit ? (
  <>
    {/* Editar tipo */}
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

    {/* Editar nombre */}
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
 
</h2>

        {/* Imagen o edición de imágenes */}
        {isEditing && canEdit? (
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.src} alt={`img-${i}`} className="h-48 rounded object-contain" />
                <button
                  onClick={() => handleImageRemove(i)}
                  className="absolute top-0 right-0 bg-black text-white rounded-full p-1 text-sm"
                >
                  <FaTimes />
                </button>
                <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
              </div>
            ))}
            {images.length < 2 && (
              <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, images.length)} />
            )}
          </div>
        ) : (
          <div className="relative mb-4 flex items-center justify-center">
            {product.imageSrc2 && (
              <button
                onClick={() => setShowSecondImage(prev => !prev)}
                className="absolute left-0 z-10 bg-white bg-opacity-70 hover:bg-opacity-100 px-3 py-1 rounded-full shadow-md text-xl"
              >
                &#8592;
              </button>
            )}

            <img
              src={showSecondImage && product.imageSrc2 ? product.imageSrc2 : product.imageSrc}
              alt={product.imageAlt || 'Producto'}
              className="rounded-lg max-h-[400px] object-contain"
            />

            {product.imageSrc2 && (
              <button
                onClick={() => setShowSecondImage(prev => !prev)}
                className="absolute right-0 z-10 bg-white bg-opacity-70 hover:bg-opacity-100 px-3 py-1 rounded-full shadow-md text-xl"
              >
                &#8594;
              </button>
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

        {/* Tallas */}
        <div className="mb-4">
          <p className="text-center font-semibold mb-2">Stock por talla:</p>
          <div className="grid grid-cols-3 gap-2">
            {tallasVisibles.map((talla) => (
              <div key={talla} className="text-center border rounded p-2">
                <label className="block text-sm font-medium">{talla}</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded px-1 text-center"
                    value={editedStock[talla] === 0 ? '' : editedStock[talla]}
                    onChange={(e) => handleStockChange(talla, e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{editedStock[talla] || 0} disponibles</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Botones */}
<div className="flex justify-between mt-4 gap-2 flex-wrap">

  {/* Botón Cerrar */}
  <button
      onClick={onClose}
      
      className="absolute top-6 right-2 text-white text-white-500 hover:text-gray-800 bg-black">
            <FaTimes />
              
      </button>

  {/* Botón Guardar (solo si se puede editar y está en modo edición) */}
  {canEdit && isEditing && (
    <button
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-full sm:w-auto flex-1 font-bold"
      onClick={handleSave}
      disabled={loading}
    >
      {loading ? 'Guardando...' : 'Guardar'}
    </button>
  )}

  {/* Botón Editar (solo si se puede editar y no está en modo edición) */}
  {canEdit && !isEditing && (
    <button
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition w-full sm:w-auto flex-1 font-bold"
      onClick={() => setIsEditing(true)}
    >
      Editar
    </button>
  )}

  {/* Botón Eliminar (solo si se puede eliminar) */}
  {canDelete && (
  <button
    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition w-full sm:w-auto flex-1 font-bold"
    onClick={() => {
      toastHOT((t) => (
        <span>
          ¿Seguro que quieres eliminar?
          <div className="mt-2 flex gap-2 justify-end">
            <button
              onClick={() => {
                toastHOT.dismiss(t.id);
                handleDelete(); // tu lógica de eliminar
              }}
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
      ), {
        duration: 6000,
      });
    }}
    disabled={loading}
  >
    {loading ? 'Eliminando...' : 'Eliminar'}
  </button>
)}
</div>

{/* Botón de WhatsApp */}
<a
  href={`https://wa.me/50660369857?text=${encodeURIComponent(
  `¡Hola! Me interesa la camiseta ${product.name} ${product.type} en la página con un valor de ₡${product.price}. CRC. ¿Está disponible?`
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