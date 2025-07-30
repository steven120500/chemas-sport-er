import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="w-full bg-white text-center py-8 border-t">
      {/* Íconos sociales centrados y grandes */}
      <div className="flex justify-center gap-6 mb-0">
        <a
          href="https://www.facebook.com/share/16kK7RmSvS/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl"
        >
          <FaFacebookF />
        </a>

        <a
          href="https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl"
        >
          <FaInstagram />
        </a>

        <a
          href="https://wa.me/50660369857"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl"
        >
          <FaWhatsapp />
        </a>
      </div>

      {/* Texto inferior */}
      <div className="text-sm text-gray-800 space-y-1">
        <p>© 2025 Chemas Sport ER. Todos los derechos reservados.</p>
        <p>Diseñado con 🖥️ y pasión por el fútbol.</p>
      </div>
    </footer>
  );
}
