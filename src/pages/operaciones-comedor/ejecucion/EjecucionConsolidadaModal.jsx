import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Download, Loader2, AlertCircle, Warehouse, ChevronDown, ShoppingCart, Utensils, CheckCircle2 } from 'lucide-react';
import { getEjecucionInsumosConsolidado } from '../../../services/ejecucionService';

const EjecucionConsolidadaModal = ({ ejecucionId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);
    const [expandedAlmacenes, setExpandedAlmacenes] = useState({});

    useEffect(() => {
        const loadConsolidado = async () => {
            if (!ejecucionId) return;
            setLoading(true);
            try {
                const insumos = await getEjecucionInsumosConsolidado(ejecucionId);

                // Agrupación Jerárquica: Almacén > Categoría > Rubro
                const grouping = {};

                insumos.forEach(row => {
                    const rubro = row.rubro;
                    const almacen = rubro?.categoria?.almacenes?.nombre || 'ALMACÉN NO DEFINIDO';
                    const categoria = rubro?.categoria?.nombre || 'OTRO';
                    const rubroId = row.id_rubro;

                    if (!grouping[almacen]) grouping[almacen] = {};
                    if (!grouping[almacen][categoria]) grouping[almacen][categoria] = {};

                    if (!grouping[almacen][categoria][rubroId]) {
                        const mermaPct = (rubro?.mermas || []).reduce((acc, m) => acc + Number(m.valor), 0);
                        const neto = Number(row.cantidad_requerida || 0);
                        const bruto = neto / (1 - (mermaPct / 100));
                        const fraccionamiento = rubro.tipo_fraccionamiento;

                        grouping[almacen][categoria][rubroId] = {
                            nombre: rubro?.nombre || 'Desconocido',
                            unidad: rubro?.unidad?.abreviatura || 'un',
                            es_fraccionable: rubro?.unidad?.es_fraccionable ?? true,
                            neto: neto,
                            merma_pct: mermaPct,
                            bruto: bruto,
                            fraccionamiento: fraccionamiento,
                            categoriaNombre: categoria
                        };
                    } else {
                        // Por si acaso hay duplicados del mismo rubro en diferentes recetas
                        grouping[almacen][categoria][rubroId].neto += Number(row.cantidad_requerida || 0);
                        const mermaPct = grouping[almacen][categoria][rubroId].merma_pct;
                        const nuevoBruto = grouping[almacen][categoria][rubroId].neto / (1 - (mermaPct / 100));
                        grouping[almacen][categoria][rubroId].bruto = nuevoBruto;
                        //grouping[almacen][categoria][rubroId].techo = Math.ceil(nuevoBruto);
                    }
                });

                // Transformar a estructura plana para renderizado
                const finalStructure = Object.entries(grouping).map(([almacen, categorias]) => ({
                    almacen,
                    items: Object.entries(categorias).flatMap(([cat, rubros]) => Object.values(rubros))
                        .sort((a, b) => a.categoriaNombre.localeCompare(b.categoriaNombre) || a.nombre.localeCompare(b.nombre))
                })).sort((a, b) => a.almacen.localeCompare(b.almacen));

                setData(finalStructure);

                // Expandir el primero por defecto
                if (finalStructure.length > 0) {
                    setExpandedAlmacenes({ [finalStructure[0].almacen]: true });
                }
            } catch (err) {
                console.error("Error al cargar consolidado:", err);
                setError("No se pudo cargar el consolidado de insumos.");
            } finally {
                setLoading(false);
            }
        };

        loadConsolidado();
    }, [ejecucionId]);

    const toggleAlmacen = (name) => {
        setExpandedAlmacenes(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return createPortal(
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full h-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-100">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 rounded-xl text-white shadow-lg shadow-brand-900/20">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Consolidado de Demanda</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Snapshot de Insumos Agrupados por Almacén</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.print()} className="p-3 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-xl transition-all">
                            <Download size={20} />
                        </button>
                        <button onClick={onClose} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-1 bg-slate-50/30 space-y-4">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 text-brand-900 animate-spin mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generando Explosión de Insumos...</p>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                            <AlertCircle size={48} className="text-red-500 mb-4" />
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{error}</p>
                            <button onClick={onClose} className="mt-4 text-xs font-bold text-brand-900 underline">Cerrar</button>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center opacity-30">
                            <Utensils size={48} className="mb-4" />
                            <p className="text-sm font-black uppercase italic">No hay insumos registrados para esta ejecución</p>
                        </div>
                    ) : (
                        data.map((grupo, idx) => (
                            <div key={idx} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                                <button
                                    onClick={() => toggleAlmacen(grupo.almacen)}
                                    className="w-full px-8 py-5 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-brand-900 rounded-xl flex items-center justify-center text-white">
                                            <Warehouse size={16} />
                                        </div>
                                        <div className="text-left">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{grupo.almacen}</h4>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{grupo.items.length} Rubros en Demanda</p>
                                        </div>
                                    </div>
                                    <ChevronDown className={`text-slate-300 transition-transform duration-300 ${expandedAlmacenes[grupo.almacen] ? 'rotate-180' : ''}`} />
                                </button>

                                {expandedAlmacenes[grupo.almacen] && (
                                    <div className="px-4 py-1 animate-in fade-in duration-300">
                                        <div className="overflow-x-auto rounded-md border border-slate-50">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50/80">
                                                    <tr>
                                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Rubro / Ingrediente</th>
                                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Neto</th>
                                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Merma %</th>
                                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-brand-900 text-right bg-brand-50/30">Total Bruto</th>
                                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white text-center bg-brand-900">Pedido Techo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {grupo.items.map((item, iIdx) => (
                                                        <tr key={iIdx} className="hover:bg-slate-50/30 transition-all group">
                                                            <td className="px-6 py-1">
                                                                <p className="text-[11px] font-bold text-slate-800 uppercase group-hover:text-brand-900 transition-colors">{item.nombre}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.categoriaNombre} | {item.unidad}</p>
                                                            </td>
                                                            <td className="px-6 py-1 text-center text-[11px] font-bold text-slate-600 tabular-nums">{item.neto.toFixed(2)}</td>
                                                            <td className="px-6 py-1 text-center text-[10px] font-black text-amber-600">{item.merma_pct > 0 ? `+${item.merma_pct}%` : '-'}</td>
                                                            <td className="px-6 py-1 text-right text-[11px] font-black text-brand-700 bg-brand-50/10 tabular-nums">{item.bruto.toFixed(2)}</td>
                                                            <td className="px-6 py-1 text-center text-sm font-black text-brand-900 bg-brand-900/5 border-l border-brand-100 tabular-nums">
                                                                <div className='grid grid-cols-3 items-center justify-end gap-2'>
                                                                    <p className="col-span-2 text-right"> 
                                                                        {!item.es_fraccionable ? Math.ceil(item.bruto).toFixed(0) : (item.fraccionamiento === "SIEMPRE" || item.fraccionamiento === "SOLO_EJECUCION") ? item.bruto.toFixed(2) : Math.ceil(item.bruto).toFixed(0)} 
                                                                    </p>
                                                                    <p className="col-span-1 text-left text-[9px]">{item.unidad}</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <ShoppingCart size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Rubros: {data.reduce((acc, g) => acc + g.items.length, 0)}</span>
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 italic">Los valores "Techo" se redondean al entero superior para despacho físico.</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EjecucionConsolidadaModal;
