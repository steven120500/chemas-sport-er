import { FaWhatsapp } from 'react-icons/fa';

export default function FloatingWhatsapp({ show = true }) {
  if (!show) return null;

  return (
    <a
      href="https://wa.me/50660369857"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
      title="Contacto WhatsApp"
    >
      <FaWhatsapp size={24} />
    </a>
  );
}