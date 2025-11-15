// src/components/Header.jsx
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import fondoHeader from "../assets/FondoHeader.png";
import { FaUser } from "react-icons/fa";
import UserDropDown from "./UserDropDown";


export default function Header({
  onLoginClick,
  onLogout,
  onLogoClick,
  user,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
}) {
  const [animate, setAnimate] = useState(false);
  const [logoAnimate, setLogoAnimate] = useState(false);


  useEffect(() => {
    const interval = setInterval(() => {
      setAnimate(true);
      setLogoAnimate(true);


      setTimeout(() => {
        setAnimate(false);
        setLogoAnimate(false);
      }, 2000); // anima 2 segundos
    }, 3000); // cada 3 segundos


    return () => clearInterval(interval);
  }, []);


  return (
    <header
      className="relative shadow-md px-2 sm:px-6 py-10 sm:py-40 overflow-hidden min-h-[260px]"
      style={{
        backgroundImage: `url(${fondoHeader})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 🔥 Overlay animado solo cuando 'animate' es true */}
      {animate && <div className="header-shine"></div>}


      <div className="relative z-10 flex items-center justify-between w-full">
        
        {/* Logo animado */}
        <button onClick={onLogoClick} className="focus:outline-none bg-transparent">
          <img
            src={logo}
            alt="Logo Chemas Sport"
            className={`h-14 sm:h-20 transition-transform duration-700 hover:scale-105 ${
              logoAnimate ? "logo-shine" : ""
            }`}
          />
        </button>


        {/* Título */}
        <h1 className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-lg`}>
          {/* ChemaSport ER */}
        </h1>


        {/* Usuario */}
        <div className="flex items-center">
          {user ? (
            <UserDropDown
              isSuperUser={isSuperUser}
              onLogout={onLogout}
              onAddUser={() => setShowRegisterUserModal(true)}
              onViewUsers={() => setShowUserListModal(true)}
              onViewHistory={() => setShowHistoryModal(true)}
            />
          ) : (
            <button
              onClick={onLoginClick}
              className="rounded-full p-3 bg-white/80 backdrop-blur-md shadow-lg text-black hover:bg-gray-200 transition"
            >
              <FaUser size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
