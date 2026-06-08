import { Construction } from 'lucide-react';

/**
 * Página placeholder reutilizable para funciones aún en desarrollo.
 * Recibe `titulo` como prop para identificar qué módulo es.
 */
export default function Placeholder({ titulo = 'Módulo' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center min-h-[50vh]">
      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-5">
        <Construction className="text-amber-500" size={32} />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{titulo}</h3>
      <p className="text-gray-400 text-sm max-w-xs">
        Este módulo está en construcción. Pronto estará disponible.
      </p>
    </div>
  );
}
