import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';

export default function FloatingWhatsapp({ show = true }) {
  const [open, setOpen] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Contenedor general con pointer-events-none */}
      <div className="relative pointer-events-none">
        {/* Opciones (solo clickeables cuando open === true) */}
        <div
          className={`flex flex-col items-start transition-all duration-300 absolute bottom-16 left-0 space-y-2 ${
            open
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <a
            href="https://wa.me/50660369857?text=Hola! Estoy interesado en comprar al por mayor."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black text-white px-4 py-2 rounded shadow text-sm flex items-center gap-2"
          >
            🏷️ Al por mayor
          </a>
          <a
            href="https://wa.me/50660369857?text=Hola! Me interesa comprar al detalle."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black text-white px-4 py-2 rounded shadow text-sm flex items-center gap-2"
          >
            🛒  Al detalle
          </a>
          <a
            href="https://wa.me/50660369857?text=Hola! Me interesa hablar con un asesor."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black text-white px-4 py-2 rounded shadow text-sm flex items-center gap-2"
          >
            📞 Hablar con asesor
          </a>
        </div>

        {/* Botón flotante (siempre clickeable) */}
        <button
          onClick={() => setOpen(!open)}
          className="pointer-events-auto bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          title="Contacto WhatsApp"
        >
          <FaWhatsapp size={24} />
        </button>
      </div>
    </div>
  );
}