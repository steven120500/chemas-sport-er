// src/components/LoadingOverlay.jsx
export default function LoadingOverlay() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="font-semibold">Cargando datos iniciales...</p>
        </div>
      </div>
    );
  }
