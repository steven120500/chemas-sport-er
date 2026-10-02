import React, { useEffect, useState } from "react";

function TopBanner() {
  const messages = [
    "STOCK DE +6000 CHEMAS",
    "REGALAMOS CHEMAS LOS VIERNES EN EL CHEMAFEST",
    "MÉTODOS DE PAGO: SINPE, TRANSFERENCIA,",
    "EFECTIVO Y PAGO CON TARJETA",
    "SOMOS CHEMASPORT ER",
  ];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false); // Inicia el desvanecimiento
      
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
        setFade(true); // Vuelve a aparecer suavemente
      }, 500); // Medio segundo para hacer la transición
      
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      // 🔥 Fondo oscuro premium fusionado con el Header 🔥
      className="text-center py-2.5 sm:py-5   overflow-hidden"
      style={{ backgroundColor: '#050505' }}
    >
      <div 
        className={`text-[10px] sm:text-m font-black tracking-[0.2em] text-yellow-500 uppercase transition-opacity duration-500 ease-in-out ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {messages[currentIndex]}
      </div>
    </div>
  );
}

export default TopBanner;