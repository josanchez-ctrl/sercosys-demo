import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Warehouse, Utensils, CheckCircle2, Package, Save, AlertTriangle } from 'lucide-react';
import { procesarRecepcionRemision } from '../../../services/recepcionCocinaService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { Now } from '../../../services/nowService';
import { formatDateSystemToDDMMYYYY, formato8Digitos } from '../../../util/workDate';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';
import ConfirmModal from '../../../components/common/ConfirmModal';

export default function RecepcionCocinaModal({ despacho, onClose }) {
    const { perfil } = useModulePermissions();
    const [updating, setUpdating] = useState(false);
    const [recibos, setRecibos] = useState({}); // { id_detalle: cantidad_recibida }
    const [showConfirm, setShowConfirm] = useState(false);

    const detallesAgrupados = useMemo(() => {
        if (!despacho?.detalles) return [];
        const groups = {};
        despacho.detalles.forEach(d => {
            const rubroId = d.producto?.rubro?.id || d.id_insumo;
            if (!groups[rubroId]) {
                groups[rubroId] = {
                    ...d,
                    detalles_originales: []
                };
            }
            groups[rubroId].detalles_originales.push(d);
        });
        return Object.values(groups);
    }, [despacho]);

    useEffect(() => {
        if (despacho?.detalles) {
            const initial = {};
            despacho.detalles.forEach(d => {
                // Si ya fue recibido, mostramos lo que se recibió. Si no, sugerimos lo enviado.
                initial[d.id] = despacho.estatus === 'RECIBIDO' ? d.cantidad_recibida : d.cantidad_entregada;
            });
            setRecibos(initial);
        }
    }, [despacho]);

    const handleConfirmar = async () => {
        setUpdating(true);
        try {
            const now = await Now();
            const detallesJson = Object.entries(recibos).map(([id, cant]) => ({
                id_detalle: Number(id),
                cantidad_recibida: Number(cant)
            }));

            await procesarRecepcionRemision(despacho.id, perfil.id, now, detallesJson);
            onClose();
        } catch (error) {
            alert("Error al procesar recepción: " + error.message);
        } finally {
            setUpdating(false);
            setShowConfirm(false);
        }
    };

    if (!despacho) return null;

    const isRecibido = despacho.estatus === 'RECIBIDO';

    return createPortal(
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-[95%] max-w-[1400px] h-[90vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Cabecera */}
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 text-white rounded-2xl shadow-xl shadow-brand-900/20">
                            <Utensils size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tighter uppercase leading-none">
                                {despacho.isGrouped ? "Resumen de Recepción" : "Confirmar Recepción"}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic mt-1">
                                {despacho.isGrouped
                                    ? `Consolidado de ${despacho.ids_remisiones?.length || 0} remisiones`
                                    : `Guía: REM-${formato8Digitos(despacho.id)}`
                                }
                            </p>
                            <div className="flex justify-start items-center gap-2">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Servicio</span>
                                <span className="text-[11px] font-black text-brand-900 uppercase">{despacho.ejecucion?.servicio?.nombre || 'General'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={22} /></button>
                </div>

                {/* Info de la Guía */}
                {/* <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex justify-center items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Servicio</span>
                            <span className="text-[11px] font-black text-brand-900 uppercase">{despacho.ejecucion?.servicio?.nombre || 'General'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Enviado Por</span>
                            <span className="text-[11px] font-black text-slate-700 uppercase">{despacho.usuario_despacho?.nombres}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                        <Warehouse size={12} className="text-slate-400" />
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight">Almacén Comedor</span>
                    </div>
                </div> */}

                {/* Matriz de Recepción Estilo Sercosys (Agrupado por Rubro) */}
                <div className="flex-1 overflow-y-auto px-8 p-1 bg-slate-50/30 custom-scrollbar">
                    <div className="bg-white rounded-md shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center w-[15%]">Rubro</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center w-[12%]">Total Enviado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-[48%]">Detalle de Lote y Producto</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right w-[25%]">Recepción Física</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300">
                                {detallesAgrupados.map((group) => {
                                    const rubroId = group.producto?.rubro?.id || group.id_insumo;
                                    const totalRubroUnidades = group.detalles_originales.reduce((acc, d) => acc + Number(d.cantidad_entregada), 0);
                                    const totalRubroVolumen = group.detalles_originales.reduce((acc, d) => {
                                        const factor = d.id_insumo === null ? 1 : (Number(d.presentacion_logistica?.factor) || 1);
                                        const vol = Number(d.cantidad_entregada) * factor;
                                        return acc + vol;
                                    }, 0);
                                    const unidad = group.producto?.rubro?.unidad?.abreviatura || group.detalles_originales[0]?.producto?.rubro?.unidad?.abreviatura;
                                    const rowCount = group.detalles_originales.length;

                                    return group.detalles_originales.map((det, idx) => {
                                        const isFaltante = Number(recibos[det.id]) < Number(det.cantidad_entregada);
                                        const isExcedente = Number(recibos[det.id]) > Number(det.cantidad_entregada);

                                        return (
                                            <tr key={det.id} className="group hover:bg-slate-50/50 transition-all duration-200">

                                                {/* 1. Rubro (Centrado Verticalmente) */}
                                                {idx === 0 && (
                                                    <td rowSpan={rowCount} className="px-6 py-2 border-r border-slate-50 bg-slate-50/20 align-middle">
                                                        <div className="flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-500">
                                                            <div className="p-3 bg-white rounded-2xl text-brand-900 shadow-sm border border-brand-100 ring-4 ring-brand-50/50">
                                                                <Package size={22} />
                                                            </div>
                                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest text-center leading-tight">
                                                                {group.producto?.rubro?.nombre}
                                                            </span>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 2. Total Rubro (Centrado Verticalmente) */}
                                                {idx === 0 && (
                                                    <td rowSpan={rowCount} className="px-6 py-2 border-r border-slate-50 bg-white align-middle text-center">
                                                        <div className="flex flex-col items-center justify-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-800 uppercase tracking-widest block">Volumen Total</span>
                                                            <p className="text-sm font-black text-brand-900 tabular-nums">
                                                                {formatNumber(totalRubroVolumen, getDecimalPlaces(totalRubroVolumen))}
                                                            </p>
                                                            <span className="text-[9px] font-bold text-brand-800 uppercase tracking-widest">{unidad}</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 3. Lote con Marca|Variedad|Empaque|Factor */}
                                                <td className="px-6 py-2">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none tracking-tight">
                                                            {det.producto?.marca?.nombre || 'MARCA'} | {det.producto?.variedad || 'VARIEDAD'} {det.id_insumo === null ? `| ${unidad}` : `| ${det.presentacion_logistica?.presentacion?.nombre || 'EMPAQUE'} | ${det.presentacion_logistica?.factor || '1'} ${unidad}`}
                                                        </span>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-4">
                                                                {det.lote && (
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                        Lote: <span className="text-brand-700 font-black">{det.lote || 'S/L'}</span>
                                                                    </span>
                                                                )}
                                                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                                {det.fecha_vencimiento && (
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                        Vence: <span className="text-brand-600 font-black">{formatDateSystemToDDMMYYYY(det.fecha_vencimiento)}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 4. Recepción Física (Input) */}
                                                <td className="px-6 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-6 group-hover:translate-x-[-4px] transition-transform">
                                                        <div className="text-right flex flex-col items-end">
                                                            <p className="text-[8px] font-black text-slate-890 uppercase tracking-widest mb-0.5">Enviado</p>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-[11px] font-black text-slate-800 tabular-nums">
                                                                    {formatNumber(det.cantidad_entregada, 0)}
                                                                </span>
                                                                <span className="text-[7px] font-bold text-slate-800 uppercase">UND</span>
                                                            </div>
                                                            {det.id_insumo !== null && (
                                                                 <p className="text-[9px] font-bold text-slate-800 tabular-nums">
                                                                     ({formatNumber(Number(det.cantidad_entregada) * (Number(det.presentacion_logistica?.factor) || 1), getDecimalPlaces(Number(det.cantidad_entregada) * (Number(det.presentacion_logistica?.factor) || 1)))} {unidad})
                                                                 </p>
                                                             )}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="relative flex items-center gap-2">
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        disabled={isRecibido || updating}
                                                                        className={`w-24 h-11 bg-slate-50 border rounded-xl text-center text-sm font-black outline-none transition-all disabled:opacity-50 ${isFaltante ? 'border-amber-200 text-amber-700 focus:ring-amber-500 bg-amber-50/20' :
                                                                            isExcedente ? 'border-blue-200 text-blue-700 focus:ring-blue-500 bg-blue-50/20' :
                                                                                'border-slate-100 text-slate-700 focus:ring-brand-500 hover:border-brand-200 shadow-inner focus:bg-white'
                                                                            }`}
                                                                        value={recibos[det.id] || ''}
                                                                        onChange={(e) => setRecibos(p => ({ ...p, [det.id]: e.target.value }))}
                                                                    />
                                                                    <span className="absolute -top-2 -right-2 bg-white px-1.5 py-0.5 rounded-md border border-slate-100 text-[7px] font-black text-slate-400 shadow-sm">UND</span>
                                                                </div>
                                                            </div>
                                                            {isFaltante && (
                                                                <div className="flex items-center gap-1 text-amber-600 animate-in slide-in-from-right-2 duration-300">
                                                                    <AlertTriangle size={8} />
                                                                    <span className="text-[8px] font-black uppercase tracking-tighter italic">Faltante físico</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className={isRecibido ? "text-emerald-500" : "text-slate-200"} />
                        <p className="text-[9px] font-bold italic text-slate-400 uppercase tracking-widest">
                            {isRecibido ? "Esta remisión ya fue recibida" : "Verifica físicamente antes de confirmar"}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        {!isRecibido && (
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={updating}
                                className="px-8 py-2.5 bg-brand-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                {updating ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Confirmar Recepción</>}
                            </button>
                        )}
                    </div>
                </div>

                <ConfirmModal
                    show={showConfirm}
                    title="Confirmar Recepción"
                    message="¿Confirmas la recepción física de estos insumos en cocina? Los niveles de inventario se actualizarán de inmediato."
                    icon={Utensils}
                    onConfirm={handleConfirmar}
                    onCancel={() => setShowConfirm(false)}
                    confirmText="Recibir Insumos"
                    type="brand"
                />
            </div>
        </div>,
        document.body
    );
}
