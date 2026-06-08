import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ChefHat, Trash2, Search, Calendar, Utensils, Check, Info, Users, AlertCircle, CheckCircle2, ShoppingCart, Calculator, Loader2 } from 'lucide-react';
import { formatToISODate } from '../../../util/workDate';
import { getPlanificacionBase, saveEjecucionDiaria, getEjecucionesByComedor } from '../../../services/ejecucionService';
import { getRecetasDisponibles, getEstructuraSlots, getTipologias } from '../../../services/planificacionService';
import EjecucionConsolidadaModal from './EjecucionConsolidadaModal';

export default function EjecucionModal({ initialData, selectedDay, comedorSel, serviciosDisponibles, empresaActiva, perfil, onClose, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [mastersLoading, setMastersLoading] = useState(true);
    const [currentEjecucionId, setCurrentEjecucionId] = useState(initialData?.id || null);
    const [internalDate, setInternalDate] = useState(initialData?.fecha_ejecucion || formatToISODate(new Date()));
    const [internalServicioId, setInternalServicioId] = useState(initialData?.id_tipo_servicio || '');
    const [detalleMenu, setDetalleMenu] = useState([]);
    const [slots, setSlots] = useState([]);
    const [recetas, setRecetas] = useState([]);
    const [tipologias, setTipologias] = useState([]);
    const [insumosCalculados, setInsumosCalculados] = useState([]);
    const [showConsolidado, setShowConsolidado] = useState(false);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [hasPlanningForDate, setHasPlanningForDate] = useState(true);
    const [checkingPlan, setCheckingPlan] = useState(false);

    // El documento está bloqueado si ya no es un borrador
    const isLocked = initialData?.estatus && initialData?.estatus !== 'BORRADOR';

    // Cálculos dinámicos de base
    const baseSlotIds = slots.filter(s =>
        s.tipologias?.some(t => tipologias.find(tp => Number(tp.id) === Number(t.id_tipologia))?.es_base)
    ).map(s => Number(s.id));

    const totalBasePax = detalleMenu
        .filter(d => baseSlotIds.includes(Number(d.id_estructura_slot)))
        .reduce((acc, d) => acc + (Number(d.comensales) || 0), 0);

    const calculateInsumos = useCallback((detalle, totalBasePax, masterRecetas) => {
        const insumosMap = {};
        const numComensales = Number(totalBasePax) || 0;
        const currentRecetas = masterRecetas || recetas;

        detalle.forEach(d => {
            if (!d.id_receta) return;
            const recetaObj = currentRecetas.find(rm => rm.id === Number(d.id_receta)) || d.receta_info;

            if (recetaObj && recetaObj.ingredientes) {
                recetaObj.ingredientes.forEach(ing => {
                    const rubroId = ing.id_rubro;
                    const cantBase = Number(ing.cantidad_neta || ing.cantidad || 0);
                    const cantidadTotal = cantBase * numComensales;

                    if (!insumosMap[rubroId]) {
                        insumosMap[rubroId] = {
                            id_rubro: rubroId,
                            nombre: ing.rubro?.nombre || 'Insumo',
                            unidad: ing.rubro?.unidad?.abreviatura || 'un',
                            id_unidad_medida: ing.id_unidad_medida,
                            cantidad_requerida: 0,
                            id_receta_origen: d.id_receta
                        };
                    }
                    insumosMap[rubroId].cantidad_requerida += cantidadTotal;
                });
            }
        });
        setInsumosCalculados(Object.values(insumosMap));
    }, [recetas]);

    useEffect(() => {
        const loadMasterData = async () => {
            setMastersLoading(true);
            try {
                const [recData, tipData] = await Promise.all([
                    getRecetasDisponibles(empresaActiva?.id),
                    getTipologias()
                ]);
                setRecetas(recData || []);
                setTipologias(tipData || []);

                if (initialData?.id_tipo_servicio) {
                    await handleLoadPlan(initialData.id_tipo_servicio, true, recData);
                }
            } catch (error) {
                console.error("Error al cargar maestros:", error);
            } finally {
                setMastersLoading(false);
            }
        };
        if (empresaActiva?.id) loadMasterData();
    }, [empresaActiva?.id, initialData]);

    // Resetear validación si cambia la fecha y validar planificación
    useEffect(() => {
        if (!initialData) {
            setIsDuplicate(false);
            setInternalServicioId('');
            validarExistenciaPlan();
        }
    }, [internalDate]);

    const validarExistenciaPlan = async () => {
        if (!comedorSel?.id || !internalDate) return;
        setCheckingPlan(true);
        try {
            // Reutilizamos la lógica de buscar la cabecera (se podría mover a un servicio dedicado)
            const { data, error } = await import('../../../lib/supabase').then(m => m.supabase
                .from('planificacion_semanal')
                .select('id')
                .eq('id_comedor', comedorSel.id)
                .lte('semana_inicio', internalDate)
                .gte('semana_fin', internalDate)
                .eq('estatus', 'APROBADO') // Solo planes aprobados
                .maybeSingle()
            );
            setHasPlanningForDate(!!data);
        } catch (e) {
            setHasPlanningForDate(false);
        } finally {
            setCheckingPlan(false);
        }
    };

    const handleLoadPlan = async (id_tipo_servicio, isInitial = false, loadedRecetas = null) => {
        setIsDuplicate(false);
        setLoading(true);
        try {
            const serv = serviciosDisponibles.find(s => s.id_tipo_servicio === id_tipo_servicio);
            if (!serv) return;

            const fecha = internalDate;

            // VALIDACIÓN DE DUPLICIDAD (Solo si es creación)
            if (!initialData) {
                const existing = await getEjecucionesByComedor(comedorSel.id, fecha);
                const alreadyExists = existing?.find(e => Number(e.id_tipo_servicio) === Number(id_tipo_servicio));
                if (alreadyExists) {
                    setIsDuplicate(true);
                    setInternalServicioId(id_tipo_servicio); // Lo guardamos para resaltar el botón con error
                    setLoading(false);
                    return; // Bloqueamos el avance
                }
            }

            setInternalServicioId(id_tipo_servicio); // Solo avanzamos si NO es duplicado
            const slotsData = await getEstructuraSlots(serv.id_estructura_menu);
            setSlots(slotsData || []);
            
            let grid = [];
            if (isInitial && initialData) {
                grid = slotsData.map(slot => {
                    const saved = initialData.recetas?.find(r => Number(r.id_estructura_slot) === Number(slot.id));
                    return {
                        fecha: fecha,
                        id_estructura_slot: slot.id,
                        id_receta: saved?.id_receta || '',
                        comensales: saved?.comensales || 0,
                        slot_nombre: slot.nombre,
                        tempId: Math.random().toString(36).substr(2, 9)
                    };
                });
            } else {
                const data = await getPlanificacionBase(comedorSel.id, fecha, id_tipo_servicio);
                grid = slotsData.map(slot => {
                    const saved = data.find(d => Number(d.id_estructura_slot) === Number(slot.id));
                    return {
                        fecha: fecha,
                        id_estructura_slot: slot.id,
                        id_receta: saved?.id_receta || '',
                        comensales: saved?.comensales || 0,
                        receta_info: saved?.receta,
                        slot_nombre: slot.nombre,
                        tempId: Math.random().toString(36).substr(2, 9)
                    };
                });
            }

            setDetalleMenu(grid);
            const totalPax = isInitial ? initialData.comensales_reales : (grid.find(g => g.comensales > 0)?.comensales || 0);
            calculateInsumos(grid, totalPax, loadedRecetas);
        } catch (error) {
            console.error('Error al cargar plan:', error);
        } finally {
            setLoading(false);
        }
    };

    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async (estatus = 'BORRADOR') => {
        if (!empresaActiva?.id || !perfil?.id) {
            alert('Error: No se encontró contexto de empresa o usuario activo.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                cabecera: {
                    id: currentEjecucionId,
                    id_empresa: empresaActiva.id,
                    id_comedor: comedorSel.id,
                    fecha_ejecucion: internalDate,
                    id_tipo_servicio: internalServicioId,
                    estatus: estatus
                },
                // Detalle normalizado con comensales por cada línea de slot/receta
                detalle: detalleMenu
                    .filter(d => d.id_receta && d.comensales > 0)
                    .map(d => ({
                        id_receta: d.id_receta,
                        id_estructura_slot: d.id_estructura_slot,
                        comensales: d.comensales
                    })),
                id_usuario: perfil.id
            };

            const savedId = await saveEjecucionDiaria(payload);
            setCurrentEjecucionId(savedId);

            if (estatus === 'PENDIENTE') {
                onUpdate();
                onClose();
            } else {
                onUpdate();
                setSaveSuccess(true);
            }
        } catch (error) {
            console.error('Error al guardar ejecución:', error);
            alert('Error al guardar la ejecución diaria');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100">

                {/* Header Principal */}
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-brand-900 rounded-2xl text-white shadow-lg shadow-brand-900/20 rotate-3">
                            <ChefHat size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                                {currentEjecucionId ? 'Gestionar' : 'Nueva'} Ejecución
                            </h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                                {new Date(internalDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    {mastersLoading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full animate-pulse">
                            <Loader2 size={14} className="animate-spin text-brand-900" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Cargando Recetas...</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        {isLocked && (
                            <div className={`flex items-center gap-2 px-4 py-2 border rounded-full ${initialData?.estatus === 'CERRADO' ? 'bg-brand-900 border-brand-900 text-white' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                {initialData?.estatus === 'CERRADO' ? <PackageCheck size={14} /> : <CheckCircle2 size={14} />}
                                <span className="text-[10px] font-black uppercase tracking-widest">Documento {initialData?.estatus} - Solo Lectura</span>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 text-slate-300 rounded-full transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/20">
                    {(!internalServicioId || isDuplicate) ? (
                        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-12 gap-16 animate-in fade-in zoom-in duration-700">
                            <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-sm">
                                <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center text-brand-900 mb-8 shadow-inner">
                                    <Utensils size={40} />
                                </div>
                                <h3 className="text-4xl font-black text-slate-800 tracking-tighter leading-tight mb-4">
                                    Inicia la <span className="text-brand-900">Ejecución</span>
                                </h3>
                                <p className="text-slate-400 text-sm font-medium italic border-l-4 border-brand-100 pl-6 leading-relaxed mb-6">
                                    Selecciona el servicio para cargar la planificación base.
                                </p>

                                <div className="w-full bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <Calendar size={12} className="text-brand-900" /> Fecha del Servicio
                                    </span>
                                    <input
                                        type="date"
                                        value={internalDate}
                                        onChange={(e) => setInternalDate(e.target.value)}
                                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${!hasPlanningForDate ? 'border-amber-400 focus:border-amber-500' : 'border-slate-100 focus:border-brand-900'}`}
                                    />
                                    {!hasPlanningForDate && !checkingPlan && (
                                        <div className="flex items-center gap-2 mt-2 text-amber-600 animate-in slide-in-from-top-1">
                                            <AlertCircle size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">No hay planificación aprobada para esta fecha</span>
                                        </div>
                                    )}
                                    {checkingPlan && (
                                        <div className="flex items-center gap-2 mt-2 text-slate-400">
                                            <Loader2 size={12} className="animate-spin" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Validando programación...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                                {isDuplicate && (
                                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 mb-2">
                                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-red-700">Servicio Duplicado</span>
                                            <span className="text-[9px] font-bold text-red-500 italic mt-1">Este servicio ya fue registrado para esta fecha. Seleccione otra fecha o servicio.</span>
                                        </div>
                                    </div>
                                )}
                                {serviciosDisponibles.map((serv) => (
                                    <button
                                        key={serv.id}
                                        disabled={mastersLoading || loading}
                                        onClick={() => handleLoadPlan(serv.id_tipo_servicio)}
                                        className={`w-full bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-brand-500/30 transition-all group flex items-center gap-6 text-left disabled:opacity-50 ${isDuplicate && internalServicioId === serv.id_tipo_servicio ? 'border-red-500 bg-red-50/10' : ''}`}
                                    >
                                        <div className={`w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-brand-900 group-hover:text-white transition-all duration-500 shrink-0 shadow-inner ${isDuplicate && internalServicioId === serv.id_tipo_servicio ? 'text-red-500' : ''}`}>
                                            {loading && internalServicioId === serv.id_tipo_servicio ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
                                        </div>
                                        <div>
                                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{serv.tipo_servicio?.nombre}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-2 italic opacity-60">{serv.estructura?.nombre}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-8 py-1 space-y-2 custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {/* Dashboard de Capacidad */}
                                <div className="bg-white border border-slate-100 px-6 py-1 rounded-xl shadow-sm flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-brand-50 text-brand-900 rounded-[1.5rem]">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cupo Base del Día</p>
                                            <p className="text-sm font-bold text-slate-500 italic">Basado en platos principales</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-4xl font-black text-brand-900 leading-none tabular-nums">{totalBasePax}</p>
                                        <p className="text-[9px] font-black uppercase text-brand-900/40 tracking-widest mt-1">Pax Ejecutados</p>
                                    </div>
                                </div>

                                {/* Cuadrícula de Slots */}
                                <div className="grid grid-cols-1 gap-3 mb-4">
                                    {slots.map(slot => {
                                        const isBase = baseSlotIds.includes(Number(slot.id));
                                        const existing = detalleMenu.find(d => Number(d.id_estructura_slot) === Number(slot.id));
                                        const slotTipologias = slot.tipologias?.map(t => Number(t.id_tipologia)) || [];

                                        const sameTypeEntries = detalleMenu.filter(d => {
                                            const dSlot = slots.find(s => Number(s.id) === Number(d.id_estructura_slot));
                                            return dSlot?.tipologias?.some(t => slotTipologias.includes(Number(t.id_tipologia))) && Number(d.id_estructura_slot) !== Number(slot.id);
                                        });
                                        const currentOtherSum = sameTypeEntries.reduce((acc, d) => acc + (Number(d.comensales) || 0), 0);
                                        const maxAllowed = isBase ? 999999 : Math.max(0, totalBasePax - currentOtherSum);
                                        const currentTotalPax = currentOtherSum + (Number(existing?.comensales) || 0);
                                        const groupPercentage = totalBasePax > 0 ? Math.round((currentTotalPax / totalBasePax) * 100) : 0;

                                        return (
                                            <div key={slot.id} className="flex flex-col md:flex-row md:items-center gap-4 group">
                                                <div className="md:w-48 shrink-0">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-md border block text-center md:text-left truncate transition-all ${isBase ? 'bg-brand-900 text-white border-brand-900 shadow-lg shadow-brand-900/10' : 'bg-white text-slate-500 border-slate-100 shadow-sm'}`}>
                                                        {slot.nombre}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <SlotCell
                                                        entry={existing}
                                                        recetas={recetas}
                                                        tipologiasPermitidas={slotTipologias}
                                                        isReadOnly={mastersLoading || isLocked}
                                                        maxPax={maxAllowed}
                                                        totalBasePax={totalBasePax}
                                                        groupPercentage={groupPercentage}
                                                        isBase={isBase}
                                                        onChange={(updates) => {
                                                            const newDetalle = detalleMenu.map(d =>
                                                                (Number(d.id_estructura_slot) === Number(slot.id))
                                                                    ? { ...d, ...updates }
                                                                    : d
                                                            );
                                                            setDetalleMenu(newDetalle);

                                                            const newTotalBase = newDetalle
                                                                .filter(dn => baseSlotIds.includes(Number(dn.id_estructura_slot)))
                                                                .reduce((acc, dn) => acc + (Number(dn.comensales) || 0), 0);

                                                            calculateInsumos(newDetalle, newTotalBase);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer sticky */}
                {(internalServicioId && !isDuplicate) && (
                    <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 z-30">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 text-slate-400 italic text-[10px] font-medium">
                                <Info size={14} className="text-brand-900" />
                                <p>Revise el consolidado agrupado antes de aprobar.</p>
                            </div>
                            {currentEjecucionId && (
                                <button
                                    onClick={() => setShowConsolidado(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-brand-50 text-brand-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100 shadow-sm"
                                >
                                    <Calculator size={16} /> Ver Consolidado
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className={`px-8 py-3 text-[10px] font-black uppercase transition-all tracking-widest rounded-xl ${isLocked ? 'bg-brand-900 text-white hover:bg-brand-800 shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                {isLocked ? 'Regresar' : 'Cancelar'}
                            </button>

                            {!isLocked && (
                                <>
                                    <button
                                        onClick={() => handleSave('BORRADOR')}
                                        disabled={loading || mastersLoading}
                                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Save size={16} /> Guardar Borrador
                                    </button>

                                    <button
                                        onClick={() => handleSave('PENDIENTE')}
                                        disabled={loading || mastersLoading || detalleMenu.filter(d => d.id_receta && d.comensales > 0).length === 0}
                                        className="flex items-center gap-3 px-10 py-4 bg-brand-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-800 transition-all shadow-2xl shadow-brand-900/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                        Aprobar Ejecución
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {showConsolidado && (
                    <EjecucionConsolidadaModal
                        ejecucionId={currentEjecucionId}
                        onClose={() => setShowConsolidado(false)}
                    />
                )}

                {/* Modal de Éxito al guardar Borrador */}
                {saveSuccess && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" />
                        <div className="relative bg-white rounded-[2.5rem] p-10 shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-300 border border-slate-100">
                            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                                <CheckCircle2 size={48} strokeWidth={3} />
                            </div>
                            <h4 className="text-2xl font-black text-slate-800 tracking-tighter mb-2">¡Todo Listo!</h4>
                            <p className="text-slate-400 text-sm font-medium italic mb-8">El borrador de ejecución se ha guardado correctamente.</p>
                            <button
                                onClick={() => setSaveSuccess(false)}
                                className="w-full py-4 bg-brand-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

function SlotCell({ entry, recetas, tipologiasPermitidas = [], isReadOnly, maxPax, totalBasePax, groupPercentage, isBase, onChange }) {
    if (!entry) return null;

    const recetasFiltradas = tipologiasPermitidas.length > 0
        ? recetas.filter(r => tipologiasPermitidas.some(idT => Number(idT) === Number(r.id_tipologia)))
        : recetas;

    const isOverLimit = !isBase && Number(entry.comensales) > Number(maxPax);
    const paxNumber = Number(entry.comensales) || 0;
    const totalBaseNumber = Number(totalBasePax) || 0;
    const percentage = totalBaseNumber > 0 ? Math.round((paxNumber / totalBaseNumber) * 100) : 0;

    return (
        <div className={`px-5 py-1 rounded-md border-2 transition-all min-h-[70px] flex flex-col justify-center ${entry.id_receta ? 'bg-white border-brand-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-60 hover:opacity-100 hover:bg-white hover:border-brand-100'} ${isOverLimit ? 'border-red-500 bg-red-50/30' : ''}`}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 group/sel w-full">
                    <ChefHat size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isOverLimit ? 'text-red-500' : 'text-slate-300 group-hover/sel:text-brand-900'}`} />
                    <select
                        disabled={isReadOnly}
                        value={entry.id_receta || ''}
                        onChange={(e) => onChange({ id_receta: e.target.value })}
                        className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-[11px] font-black uppercase tracking-tight appearance-none focus:ring-2 outline-none transition-all ${isOverLimit ? 'bg-white border-red-200 text-red-900 focus:ring-red-500/20' : 'bg-slate-50 border-slate-100 text-slate-700 focus:ring-brand-500/20'}`}
                    >
                        <option value="">Seleccione Receta...</option>
                        {recetasFiltradas.map(r => (
                            <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-36">
                    <div className="flex-1 relative">
                        <Users size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isOverLimit ? 'text-red-500' : 'text-slate-300'}`} />
                        <input
                            type="number"
                            disabled={isReadOnly || !entry.id_receta}
                            value={entry.comensales || ''}
                            onChange={(e) => onChange({ comensales: parseInt(e.target.value) || 0 })}
                            placeholder="Pax"
                            className={`w-full pl-8 pr-3 py-2.5 border rounded-xl text-xs font-black tabular-nums focus:ring-2 outline-none transition-all ${!entry.id_receta ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : isOverLimit ? 'bg-white border-red-200 text-red-900 focus:ring-red-500/20' : 'bg-slate-50 border-slate-100 text-brand-900'}`}
                        />
                        {!isBase && totalBaseNumber > 0 && (
                            <span className={`absolute -top-6 right-0 text-[9px] font-black uppercase tracking-widest bg-white px-2 ${isOverLimit ? 'text-red-500' : 'text-brand-900'}`}>
                                {percentage}%
                            </span>
                        )}
                        {isBase && (
                            <span className="absolute -top-6 right-0 text-[9px] font-black text-brand-900 uppercase tracking-widest bg-white px-2">BASE</span>
                        )}
                    </div>
                    {!isReadOnly && entry.id_receta && (
                        <button
                            onClick={() => onChange({ id_receta: '', comensales: 0 })}
                            className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
            {isOverLimit && (
                <p className="text-[9px] font-black text-red-500 uppercase mt-2 animate-in fade-in slide-in-from-top-1 text-center sm:text-left">
                    Excede el cupo base ({groupPercentage}%.)
                </p>
            )}
        </div>
    );
}
