import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';

export default function FloatingWhatsapp({ show = true }) {
  const [open, setOpen] = useState(false);

  if (!show) return null; // 👈 oculta el botón si show es false

  return (
    <div className="fixed bottom-6 left-6 z-10 group">
      <div className={`flex flex-col items-end mb-2 space-y-2 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'} group-hover:opacity-100 group-hover:pointer-events-auto`}>
        <a
          href="https://wa.me/50660369857?text=Hola! Estoy interesado en comprar al por mayor."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-3 py-2 rounded shadow hover:bg-white-700 text-sm"
        >
          📦 Por mayor
        </a>
        <a
          href="https://wa.me/50660369857?text=Hola! Me interesa comprar al detalle."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-3 py-2 rounded shadow hover:bg-white-700 text-sm"
        >
          🛒 Al detalle
        </a>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition transform"
        title="Contacto WhatsApp"
      >
        <FaWhatsapp size={24} />
      </button>
    </div>
  );
}

