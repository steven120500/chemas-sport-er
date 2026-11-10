import { FaFacebookF, FaInstagram, FaWhatsapp, FaTruck, FaCreditCard, FaTshirt } from 'react-icons/fa';
import logo from '../assets/logo.png';

// ⚠️ Estilos en index.css (sección "FOOTER", clases ft-*).

const SOCIALS = [
  { href: 'https://www.facebook.com/share/1Cjf3GgQmQ/?mibextid=wwXIfr', label: 'Facebook', icon: FaFacebookF },
  { href: 'https://www.instagram.com/chemasport___er?igsh=aGlsenphMjJlOTcw', label: 'Instagram', icon: FaInstagram },
  { href: 'https://wa.me/50660369857', label: 'WhatsApp', icon: FaWhatsapp },
];

const PERKS = [
  { icon: FaTshirt, title: '+7000 camisetas', text: 'Player, Fan, Retro y más' },
  { icon: FaTruck, title: 'Envíos', text: 'A todo Costa Rica' },
  { icon: FaCreditCard, title: 'Pagos', text: 'SINPE, transferencia, efectivo o tarjeta' },
];

export default function Footer() {
  return (
    <footer className="ft">
      <div className="ft-perks">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="ft-perk">
            <span className="ft-perk-icon"><Icon /></span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="ft-main">
        <div className="ft-brand">
          <span className="ft-logo"><img src={logo} alt="" /></span>
          <div>
            <strong>ChemaSport ER</strong>
            <p>Camisetas de fútbol en Costa Rica.</p>
          </div>
        </div>

        <div className="ft-socials">
          {SOCIALS.map(({ href, label, icon: Icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
              <Icon />
            </a>
          ))}
        </div>
      </div>

      <div className="ft-bottom">
        <p>© {new Date().getFullYear()} ChemaSport ER. Todos los derechos reservados.</p>
        <p>
          Diseñado por{' '}
          <a href="https://wa.me/50688028216" target="_blank" rel="noopener noreferrer">Beesoft</a>
        </p>
      </div>
    </footer>
  );
}
