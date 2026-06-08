import React from 'react';
import { createPortal } from 'react-dom';
import { X, Truck, User, CreditCard, Car, Lock, Package, Printer, MapPin, Building2, Box, Info, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS, formatearFecha } from '../../../util/workDate';

const statusConfig = {
    'EN TRÁNSITO': { label: 'En Tránsito', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Truck size={14} /> },
    'RECIBIDO_PARCIAL': { label: 'Con Diferencia', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <AlertTriangle size={14} /> },
    'RECIBIDO_TOTAL': { label: 'Conforme', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={14} /> },
};

export default function DespachoDetalleModal({ show, onClose, despacho }) {
    if (!show || !despacho) return null;

    const status = statusConfig[despacho.estatus] || { label: despacho.estatus, color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Info size={14} /> };
    const yaRecibido = despacho.estatus === 'RECIBIDO_TOTAL' || despacho.estatus === 'RECIBIDO_PARCIAL';

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">

                {/* HEADER */}
                <div className="bg-white px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 rounded-md text-white">
                            <Truck size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Guía de Despacho #{formato8Digitos(despacho.id)}</h2>
                                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${status.color}`}>
                                    {status.icon}
                                    {status.label}
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">
                                Generada el {formatDateSystemToDDMMYYYY_HHMMSS(despacho.timestamp_create)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-900 hover:text-white transition-all shadow-sm active:scale-95"
                            title="Generar PDF"
                        >
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* INFO PRINCIPAL: ORIGEN / DESTINO / TRANSPORTE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Destino */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-brand-600">
                                <MapPin size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Destino del Despacho</span>
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-800 uppercase">{despacho.sucursal?.nombre}</p>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{despacho.comedor?.nombre}</p>
                            </div>
                        </div>

                        {/* Chofer */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-brand-600">
                                <User size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Información del Chofer</span>
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-800 uppercase">{despacho.transporte_chofer}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-0.5 rounded-lg">
                                        {despacho.letrasdni?.nombre}-{despacho.transporte_dni}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Vehículo */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-brand-600">
                                <Car size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Datos del Vehículo</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-black text-slate-800 uppercase">{despacho.tipo_vehiculo?.nombre}</p>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Placa: {despacho.transporte_placa}</p>
                                </div>
                                {despacho.transporte_precinto && (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                            <Lock size={10} />
                                            <span className="text-[9px] font-black uppercase">Precinto</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 mt-1">{despacho.transporte_precinto}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TABLA DE PRODUCTOS */}
                    <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Box size={16} className="text-brand-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Relación de Carga y Recepción</h4>
                            </div>
                            {yaRecibido && (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Diferencia</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Producto / Presentación</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Lote / Fecha Vencimiento</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Cant. Despachada</th>
                                    {yaRecibido && (
                                        <>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right bg-slate-50/80">Cant. Recibida</th>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Diferencia</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                                {despacho.almacen_despacho_detalle?.map((det) => {
                                    const p = det.picking_detalle?.producto;
                                    const diferencia = (det.cantidad_recibida || 0) - det.cantidad_enviada;
                                    const tieneDiferencia = diferencia !== 0;

                                    return (
                                        <React.Fragment key={det.id}>
                                            <tr className={`hover:bg-slate-50/50 transition-colors ${tieneDiferencia && yaRecibido ? 'bg-orange-50/20' : ''}`}>
                                                <td className="px-8 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-700 uppercase leading-none mb-1">
                                                            {p?.rubro?.nombre} {p?.marca?.nombre} {p?.variedad}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase italic">
                                                            {(() => {
                                                                const d = det.picking_detalle;
                                                                if (!d) return 'N/A';
                                                                const basePres = p?.presentaciones?.find(bp => bp.es_base);
                                                                const baseFactor = basePres?.factor || 1;
                                                                const baseNombre = basePres?.presentacion?.nombre || 'UND';
                                                                const ratio = (d.factor || 1) / baseFactor;

                                                                const presNombre = d.presentacion_logistica?.presentacion?.nombre || 'UND';
                                                                const ratioStr = ratio > 1 ? `${ratio % 1 === 0 ? ratio : ratio.toFixed(1)}${baseNombre}` : '';

                                                                return `${presNombre} ${ratioStr} | ${d.factor}${p?.rubro?.unidad?.abreviatura || ''}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex flex-col justify-start">
                                                        <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                            <span className="col-span-2 text-right text-xs font-bold text-slate-800 tabular-nums">LOTE:</span>
                                                            <span className="text-[9px] font-black text-slate-400 text-start">{det.picking_detalle?.lote || 'N/A'}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                            <span className="col-span-2 text-right text-xs font-bold text-slate-800 tabular-nums">FV:</span>
                                                            <span className="text-[9px] font-black text-slate-400 text-start">{det.picking_detalle?.fecha_vencimiento ? formatearFecha(det.picking_detalle.fecha_vencimiento) : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex flex-col justify-start">
                                                        <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                            <span className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">{parseFloat(det.cantidad_enviada.toFixed(3))}</span>
                                                            <span className="text-[9px] font-black text-slate-400 text-start">UND</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                            <span className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">{parseFloat((det.cantidad_enviada * (det.picking_detalle?.factor || 1)).toFixed(3))}</span>
                                                            <span className="text-[9px] font-black text-slate-400 text-start">{p?.rubro?.unidad?.abreviatura}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {yaRecibido && (
                                                    <>
                                                        <td className="px-8 py-4 text-right bg-slate-50/40">
                                                            <div className="flex flex-col justify-start">
                                                                <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                                    <span className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">{parseFloat((det.cantidad_recibida || 0).toFixed(3))}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 text-start">UND</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                                    <span className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">{parseFloat(((det.cantidad_recibida || 0) * (det.picking_detalle?.factor || 1)).toFixed(3))}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 text-start">{p?.rubro?.unidad?.abreviatura}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4 text-right">
                                                            <div className="flex flex-col justify-start">
                                                                <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                                    <span className={`col-span-2 text-right text-sm font-bold tabular-nums ${diferencia < 0 ? 'text-red-500' : diferencia > 0 ? 'text-blue-500' : 'text-slate-300'}`}>{diferencia > 0 ? '+' : ''}{parseFloat(diferencia.toFixed(3))}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 text-start">UND</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center justify-center gap-1">
                                                                    <span className={`col-span-2 text-right text-sm font-bold tabular-nums ${diferencia < 0 ? 'text-red-500' : diferencia > 0 ? 'text-blue-500' : 'text-slate-300'}`}>{parseFloat((diferencia * (det.picking_detalle?.factor || 1)).toFixed(3))}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 text-start">{p?.rubro?.unidad?.abreviatura}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                            {yaRecibido && det.observacion_recepcion && (
                                                <tr className="bg-orange-50/10">
                                                    <td colSpan={yaRecibido ? 5 : 3} className="px-8 py-1 border-t border-orange-100/50">
                                                        <div className="flex items-center gap-2">
                                                            <Info size={10} className="text-orange-400" />
                                                            <span className="text-[10px] font-bold text-orange-600 italic">Motivo: {det.observacion_recepcion}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="px-8 py-5 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
                    {/* <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Despachado por</span>
                            <span className="text-xs font-black text-brand-900 uppercase">Sercosys Core System</span>
                        </div>
                    </div> */}
                    <div></div>
                    <div className='flex items-center gap-2'>
                        <button
                            onClick={onClose}
                            className="bg-brand-900 text-white px-10 py-3 rounded-md text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-900/20 hover:bg-brand-800 transition-all active:scale-95"
                        >
                            Cerrar Vista
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
