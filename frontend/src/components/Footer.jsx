import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="w-full bg-white text-center py-6 border-t">
      <p className="text-sm text-gray-800 mb-2">
        © 2025 Chemas Sport ER. Todos los derechos reservados.
        <br />
        Diseñado con 🖥️ y pasión por el fútbol.
      </p>

      <div className="flex justify-center gap-4 mt-4">
        <a
          href="https://www.facebook.com/share/16kK7RmSvS/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white p-3 rounded-full hover:opacity-80 transition"
        >
          <FaFacebookF />
        </a>

        <a
          href="https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white p-3 rounded-full hover:opacity-80 transition"
        >
          <FaInstagram />
        </a>

        <a
          href="https://wa.me/50660369857" // tu número aquí con código país
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white p-3 rounded-full hover:opacity-80 transition"
        >
          <FaWhatsapp />
        </a>
      </div>
    </footer>
  );
}
