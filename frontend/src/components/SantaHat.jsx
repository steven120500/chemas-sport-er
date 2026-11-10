// 🎅 Gorro de Santa en SVG (usado en la intro y en el logo del Header)
export default function SantaHat({ className = "" }) {
  return (
    <svg viewBox="0 0 100 80" className={className} aria-hidden="true">
      <path d="M12 66 Q28 12 72 8 Q92 9 88 30 Q70 22 64 66 Z" fill="#dc2626" />
      <path d="M40 30 Q55 16 72 14" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="4" y="60" width="72" height="17" rx="8.5" fill="#fff" />
      <circle cx="88" cy="32" r="9" fill="#fff" />
    </svg>
  );
}
