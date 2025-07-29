export default function Footer() {
    return (
      <footer className="bg-black mt-12 w-full text-center text-sm text-gray-500 border-t pt-6 pb-4">
        <p>
          © {new Date().getFullYear()} Chemas Sport ER. Todos los derechos reservados.
        </p>
        <p className="mt-1">
          Diseñado con 💻 y pasión por el fútbol.
        </p>
      </footer>
    );
  }
  