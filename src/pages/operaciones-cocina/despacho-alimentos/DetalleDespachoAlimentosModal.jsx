import { createPortal } from 'react-dom';
import { ClipboardList } from 'lucide-react';
import { formato8Digitos } from '../../../util/workDate';

const getNombreItem = (item) => {
    if (!item?.producto) return '—';
    const rubro = item.producto?.rubro?.nombre || '';
    const marca = item.producto?.marca?.nombre || '';
    const variedad = item.producto?.variedad || '';
    return [rubro, marca, variedad].filter(Boolean).join(' · ');
};

const isRetornable = (det) =>
    det?.item_inventario?.producto?.rubro?.categoria?.nombre?.toUpperCase() === 'UTENSILIOS';

export default function DetalleDespachoAlimentosModal({ despacho, detalles, sucursalNombre, onClose }) {
    if (!despacho) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-md w-full h-full max-w-[96vw] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Cabecera */}
                <div className="bg-brand-900 text-white p-6 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-800 rounded-2xl">
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wide">{formato8Digitos(despacho.id)}</h3>
                            <p className="text-[10px] text-brand-200 uppercase tracking-widest italic mt-0.5">
                                Detalle completo de Guía de Despacho de Cocina
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-brand-200 text-lg font-black uppercase"
                    >
                        X
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="p-6 overflow-y-auto space-y-6 bg-gray-50/50 flex-1">
                    {/* Panel Informativo de la Guía */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                            <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest block">Origen</span>
                            <span className="text-xs font-bold text-slate-800 uppercase block mt-1">{sucursalNombre || 'No Asignada'}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                            <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest block">Destino</span>
                            <span className="text-xs font-bold text-slate-800 uppercase block mt-1">{despacho.comedor?.nombre}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                            <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest block">Servicio</span>
                            <span className="text-xs font-bold text-brand-900 uppercase block mt-1">{despacho.servicio?.nombre}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                            <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest block">Tipo Salida</span>
                            <span className="text-xs font-bold text-slate-800 uppercase block mt-1">{despacho.tipo_salida?.replace('_', ' ')}</span>
                        </div>
                    </div>

                    {/* Datos de Transporte Logístico si aplican */}
                    {despacho.tipo_salida?.startsWith('CATERING') && (
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-2">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-900">Detalles del Transporte & Chofer</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[8px]">Chofer Responsable</span>
                                    <span className="font-bold text-slate-700 block mt-0.5">{despacho.responsable_traslado || 'No Asignado'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[8px]">Vehículo</span>
                                    <span className="font-bold text-slate-700 block mt-0.5">{despacho.tipo_vehiculo} ({despacho.placa_vehiculo || 'Sin Placa'})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[8px]">Ruta de Entrega</span>
                                    <span className="font-bold text-slate-700 block mt-0.5">{despacho.ruta_entrega || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[8px]">Hora Contratada</span>
                                    <span className="font-bold text-slate-700 block mt-0.5">{despacho.hora_contratada || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detalle en Bloques de Renglones */}
                    <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Renglones Despachados</h4>
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-gray-100 text-[10px] font-black uppercase text-slate-400">
                                        <th className="px-4 py-3">Bloque / Tipo</th>
                                        <th className="px-4 py-3">Descripción / Contenedor</th>
                                        <th className="px-4 py-3 text-center">Salida</th>
                                        <th className="px-4 py-3 text-center">Retorno Conciliado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-300 font-medium">
                                    {detalles.map(det => (
                                        <tr key={det.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-1">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${det.bloque_tipo === 'RECETA' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                                                    det.bloque_tipo === 'UTENSILIO' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {det.bloque_tipo}
                                                </span>
                                            </td>
                                            <td className="px-4 py-1">
                                                <div className="flex flex-col gap-0.5">
                                                    {det.bloque_tipo === 'RECETA' && (
                                                        <>
                                                            <span className="font-bold text-slate-800">{det.receta?.nombre}</span>
                                                            {det.item_inventario && (
                                                                <span className="text-[9px] text-slate-400 italic">
                                                                    En: {getNombreItem(det.item_inventario)} {det.item_inventario.lote ? `(Lote: ${det.item_inventario.lote})` : ''}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {det.bloque_tipo === 'UTENSILIO' && (
                                                        <span className="font-bold text-slate-800">
                                                            {getNombreItem(det.item_inventario)}
                                                        </span>
                                                    )}
                                                    {det.bloque_tipo === 'CONSUMIBLE' && (
                                                        <span className="font-bold text-slate-800">
                                                            {det.nombre_producto_manual}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-1 text-center">
                                                {det.bloque_tipo === 'RECETA' ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-black text-slate-700">{det.raciones_despachadas} RAC </span>
                                                        <span className="text-[9px] text-slate-400">{det.volumen_despachado} {det.unidad_volumen}</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-slate-700">{Number(det.cantidad_despachada)} UND</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-1">
                                                {isRetornable(det) ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${det.estatus_retorno === 'RETORNADO' ? 'bg-emerald-50 text-emerald-700' :
                                                            det.estatus_retorno === 'EXTRAVIADO' ? 'bg-red-50 text-red-700' :
                                                                'bg-amber-50 text-amber-700'
                                                            }`}>
                                                            {det.estatus_retorno}
                                                        </span>
                                                        {det.observaciones_retorno && (
                                                            <span className="text-[9px] text-slate-400 italic">
                                                                "{det.observaciones_retorno}"
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block text-center">
                                                        NO RETORNA
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
