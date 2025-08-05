import React, { useEffect, useState } from "react";

function TopBanner() {
  const messages = [
    "STOCK DE +1000 CHEMAS",
    "REGALAMOS CHEMAS TODOS LOS VIERNES EN NUESTRO CHEMAFEST",
    "SOMOS CHEMAS SPORT ER",
  ];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black text-white text-center py-2 text-sm font-semibold">
      {messages[currentIndex]}
    </div>
  );
}

export default TopBanner;