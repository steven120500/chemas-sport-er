import logo from '../assets/logo.png';

export default function Header() {
  return (
    <header className="w-full bg-white shadow-sm px-6 py-4 mb-6">
      <div className="flex items-center justify-between flex-wrap">
        {/* Logo a la izquierda */}
        <div className="flex items-center">
          <img src={logo} alt="Logo Chemas Sport" className="h-20 w-auto" />
        </div>

        {/* Título en el centro en pantallas grandes */}
        <div className="w-full mt-4 sm:mt-0 sm:w-auto text-center flex-grow">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            ChemaSport ER
          </h1>
        </div>
      </div>
    </header>
  );
}
