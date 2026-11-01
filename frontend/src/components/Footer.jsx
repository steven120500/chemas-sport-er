import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer 
      className="pt-10 mt-10 text-center pb-12 sm:pb-20 border-t border-gray-200 relative z-10 overflow-hidden"
      // 🔥 Fondo transparente para que herede el fondo blanco limpio de App.jsx sin cortes 🔥
      style={{ backgroundColor: 'transparent' }}
    >
      
      {/* Íconos sociales minimalistas */}
      <div className="flex justify-center gap-6 mb-6 relative z-20">
        <a
          href="https://www.facebook.com/share/1Cjf3GgQmQ/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-300 text-black w-12 h-12 flex items-center justify-center rounded-full hover:bg-black hover:text-white hover:scale-110 hover:shadow-lg hover:border-black transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaFacebookF />
        </a>

        <a
          href="https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-300 text-black w-12 h-12 flex items-center justify-center rounded-full hover:bg-black hover:text-white hover:scale-110 hover:shadow-lg hover:border-black transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaInstagram />
        </a>

        <a
          href="https://wa.me/50660369857"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-300 text-black w-12 h-12 flex items-center justify-center rounded-full hover:bg-black hover:text-white hover:scale-110 hover:shadow-lg hover:border-black transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaWhatsapp />
        </a>
      </div>

       {/* Texto inferior elegante */}
       <div className="mt-4 text-sm text-gray-500 space-y-1 relative z-20 font-medium tracking-wide">
        <p>© 2026 ChemaSport ER. Todos los derechos reservados.</p>
        <p>
          Diseñado por{" "}
          <a
            href="https://wa.me/50688028216"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black font-black underline decoration-gray-300 hover:decoration-black hover:text-black transition-colors duration-300"
          >
            Beesoft
          </a>
        </p>
      </div>
    </footer>
  );
}