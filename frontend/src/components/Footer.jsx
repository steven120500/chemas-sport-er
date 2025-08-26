import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="pt-10 mt-10 bg-white text-center py-8 border-t border-gray-200 relative z-10">
      {/* Íconos sociales */}
      <div className="flex justify-center gap-6 mb-6">
        <a
          href="https://www.facebook.com/share/1Cjf3GgQmQ/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl z-50 pointer-events-auto"
        >
          <FaFacebookF />
        </a>

        <a
          href="https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl z-50 pointer-events-auto"
        >
          <FaInstagram />
        </a>

        <a
          href="https://wa.me/50660369857"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-full hover:opacity-80 transition text-2xl z-50 pointer-events-auto"
        >
          <FaWhatsapp />
        </a>
      </div>

      {/* Texto inferior */}
      <div className="mt-4 text-sm text-gray-800 space-y-1">
        <p>© 2025 ChemaSport ER. Todos los derechos reservados.</p>
        <p>Diseñado por Steven Corrales Alfaro.</p>
      </div>
    </footer>
  );
}