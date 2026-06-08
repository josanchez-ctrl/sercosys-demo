import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Save, Layers } from 'lucide-react';
import { formato8Digitos } from '../../../util/workDate';
import { registrarRetornoDespacho } from '../../../services/despachoCocinaService';
import { toast } from 'sonner';

const ESTADOS_RETORNO = [
    { value: 'RETORNADO', label: 'Retornado', color: 'bg-emerald-50 border-emerald-500 text-emerald-700' },
    { value: 'DAÑADO',    label: 'Dañado',    color: 'bg-amber-50 border-amber-500 text-amber-700' },
    { value: 'EXTRAVIADO', label: 'Extraviado', color: 'bg-red-50 border-red-500 text-red-700' },
];

const getNombreItem = (item) => {
    if (!item?.producto) return '—';
    const rubro = item.producto?.rubro?.nombre || '';
    const marca = item.producto?.marca?.nombre || '';
    const variedad = item.producto?.variedad || '';
    return [rubro, marca, variedad].filter(Boolean).join(' · ');
};

const isRetornable = (detalle) =>
    detalle?.item_inventario?.producto?.rubro?.categoria?.nombre?.toUpperCase() === 'UTENSILIOS';

export default function RetornoDespachoAlimentosModal({ despacho, detalles, perfil, onClose, onUpdate }) {
    const [comensalesReales,   setComensalesReales]   = useState(0);
    const [personalSercoReal,  setPersonalSercoReal]   = useState(0);
    const [submitting,         setSubmitting]          = useState(false);

    // ── Estado de conciliación por detalle ───────────────────────────────────
    const [conciliacion, setConciliacion] = useState(
        detalles.map(det => ({
            id_detalle:           det.id,
            bloque_tipo:          det.bloque_tipo,
            receta_nombre:        det.receta?.nombre || null,
            item_inventario:      det.item_inventario || null,
            id_grupo_bandeja:     det.id_grupo_bandeja || null,
            es_insumo_aparte:     det.es_insumo_aparte || false,
            es_retornable:        isRetornable(det),
            // Valores de retorno a capturar
            cantidad_devuelta:    isRetornable(det) ? (det.cantidad_despachada || 1) : 0,
            raciones_devueltas:   0,
            volumen_devuelto:     0,
            estatus_retorno:      isRetornable(det) ? 'RETORNADO' : 'PENDIENTE',
            observaciones_retorno: ''
        }))
    );

    const handleChange = (index, field, value) => {
        setConciliacion(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleEstadoChange = (index, estado) => {
        setConciliacion(prev => {
            const updated = [...prev];
            updated[index].estatus_retorno  = estado;
            updated[index].cantidad_devuelta = estado === 'EXTRAVIADO' ? 0 : (detalles[index].cantidad_despachada || 1);
            return updated;
        });
    };

    const handleGuardar = async (e) => {
        e.preventDefault();

        const perdidos = conciliacion.filter(c => c.es_retornable && c.estatus_retorno === 'EXTRAVIADO');
        const danados  = conciliacion.filter(c => c.es_retornable && c.estatus_retorno === 'DAÑADO');

        if (perdidos.length > 0 || danados.length > 0) {
            const msg = `Se registrarán:\n- ${perdidos.length} ítem(s) extraviado(s) (no regresan al inventario)\n- ${danados.length} ítem(s) dañado(s)\n\n¿Desea continuar?`;
            if (!window.confirm(msg)) return;
        }

        setSubmitting(true);
        try {
            const detallesRetorno = conciliacion.map(c => ({
                id_detalle:           c.id_detalle,
                cantidad_devuelta:    Number(c.cantidad_devuelta)  || 0,
                raciones_devueltas:   Number(c.raciones_devueltas) || 0,
                volumen_devuelto:     Number(c.volumen_devuelto)   || 0,
                estatus_retorno:      c.estatus_retorno || 'PENDIENTE',
                observaciones_retorno: c.observaciones_retorno || null
            }));

            const res = await registrarRetornoDespacho(
                despacho.id,
                Number(comensalesReales) || 0,
                Number(personalSercoReal) || 0,
                detallesRetorno,
                perfil.id
            );

            if (res.success) { toast.success(res.message); onUpdate(); onClose(); }
            else toast.error(res.message || 'Error al registrar retorno');
        } catch (error) {
            toast.error('Error del servidor: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Agrupar detalles por grupo de bandeja para mostrarlos agrupados
    const detallesAgrupados = (() => {
        const grupos = {};
        const sinGrupo = [];
        conciliacion.forEach((item, idx) => {
            if (item.id_grupo_bandeja !== null && item.id_grupo_bandeja !== undefined) {
                const key = item.id_grupo_bandeja;
                if (!grupos[key]) grupos[key] = [];
                grupos[key].push({ ...item, _idx: idx });
            } else {
                sinGrupo.push({ ...item, _idx: idx });
            }
        });
        return { grupos, sinGrupo };
    })();

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-md w-full h-full max-w-[95vw] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="bg-brand-900 text-white px-8 py-6 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-800 rounded-2xl"><RotateCcw size={22} /></div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wide">Retorno y Conciliación</h3>
                            <p className="text-[10px] text-brand-200 uppercase tracking-widest italic mt-0.5">
                                Guía D-COC-{formato8Digitos(despacho.id)} · GR (Goods Receipt) de utensilios retornables
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleGuardar} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">

                        {/* Renglones sin grupo (LINEA) */}
                        {detallesAgrupados.sinGrupo.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conciliación de Renglones</h4>
                                {detallesAgrupados.sinGrupo.map(item => (
                                    <RenglonConciliacion
                                        key={item.id_detalle}
                                        item={item}
                                        detalleOriginal={detalles[item._idx]}
                                        onChange={handleChange}
                                        onEstadoChange={handleEstadoChange}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Grupos de bandejas (EMPACADO) */}
                        {Object.entries(detallesAgrupados.grupos).map(([grupoNum, items]) => (
                            <GrupoBandejaConciliacion
                                key={grupoNum}
                                grupoNum={grupoNum}
                                items={items}
                                detalles={detalles}
                                conciliacion={conciliacion}
                                onChange={handleChange}
                                onEstadoChange={handleEstadoChange}
                            />
                        ))}

                    </div>

                    {/* Footer */}
                    <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose}
                            className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs font-black uppercase hover:bg-slate-50 active:scale-95 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={submitting}
                            className="px-6 py-3 bg-brand-900 text-white rounded-lg text-xs font-black uppercase shadow-xl shadow-brand-900/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                            <Save size={14} /> {submitting ? 'Guardando...' : 'Guardar Conciliación (GR)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ── Componente auxiliar para conciliar grupos de bandejas empacadas ───────────
function GrupoBandejaConciliacion({ grupoNum, items, detalles, conciliacion, onChange, onEstadoChange }) {
    // 1. Identificar el envase (tiene item_inventario pero no id_receta)
    const envaseItem = items.find(it => it.item_inventario !== null && !it.receta_nombre);
    // 2. Identificar las recetas (tienen id_receta / receta_nombre)
    const recetasItems = items.filter(it => it.receta_nombre);

    if (!envaseItem) return null;

    // Buscar en el estado conciliacion actual del envase
    const envaseConciliado = conciliacion.find(c => c.id_detalle === envaseItem.id_detalle);
    const envaseIdx = envaseItem._idx;
    
    const qtyReturned = envaseConciliado?.cantidad_devuelta ?? 0;
    const estatusRetorno = envaseConciliado?.estatus_retorno ?? 'RETORNADO';
    const observacionesRetorno = envaseConciliado?.observaciones_retorno ?? '';

    const envaseDispatchedQty = Number(detalles[envaseIdx]?.cantidad_despachada) || 1;
    const isEnvaseRetornable = envaseItem.es_retornable;

    // Al cambiar la cantidad devuelta de combos completos
    const handleQtyChange = (val) => {
        const numVal = Math.min(envaseDispatchedQty, Math.max(0, Number(val) || 0));
        // 1. Actualizar el envase
        onChange(envaseIdx, 'cantidad_devuelta', numVal);

        // 2. Actualizar las recetas del grupo de manera proporcional
        const ratio = numVal / envaseDispatchedQty;
        recetasItems.forEach(rec => {
            const origDet = detalles[rec._idx];
            const origVol = Number(origDet?.volumen_despachado) || 0;

            const calcVol = parseFloat((ratio * origVol).toFixed(3));
            const calcRac = numVal; // 1 combo devuelto = 1 ración devuelta de cada ingrediente del combo

            onChange(rec._idx, 'volumen_devuelto', calcVol);
            onChange(rec._idx, 'raciones_devueltas', calcRac);
            onChange(rec._idx, 'estatus_retorno', 'RETORNADO');
        });
    };

    // Al cambiar el estado físico del envase retornable
    const handleStateUpdate = (state) => {
        onEstadoChange(envaseIdx, state);
        if (state === 'EXTRAVIADO') {
            // Si se extravió, la cantidad devuelta física es 0
            handleQtyChange(0);
        }
    };

    return (
        <div className="border border-purple-100 rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
            {/* Header del Grupo */}
            <div className="bg-purple-50 px-6 py-3 flex items-center justify-between border-b border-purple-100">
                <div className="flex items-center gap-2">
                    <Layers size={13} className="text-purple-600" />
                    <span className="text-xs font-black text-purple-900 uppercase tracking-wider">
                        Grupo de Bandejas #{grupoNum} · {envaseItem.item_inventario ? getNombreItem(envaseItem.item_inventario) : 'Envase'}
                    </span>
                    {isEnvaseRetornable ? (
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[8px] font-black border border-blue-100 uppercase tracking-widest">Retornable</span>
                    ) : (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black border border-slate-200 uppercase tracking-widest">Desechable</span>
                    )}
                </div>
                <span className="px-3 py-1 bg-purple-200 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {envaseDispatchedQty} Combos Despachados
                </span>
            </div>

            <div className="p-5 flex flex-col lg:flex-row gap-6">
                {/* Lado Izquierdo: Resumen del Menú Empacado */}
                <div className="flex-1 space-y-3">
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">
                        Contenido y Porciones por Combo
                    </h5>
                    <div className="divide-y divide-slate-100">
                        {recetasItems.map(rec => {
                            const origDet = detalles[rec._idx];
                            // Porción individual teórica
                            const portionVal = (Number(origDet?.volumen_despachado) || 0) / envaseDispatchedQty;
                            const uom = origDet?.unidad_volumen || 'und';
                            const recName = rec.receta_nombre || 'Receta';

                            // Valores calculados que retornarán
                            const currentRecConc = conciliacion[rec._idx];
                            const currentRecVol = currentRecConc?.volumen_devuelto ?? 0;
                            const currentRecRac = currentRecConc?.raciones_devueltas ?? 0;

                            return (
                                <div key={rec.id_detalle} className="py-2 flex items-center justify-between text-xs">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 uppercase">{recName}</span>
                                        <span className="text-[9px] text-slate-400 italic">Porción Est.: {portionVal.toFixed(3)} {uom}</span>
                                    </div>
                                    <div className="text-right flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500">Despachado: {origDet?.volumen_despachado} {uom}</span>
                                        {qtyReturned > 0 && (
                                            <span className="text-[10px] font-black text-emerald-600">
                                                Retorna (Sobrante): {currentRecVol} {uom} ({currentRecRac} raciones)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Lado Derecho: Controles de Retorno */}
                <div className="w-full lg:w-[45%] p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-4">
                    {/* Cantidad Retornada */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            Combos Completos Devueltos (Sin Servir)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max={envaseDispatchedQty}
                            value={qtyReturned}
                            onChange={e => handleQtyChange(e.target.value)}
                            className="text-xs font-black text-slate-700 bg-white p-2.5 rounded-lg border border-gray-200 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all"
                        />
                        <span className="text-[8px] text-slate-400 font-bold italic">
                            Los ingredientes del menú sobrante se calcularán de manera proporcional.
                        </span>
                    </div>

                    {/* Controles de Estado Físico del Envase (Solo si es retornable) */}
                    {isEnvaseRetornable && (
                        <div className="flex flex-col gap-3 border-t border-slate-200/60 pt-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Estado Físico del Envase Retornable
                                </label>
                                <div className="flex gap-1.5">
                                    {ESTADOS_RETORNO.map(st => (
                                        <button
                                            key={st.value}
                                            type="button"
                                            onClick={() => handleStateUpdate(st.value)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase border transition-all ${
                                                estatusRetorno === st.value
                                                    ? st.color + ' shadow-sm'
                                                    : 'bg-white border-gray-200 text-slate-400 hover:bg-slate-50'
                                            }`}
                                        >
                                            {st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Observación del Retorno
                                </label>
                                <input
                                    type="text"
                                    placeholder="Daños, golpes, novedades..."
                                    value={observacionesRetorno}
                                    onChange={e => onChange(envaseIdx, 'observaciones_retorno', e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Componente auxiliar de cada renglón ────────────────────────────────────────
function RenglonConciliacion({ item, detalleOriginal, onChange, onEstadoChange }) {
    const etiquetaTipo = item.bloque_tipo === 'RECETA'
        ? (item.es_insumo_aparte ? 'Insumo Aparte' : 'Receta')
        : item.bloque_tipo === 'UTENSILIO' ? 'Utensilio' : 'Consumible';

    const colorTipo = {
        'Receta':      'bg-orange-50 text-orange-600 border-orange-200',
        'Insumo Aparte': 'bg-amber-50 text-amber-600 border-amber-200',
        'Utensilio':   'bg-blue-50 text-blue-600 border-blue-200',
        'Consumible':  'bg-slate-100 text-slate-600 border-slate-200',
    }[etiquetaTipo] || 'bg-slate-100 text-slate-600';

    const nombreDisplay = item.bloque_tipo === 'RECETA'
        ? (item.receta_nombre || '—')
        : (item.item_inventario ? getNombreItem(item.item_inventario) : '—');

    return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-start gap-4 animate-in fade-in duration-300">
            {/* Info */}
            <div className="md:w-[35%] flex flex-col gap-1.5">
                <div>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase border ${colorTipo}`}>
                        {etiquetaTipo}
                    </span>
                </div>
                <p className="font-bold text-slate-800 uppercase text-xs leading-tight">{nombreDisplay}</p>
                {item.bloque_tipo === 'RECETA' && item.item_inventario && (
                    <p className="text-[9px] text-slate-400 italic font-semibold">
                        En: {getNombreItem(item.item_inventario)}
                    </p>
                )}
                <p className="text-[9px] font-bold text-slate-400">
                    Despachado: {detalleOriginal?.cantidad_despachada} {detalleOriginal?.unidad_volumen || 'und'}
                </p>
            </div>

            {/* Controles */}
            <div className="flex-1 flex flex-col gap-3">
                {/* 1. Sección de Retorno de Alimento (Sobrantes) */}
                {item.bloque_tipo === 'RECETA' && (
                    <div className="p-3 bg-orange-50/20 rounded-xl border border-orange-100/70 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-700 block">
                            Retorno de Alimento (Sobrantes)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Raciones Sobrantes Devueltas</label>
                                <input type="number" min="0"
                                    value={item.raciones_devueltas}
                                    onChange={e => onChange(item._idx, 'raciones_devueltas', e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Peso / Volumen Devuelto</label>
                                <input type="number" min="0" step="0.001"
                                    value={item.volumen_devuelto}
                                    onChange={e => onChange(item._idx, 'volumen_devuelto', e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Sección de Retorno de Recipiente / Contenedor */}
                {item.es_retornable && (
                    <div className="p-3 bg-blue-50/20 rounded-xl border border-blue-100/70 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 block">
                            Retorno de Recipiente / Contenedor
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Estado Físico al Retorno</label>
                                <div className="flex gap-1.5">
                                    {ESTADOS_RETORNO.map(st => (
                                        <button key={st.value} type="button"
                                            onClick={() => onEstadoChange(item._idx, st.value)}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase border transition-all ${item.estatus_retorno === st.value ? st.color + ' shadow-sm' : 'bg-white border-gray-200 text-slate-400 hover:bg-slate-50'}`}>
                                            {st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Cantidad Devuelta</label>
                                <input type="number" min="0" step="0.01"
                                    value={item.cantidad_devuelta}
                                    onChange={e => onChange(item._idx, 'cantidad_devuelta', e.target.value)}
                                    disabled={item.estatus_retorno === 'EXTRAVIADO'}
                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none disabled:opacity-40 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all" />
                            </div>
                            <div className="md:col-span-2 flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Observación</label>
                                <input type="text" placeholder="Estado físico, daño observado..."
                                    value={item.observaciones_retorno}
                                    onChange={e => onChange(item._idx, 'observaciones_retorno', e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all w-full" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Sección para Consumibles (no retornables, no recetas) */}
                {!item.es_retornable && item.bloque_tipo !== 'RECETA' && (
                    <div className="flex items-center py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider italic">
                            Consumible — Salida definitiva, sin obligación de retorno
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
