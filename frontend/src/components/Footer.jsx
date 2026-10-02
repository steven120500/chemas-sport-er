import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer 
      className="pt-10 mt-10 text-center pb-12 sm:pb-20 border-t border-[#222] relative z-10 overflow-hidden"
      // 🔥 Fondo transparente para que herede el degradado oscuro de App.jsx sin cortes visuales 🔥
      style={{ backgroundColor: 'transparent' }}
    >
      
      {/* Íconos sociales */}
      <div className="flex justify-center gap-6 mb-6 relative z-20">
        <a
          href="https://www.facebook.com/share/1Cjf3GgQmQ/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#111] border border-[#333] text-yellow-500 w-12 h-12 flex items-center justify-center rounded-full hover:bg-yellow-500 hover:text-black hover:scale-110 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:border-yellow-400 transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaFacebookF />
        </a>

        <a
          href="https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#111] border border-[#333] text-yellow-500 w-12 h-12 flex items-center justify-center rounded-full hover:bg-yellow-500 hover:text-black hover:scale-110 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:border-yellow-400 transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaInstagram />
        </a>

        <a
          href="https://wa.me/50660369857"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#111] border border-[#333] text-yellow-500 w-12 h-12 flex items-center justify-center rounded-full hover:bg-yellow-500 hover:text-black hover:scale-110 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:border-yellow-400 transition-all duration-300 text-2xl z-50 pointer-events-auto"
        >
          <FaWhatsapp />
        </a>
      </div>

       {/* Texto inferior */}
       <div className="mt-4 text-sm text-gray-400 space-y-1 relative z-20 font-medium tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        <p>© 2026 ChemaSport ER. Todos los derechos reservados.</p>
        <p>
          Diseñado por{" "}
          <a
            href="https://wa.me/50688028216"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-500 font-black underline decoration-yellow-500/40 hover:decoration-yellow-400 hover:text-yellow-400 drop-shadow-[0_0_5px_rgba(234,179,8,0.3)] transition-colors duration-300"
          >
            Beesoft
          </a>
        </p>
      </div>
    </footer>
  );
}