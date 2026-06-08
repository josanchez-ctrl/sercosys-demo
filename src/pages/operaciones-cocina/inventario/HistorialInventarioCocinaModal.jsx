import { History, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';
import ViewUser from '../../../components/user-table/ViewUser';

const tipoMovimientoConfig = {
    RECEPCION: { label: 'Recepción', color: 'text-emerald-600 bg-emerald-50', icon: <History size={12} /> },
    CONSUMO: { label: 'Consumo', color: 'text-red-600 bg-red-50', icon: <History size={12} /> },
    AJUSTE_POS: { label: 'Ajuste (+)', color: 'text-blue-600 bg-blue-50', icon: <History size={12} /> },
    AJUSTE_NEG: { label: 'Ajuste (-)', color: 'text-amber-600 bg-amber-50', icon: <History size={12} /> },
};

export default function HistorialInventarioCocinaModal({ isOpen, onClose, movimientos, loading }) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-900 text-white rounded-lg">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Historial de Movimientos</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase italic">Auditoría detallada del rubro</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-all">
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2 bg-white">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-900 rounded-full animate-spin mb-3" />
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cargando bitácora...</p>
                        </div>
                    ) : movimientos.length === 0 ? (
                        <div className="text-center py-12 opacity-20">
                            <History size={40} className="mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase">Sin movimientos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {movimientos.map(mov => (
                                <div key={mov.id} className="flex items-center gap-4 px-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all group">
                                    {/* Icono */}
                                    <div className={`p-2 rounded-lg shrink-0 ${tipoMovimientoConfig[mov.tipo_movimiento]?.color}`}>
                                        {tipoMovimientoConfig[mov.tipo_movimiento]?.icon}
                                    </div>

                                    {/* Tipo y Observación */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${tipoMovimientoConfig[mov.tipo_movimiento]?.color.split(' ')[0]}`}>
                                            {tipoMovimientoConfig[mov.tipo_movimiento]?.label}
                                        </p>
                                        <p className="text-[10px] font-medium text-slate-400 italic truncate" title={mov.observaciones}>
                                            {mov.observaciones || 'Sin observaciones'}
                                        </p>
                                    </div>

                                    {/* Cantidad */}
                                    <div className="w-20 text-center">
                                        <span className={`text-sm font-black tabular-nums ${Number(mov.cantidad) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {Number(mov.cantidad) > 0 ? '+' : ''}{formatNumber(mov.cantidad, getDecimalPlaces(Number(mov.cantidad)))}
                                        </span>
                                    </div>

                                    {/* Fecha y Usuario */}
                                    <div className="w-32 text-right">
                                        <p className="text-[9px] font-bold text-slate-500 tabular-nums">
                                            {formatDateSystemToDDMMYYYY_HHMMSS(mov.timestamp_create).split(' ')[0]}
                                        </p>
                                        <p className="text-[8px] font-black text-slate-300 tabular-nums uppercase">
                                            {formatDateSystemToDDMMYYYY_HHMMSS(mov.timestamp_create).split(' ')[1]}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                        Mostrando los últimos 50 movimientos por rendimiento
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
