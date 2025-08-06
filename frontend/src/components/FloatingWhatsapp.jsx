import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';

export default function FloatingWhatsapp({ show = true }) {
  const [open, setOpen] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-6 z-10 group pointer-events-none">
      {/* Botones adicionales */}
      <div
        className={`flex flex-col items-end transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <a
          href="https://wa.me/50661616539?text=Hola! Estoy interesado en comprar al por mayor."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-5 py-2 rounded shadow text-sm mb-2 pointer-events-auto"
        >
          🏷️ Ventas al por mayor
        </a>
        <a
          href="https://wa.me/50660369857?text=Hola! Me interesa comprar al detalle."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-8 py-2 rounded shadow text-sm mb-2 pointer-events-auto"
        >
          🛒 Ventas al detalle
        </a>
        <a
          href="https://wa.me/50660369857?text=Hola! Me interesa hablar con un asesor."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-4 py-2 rounded shadow text-sm mb-2 pointer-events-auto"
        >
          📞 Hablar con un asesor
        </a>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform pointer-events-auto"
        title="Contacto WhatsApp"
      >
        <FaWhatsapp size={24} />
      </button>
    </div>
  );
}