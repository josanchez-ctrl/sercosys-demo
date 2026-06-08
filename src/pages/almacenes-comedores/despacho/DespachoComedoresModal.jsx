import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Loader2, Warehouse, ChevronDown, Utensils, CheckCircle2, Truck, Package, XCircle, Clock, Info, Hash, Calendar, Save, PackageCheck, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getEjecucionInsumosConsolidado, registrarEventoInsumo, getSaldoCocina, finalizarDespachoCabecera } from '../../../services/ejecucionService';
import { despacharInsumoConLotes, finalizarDespachoInsumo, anularInsumoEjecucion, getDesechablesParaDespachoManual, despacharDesechablesManual, getDesechablesDespachados } from '../../../services/despachoComedorService';
import { getLotesPorRubroComedor } from '../../../services/inventarioService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { Now } from '../../../services/nowService';
import { getDecimalPlaces } from '../../../util/workDecimales';
import { supabase } from '../../../lib/supabase';
import ConfirmModal from '../../../components/common/ConfirmModal';

const statusItemConfig = {
    PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Clock size={12} /> },
    DESPACHANDO: { label: 'Despachando', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <Truck size={12} /> },
    DESPACHADO_TOTAL: { label: 'Entregado', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle size={12} /> },
    RECIBIDO_TOTAL: { label: 'En Cocina', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Utensils size={12} /> },
};

const RubroRow = ({ item, idAlmacen, perfil, onUpdate, ejecucionId, estatusEjecucion }) => {
    const [lotes, setLotes] = useState([]);
    const [saldo, setSaldo] = useState(0);
    const [loading, setLoading] = useState(true);
    const [seleccion, setSeleccion] = useState({});
    const [updating, setUpdating] = useState(false);
    const [showFinalizarConfirm, setShowFinalizarConfirm] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const resSaldo = await getSaldoCocina(item.id_comedor, item.id_rubro);
                setSaldo(resSaldo);

                if (['PENDIENTE', 'DESPACHANDO', 'RECIBIDO_TOTAL'].includes(item.estatus_item)) {
                    const resLotes = await getLotesPorRubroComedor(item.id_comedor, item.id_rubro);
                    setLotes(resLotes);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [item.id_insumo, item.estatus_item, item.cantidad_despachada, item.cantidad_recibida]);

    const handleConfirm = async () => {
        const lotesArray = [];
        let volumeTotalBase = 0;

        Object.entries(seleccion).forEach(([id, cant]) => {
            const numCant = Number(cant);
            if (numCant > 0) {
                const loteInfo = lotes.find(l => l.id === Number(id));
                const factor = Number(loteInfo?.presentacion?.factor || 1);

                if (numCant > (loteInfo?.cantidad_actual || 0)) {
                    throw new Error(`Cantidad excedida en lote ${loteInfo?.lote || 'S/L'}. Disponible: ${loteInfo?.cantidad_actual}`);
                }

                lotesArray.push({
                    id_inventario: Number(id),
                    cantidad_presentacion: numCant,
                    factor: factor
                });
                volumeTotalBase += (numCant * factor);
            }
        });

        if (lotesArray.length === 0) return alert('Seleccione al menos un lote');

        setUpdating(true);
        try {
            const now = await Now();
            const res = await despacharInsumoConLotes(item.id_insumo, item.id_comedor, item.id_rubro, lotesArray, perfil.id, volumeTotalBase, now);
            
            if (res?.success) {
                toast.success(res.message || 'Despacho registrado correctamente');
                setSeleccion({});
                onUpdate();
            } else {
                toast.error(res?.message || 'Error al registrar despacho');
            }
        } catch (error) {
            console.error('Error en handleConfirm:', error);
            toast.error(error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleFinalizar = async () => {
        setUpdating(true);
        try {
            const now = await Now();
            const res = await finalizarDespachoInsumo(item.id_insumo, perfil.id, now);
            if (res?.success) {
                toast.success(res.message || 'Rubro finalizado');
                onUpdate();
            } else {
                toast.error(res?.message || 'Error al finalizar rubro');
            }
        } catch (error) {
            console.error('Error en handleFinalizar:', error);
            toast.error(error.message);
        } finally {
            setUpdating(false);
            setShowFinalizarConfirm(false);
        }
    };

    const handleAnular = async () => {
        const motivo = prompt('Motivo de anulación:');
        if (!motivo) return;
        setUpdating(true);
        try {
            const res = await anularInsumoEjecucion(item.id_insumo, motivo, perfil.id);
            if (res?.success) {
                toast.success(res.message || 'Rubro anulado');
                onUpdate();
            } else {
                toast.error(res?.message || 'Error al anular rubro');
            }
        } catch (error) {
            console.error('Error en handleAnular:', error);
            toast.error(error.message);
        } finally {
            setUpdating(false);
        }
    };

    const config = statusItemConfig[item.estatus_item] || statusItemConfig.PENDIENTE;
    const isDespachado = item.estatus_item === 'DESPACHADO_TOTAL';
    const isRecibido = item.estatus_item === 'RECIBIDO_TOTAL';
    const isAnulado = item.estatus_item === 'ANULADO';
    const isReadOnlyGlobal = estatusEjecucion !== 'PENDIENTE';

    return (
        <div className={`flex flex-col md:flex-row gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors ${isRecibido ? 'bg-emerald-100/10' : isDespachado ? 'bg-emerald-50/10' : isAnulado ? 'opacity-50 grayscale' : ''}`}>
            <div className="w-full md:w-1/4">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{item.nombre}</p>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${config.color}`}>
                        {config.label}
                    </span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">{item.categoriaNombre} | {item.unidad}</p>
                {item.cantidad_despachada > 0 && (
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                            <div>
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Despachado</p>
                                <p className="text-[10px] font-black text-blue-700">{Number(item.cantidad_despachada).toFixed(getDecimalPlaces(Number(item.cantidad_despachada)))} {item.unidad}</p>
                            </div>
                            {!isDespachado && !isAnulado && !isRecibido && !isReadOnlyGlobal && (
                                <button onClick={handleAnular} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors" title="Anular Rubro">
                                    <XCircle size={14} />
                                </button>
                            )}
                        </div>
                        <div className={`p-2 rounded-lg border ${Number(item.cantidad_recibida || 0) < Number(item.cantidad_despachada) ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                            <p className="text-[8px] font-black uppercase tracking-tighter text-slate-400">Recibido en Cocina</p>
                            <p className={`text-[10px] font-black ${Number(item.cantidad_recibida || 0) < Number(item.cantidad_despachada) ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {Number(item.cantidad_recibida || 0).toFixed(getDecimalPlaces(Number(item.cantidad_recibida || 0)))} {item.unidad}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full md:w-[15%] grid grid-cols-3 md:flex md:flex-col gap-2 border-l border-slate-100 pl-4">
                <div className="text-center md:text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Teórico</p>
                    <p className="text-xs font-black text-slate-700">{item.bruto.toFixed(getDecimalPlaces(item.bruto))}</p>
                </div>
                <div className="text-center md:text-left">
                    <p className="text-[8px] font-black text-emerald-600 uppercase">Saldo Cocina</p>
                    <p className="text-xs font-black text-emerald-700">{Number(saldo).toFixed(getDecimalPlaces(Number(saldo)))}</p>
                </div>
                <div className="text-center md:text-left">
                    <p className="text-[8px] font-black text-brand-600 uppercase">Neto Requerido</p>
                    <p className="text-xs font-black text-brand-700">{Math.max(0, item.bruto - Number(saldo)).toFixed(getDecimalPlaces(Math.max(0, item.bruto - Number(saldo))))}</p>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[120px]">
                {isRecibido && lotes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-emerald-100/20">
                        <Utensils size={24} className="text-emerald-600 mb-2" />
                        <p className="text-[10px] font-black text-emerald-900 uppercase">Insumos Recibidos en Cocina</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">No hay más existencias para despachar</p>
                    </div>
                ) : (isDespachado || isReadOnlyGlobal) ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50">
                        {estatusEjecucion === 'ANULADO' ? (
                            <>
                                <XCircle size={24} className="text-red-300 mb-2" />
                                <p className="text-[10px] font-black text-red-500 uppercase">Ejecución Anulada</p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 italic">No se permiten despachos</p>
                            </>
                        ) : (
                            <>
                                <Truck size={24} className="text-slate-400 mb-2" />
                                <p className="text-[10px] font-black text-slate-500 uppercase">
                                    {isReadOnlyGlobal ? 'Despacho Finalizado' : 'Entrega de Almacén Lista'}
                                </p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 italic">
                                    {isReadOnlyGlobal ? 'Registro de solo lectura' : 'Esperando recepción en cocina...'}
                                </p>
                            </>
                        )}
                    </div>
                ) : isAnulado ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-red-50/30">
                        <XCircle size={24} className="text-red-500 mb-2" />
                        <p className="text-[10px] font-black text-red-900 uppercase tracking-widest">Rubro Anulado</p>
                    </div>
                ) : loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4"><Loader2 size={16} className="animate-spin text-brand-900" /></div>
                ) : lotes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[9px] font-black text-red-400 uppercase italic">Sin existencias en comedor</div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-50 flex-1">
                            {lotes.map(l => {
                                 const factor = Number(l.presentacion?.factor || 1);
                                const stockEnPresentacion = Number(l.cantidad_actual) / factor;
                                const presNombre = l.presentacion?.presentacion?.nombre || 'UNIDAD';
                                const picked = Number(seleccion[l.id] || 0);
                                const isFraccionable = l.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE';

                                return (
                                    <div key={l.id} className="flex items-center justify-between p-3 group">
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-600 uppercase leading-tight">
                                                {l.producto?.marca?.nombre} - {l.producto?.variedad}
                                                <span className="ml-2 text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">
                                                    {presNombre} [{factor}{item.unidad}]
                                                </span>
                                            </p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                                Lote: <span className="font-black text-slate-700 uppercase mt-1">{l.lote || 'S/L'}</span> | Stock: <span className="text-slate-700 font-black">{Number(stockEnPresentacion).toFixed(isFraccionable ? 3 : 0)} {presNombre}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-brand-900">{(picked * factor).toFixed(getDecimalPlaces(picked * factor))} {item.unidad}</p>
                                                <p className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter">A Cocina</p>
                                            </div>
                                            <div className="relative group/input">
                                                <input
                                                    type="number"
                                                    step={isFraccionable ? "0.01" : "1"}
                                                    className={`w-16 h-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-[10px] font-black outline-none focus:ring-2 focus:ring-brand-500 transition-all ${picked > 0 ? 'bg-brand-50 border-brand-200 text-brand-900' : ''}`}
                                                    value={seleccion[l.id] || ''}
                                                    placeholder="0"
                                                    onChange={(e) => {
                                                        let val = e.target.value;
                                                        if (val === '') {
                                                            setSeleccion(p => {
                                                                const n = { ...p };
                                                                delete n[l.id];
                                                                return n;
                                                            });
                                                            return;
                                                        }

                                                        let numVal = Number(val);
                                                        if (!isFraccionable) numVal = Math.floor(numVal);

                                                        if (numVal > stockEnPresentacion) numVal = stockEnPresentacion;
                                                        if (numVal < 0) numVal = 0;

                                                        setSeleccion(p => ({ ...p, [l.id]: numVal }));
                                                    }}
                                                />
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover/input:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                    {isFraccionable ? 'Permite decimales' : 'Solo unidades enteras'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex gap-4">
                                <button
                                    onClick={handleConfirm}
                                    disabled={updating}
                                    className="px-4 py-1.5 bg-brand-900 text-white rounded-lg text-[9px] font-black uppercase shadow-lg shadow-brand-900/20 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {updating ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Registrar Entrega</>}
                                </button>
                                <button
                                    onClick={() => setShowFinalizarConfirm(true)}
                                    disabled={updating}
                                    className="px-4 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg text-[9px] font-black uppercase hover:border-red-200 hover:text-red-500 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle2 size={12} /> Finalizar Rubro
                                </button>

                                <ConfirmModal
                                    show={showFinalizarConfirm}
                                    title="Finalizar Rubro"
                                    message="¿Seguro que desea finalizar la entrega de este rubro? Ya no podrá despachar más."
                                    icon={AlertTriangle}
                                    onConfirm={handleFinalizar}
                                    onCancel={() => setShowFinalizarConfirm(false)}
                                    confirmText="Finalizar"
                                    type="warning"
                                />
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Total Despacho</p>
                                <p className="text-xs font-black text-emerald-600">
                                    {(() => {
                                        const total = Object.entries(seleccion).reduce((acc, [id, cant]) => {
                                            const f = lotes.find(l => l.id === Number(id))?.presentacion?.factor || 1;
                                            return acc + (Number(cant) * f);
                                        }, 0);
                                        return total.toFixed(getDecimalPlaces(total));
                                    })()} {item.unitLabel || item.unidad}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const DespachoComedoresModal = ({ ejecucionId, onClose, onUpdate }) => {
    const { perfil } = useModulePermissions();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [expandedAlmacenes, setExpandedAlmacenes] = useState({});
    const [ejecucionInfo, setEjecucionInfo] = useState(null); // { id_comedor, id_empresa, id_sucursal }

    // Estados para despacho manual de desechables
    const [desechables, setDesechables]           = useState([]);
    const [loadingDesechables, setLoadingDesechables] = useState(false);
    const [itemsDesechables, setItemsDesechables] = useState([]); // [{id_item, id_producto, id_rubro, item_nombre, cantidad, cantidad_actual}]
    const [tempDesechable, setTempDesechable]     = useState({ id_item: '', cantidad: '1' });
    const [guardandoDesechables, setGuardandoDesechables] = useState(false);
    const [desechablesEnviados, setDesechablesEnviados]   = useState([]);

    useEffect(() => {
        fetchData();
    }, [ejecucionId]);

    const [updatingGlobal, setUpdatingGlobal] = useState(false);
    const [estatusEjecucion, setEstatusEjecucion] = useState('PENDIENTE');
    const [showFinalizarTodoConfirm, setShowFinalizarTodoConfirm] = useState(false);

    const handleFinalizarTodo = async () => {
        setUpdatingGlobal(true);
        try {
            const now = await Now();
            await finalizarDespachoCabecera(ejecucionId, perfil.id, now);
            onClose();
        } catch (error) {
            alert(error.message);
        } finally {
            setUpdatingGlobal(false);
            setShowFinalizarTodoConfirm(false);
        }
    };

    // Helpers para la sección de desechables
    const getNombreDesechable = (item) => {
        if (!item) return '';
        const marca = item.producto?.marca?.nombre || '';
        const variedad = item.producto?.variedad || '';
        const rubro = item.producto?.rubro?.nombre || '';
        return [rubro, marca, variedad].filter(Boolean).join(' · ');
    };

    const addDesechable = () => {
        if (!tempDesechable.id_item) { toast.error('Seleccione un producto'); return; }
        const item = desechables.find(d => d.id == tempDesechable.id_item);
        if (!item) return;
        const cant = Number(tempDesechable.cantidad);
        if (!cant || cant <= 0) { toast.error('Ingrese una cantidad válida'); return; }
        if (cant > item.cantidad_actual) {
            toast.error(`Stock insuficiente. Disponible: ${item.cantidad_actual} unid.`); return;
        }
        if (itemsDesechables.some(i => i.id_item == tempDesechable.id_item)) {
            toast.error('Este producto ya está en la lista'); return;
        }
        setItemsDesechables(prev => [...prev, {
            id_item:         Number(item.id),
            id_producto:     Number(item.producto.id),
            id_rubro:        Number(item.producto.rubro.id),
            item_nombre:     getNombreDesechable(item),
            cantidad:        cant,
            cantidad_actual: item.cantidad_actual
        }]);
        setTempDesechable({ id_item: '', cantidad: '1' });
    };

    const handleConfirmarDesechables = async () => {
        if (itemsDesechables.length === 0) { toast.error('Agregue al menos un desechable'); return; }
        if (!ejecucionInfo) return;
        setGuardandoDesechables(true);
        try {
            const detalles = itemsDesechables.map(i => ({
                id_item_inventario_comedor: i.id_item,
                id_producto:               i.id_producto,
                id_rubro:                  i.id_rubro,
                cantidad:                  i.cantidad
            }));
            const res = await despacharDesechablesManual(
                ejecucionInfo.id_empresa,
                ejecucionInfo.id_sucursal,
                ejecucionInfo.id_comedor,
                ejecucionId,
                null,
                detalles,
                perfil.id
            );
            if (res?.success) {
                toast.success(`Despacho manual registrado — ${res.correlativo}`);
                setItemsDesechables([]);
                setTempDesechable({ id_item: '', cantidad: '1' });
                // Recargar desechables para reflejar el nuevo stock
                const refreshed = await getDesechablesParaDespachoManual(
                    ejecucionInfo.id_empresa, ejecucionInfo.id_sucursal, ejecucionInfo.id_comedor
                );
                setDesechables(refreshed);
                // Recargar desechables enviados
                const enviados = await getDesechablesDespachados(ejecucionId);
                setDesechablesEnviados(enviados);
                if (onUpdate) onUpdate();
            } else {
                toast.error(res?.message || 'Error al registrar despacho manual');
            }
        } catch (e) {
            toast.error('Error: ' + e.message);
        } finally {
            setGuardandoDesechables(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Obtener el id_comedor y estatus de la ejecución primero para asegurar las consultas de saldo
            // Dado que comedor_ejecucion_diaria no tiene id_sucursal, lo obtenemos a través del join con la tabla comedores
            const { data: ejecInfo, error: ejecError } = await supabase
                .from('comedor_ejecucion_diaria')
                .select('id_comedor, id_empresa, estatus, comedores(id_sucursal)')
                .eq('id', ejecucionId)
                .single();

            if (ejecError) throw ejecError;
            const comedorId = ejecInfo.id_comedor;
            const idSucursal = ejecInfo.comedores?.id_sucursal;
            const estatus = ejecInfo.estatus;

            const infoAplanada = {
                id_comedor: comedorId,
                id_empresa: ejecInfo.id_empresa,
                id_sucursal: idSucursal,
                estatus: estatus
            };

            setEstatusEjecucion(estatus);
            setEjecucionInfo(infoAplanada); // guardamos para usarlos en el despacho manual

            // Cargar desechables disponibles en el inventario del comedor
            if (ejecInfo.id_empresa && idSucursal && comedorId) {
                setLoadingDesechables(true);
                getDesechablesParaDespachoManual(ejecInfo.id_empresa, idSucursal, comedorId)
                    .then(setDesechables)
                    .catch(() => toast.error('Error al cargar desechables'))
                    .finally(() => setLoadingDesechables(false));
            }

            // Cargar desechables despachados previamente en la ejecución activa
            getDesechablesDespachados(ejecucionId)
                .then(setDesechablesEnviados)
                .catch((err) => console.error('Error al cargar desechables despachados:', err));

            const insumos = await getEjecucionInsumosConsolidado(ejecucionId);
            const grouping = {};

            insumos.forEach(row => {
                const rubro = row.rubro;
                const almacen = rubro?.categoria?.almacenes?.nombre || 'ALMACÉN NO DEFINIDO';
                const idAlmacen = rubro?.categoria?.id_almacen;
                const rubroId = rubro?.id;

                if (!grouping[almacen]) grouping[almacen] = { items: {}, id_almacen: idAlmacen };

                if (!grouping[almacen].items[rubroId]) {
                    const mermaPct = (rubro?.mermas || []).reduce((acc, m) => acc + Number(m.valor), 0);
                    const neto = Number(row.cantidad_requerida || 0);
                    const bruto = neto / (1 - (mermaPct / 100));

                    grouping[almacen].items[rubroId] = {
                        id_insumo: row.id,
                        id_rubro: rubroId,
                        id_comedor: comedorId, // Usamos el ID centralizado
                        nombre: rubro?.nombre || 'Desconocido',
                        unidad: rubro?.unidad?.abreviatura || 'un',
                        tipo_fraccionamiento: rubro?.tipo_fraccionamiento || 'NUNCA',
                        neto: neto,
                        merma_pct: mermaPct,
                        bruto: bruto,
                        categoriaNombre: rubro?.categoria?.nombre || 'OTRO',
                        cantidad_despachada: Number(row.cantidad_despachada || 0),
                        cantidad_recibida: Number(row.cantidad_recibida || 0),
                        estatus_item: row.estatus_item || 'PENDIENTE'
                    };
                } else {
                    grouping[almacen].items[rubroId].neto += Number(row.cantidad_requerida || 0);
                    grouping[almacen].items[rubroId].cantidad_despachada += Number(row.cantidad_despachada || 0);
                    grouping[almacen].items[rubroId].cantidad_recibida += Number(row.cantidad_recibida || 0);
                    const mermaPct = grouping[almacen].items[rubroId].merma_pct;
                    grouping[almacen].items[rubroId].bruto = grouping[almacen].items[rubroId].neto / (1 - (mermaPct / 100));
                }
            });

            const finalStructure = Object.entries(grouping).map(([almacen, info]) => ({
                almacen,
                id_almacen: info.id_almacen,
                items: Object.values(info.items)
            })).sort((a, b) => a.almacen.localeCompare(b.almacen));

            setData(finalStructure);
            if (finalStructure.length > 0) setExpandedAlmacenes({ [finalStructure[0].almacen]: true });
        } catch (error) {
            console.error('Error al cargar insumos:', error);
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 text-white rounded-2xl shadow-xl shadow-brand-900/20">
                            <Truck size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tighter">Matriz de Despacho Comedor</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Picking de inventario real</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={22} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-4 space-y-4">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100">
                            <Loader2 className="w-8 h-8 text-brand-900 animate-spin mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Matriz...</p>
                        </div>
                    ) : data.map((grupo, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                                <Warehouse size={16} className="text-brand-900" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">{grupo.almacen}</span>
                            </div>

                            <div className="flex flex-col">
                                {grupo.items.map((item, iIdx) => (
                                    <RubroRow
                                        key={iIdx}
                                        item={item}
                                        idAlmacen={grupo.id_almacen}
                                        perfil={perfil}
                                        onUpdate={fetchData}
                                        ejecucionId={ejecucionId}
                                        estatusEjecucion={estatusEjecucion}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* ══ SECCIÓN DESPACHO MANUAL — DESECHABLES ══ */}
                    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-amber-50/40 border-b border-amber-100 flex items-center gap-3">
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl"><Package size={14} /></div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-800">Despacho Manual — Consumibles / Desechables</span>
                                <p className="text-[8px] text-amber-500 font-bold uppercase tracking-widest italic mt-0.5">Envases, vasos, papel aluminio, servilletas — alimentan saldo de cocina por producto específico</p>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">

                            {/* Tabla de ítems agregados */}
                            {itemsDesechables.length > 0 && (
                                <div className="border border-amber-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-amber-50/60 text-[9px] font-black uppercase text-amber-700 border-b border-amber-100">
                                                <th className="px-4 py-2">Producto</th>
                                                <th className="px-4 py-2 text-center">Disponible</th>
                                                <th className="px-4 py-2 text-center">A Despachar</th>
                                                <th className="px-4 py-2 text-right">Quitar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-50">
                                            {itemsDesechables.map((item, i) => (
                                                <tr key={i} className="hover:bg-amber-50/30">
                                                    <td className="px-4 py-2 font-bold text-slate-700 uppercase">{item.item_nombre}</td>
                                                    <td className="px-4 py-2 text-center text-slate-400 font-black text-[10px]">{item.cantidad_actual}</td>
                                                    <td className="px-4 py-2 text-center font-black text-amber-700">{item.cantidad}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button
                                                            onClick={() => setItemsDesechables(p => p.filter((_, idx) => idx !== i))}
                                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="px-4 py-3 bg-amber-50/30 border-t border-amber-100 flex items-center justify-end">
                                        <button
                                            onClick={handleConfirmarDesechables}
                                            disabled={guardandoDesechables || estatusEjecucion !== 'PENDIENTE'}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-amber-900/20 hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {guardandoDesechables ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                                            Confirmar Despacho Manual
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Fila de adición */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex flex-col gap-1 md:col-span-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Producto Desechable</label>
                                    <select
                                        value={tempDesechable.id_item}
                                        onChange={e => setTempDesechable(p => ({ ...p, id_item: e.target.value }))}
                                        className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-amber-400"
                                        disabled={loadingDesechables || estatusEjecucion !== 'PENDIENTE'}
                                    >
                                        <option value="">-- SELECCIONE DESECHABLE --</option>
                                        {desechables
                                            .filter(d => !itemsDesechables.some(i => i.id_item == d.id))
                                            .map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {getNombreDesechable(d)} [{d.cantidad_actual} disp.]
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad</label>
                                    <input
                                        type="number" min="1" step="1"
                                        value={tempDesechable.cantidad}
                                        onChange={e => setTempDesechable(p => ({ ...p, cantidad: e.target.value }))}
                                        className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-amber-400"
                                        disabled={estatusEjecucion !== 'PENDIENTE'}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={addDesechable}
                                    disabled={estatusEjecucion !== 'PENDIENTE'}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-xs font-black uppercase hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-40"
                                >
                                    <Plus size={14} /> Añadir
                                </button>
                            </div>

                            

                            {itemsDesechables.length === 0 && !loadingDesechables && (
                                <div className="flex flex-col items-center justify-center py-6 text-center opacity-40">
                                    <Package size={28} className="text-amber-400 mb-2" />
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sin desechables agregados</p>
                                    <p className="text-[8px] text-slate-400 font-bold italic mt-1">Seleccione producto y cantidad arriba</p>
                                </div>
                            )}

                            {/* Listado de desechables ya despachados */}
                            {desechablesEnviados.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.05em] text-slate-500 mb-3 flex items-center gap-2">
                                        <Truck size={12} className="text-amber-500" />
                                        Historial de Desechables Despachados
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {desechablesEnviados.map((item, idx) => {
                                            const mappedStatusKey = item.estatus === 'RECIBIDO' ? 'RECIBIDO_TOTAL' : item.estatus;
                                            const statusCfg = statusItemConfig[mappedStatusKey] || statusItemConfig.PENDIENTE;

                                            return (
                                                <div key={idx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="text-[10px] font-black text-slate-700 truncate uppercase tracking-tight">{item.nombre}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 shrink-0 ${statusCfg.color}`}>
                                                                {statusCfg.icon}
                                                                {statusCfg.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-[9px] text-slate-400 font-bold uppercase mt-1">
                                                            <span>Ref: #{item.id_despacho}</span>
                                                            <span>{new Date(item.timestamp_despacho).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="text-right">
                                                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter block">Despachado</span>
                                                            <span className="text-[10px] font-black text-blue-700">{item.cantidad_entregada} {item.unidad.toUpperCase()}</span>
                                                        </div>
                                                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                                        <div className="text-right">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block">Recibido</span>
                                                            <span className={`text-[10px] font-black ${Number(item.cantidad_recibida || 0) < Number(item.cantidad_entregada) ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                                {Number(item.cantidad_recibida || 0)} {item.unidad.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Info size={16} />
                        <p className="text-[9px] font-bold italic uppercase tracking-widest">Picking directo por marcas y lotes disponibles en comedor</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-10 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                            Cerrar
                        </button>
                        {estatusEjecucion === 'PENDIENTE' && (
                            <button
                                onClick={() => setShowFinalizarTodoConfirm(true)}
                                disabled={updatingGlobal}
                                className="px-10 py-3 bg-brand-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95 flex items-center gap-2"
                            >
                                {updatingGlobal ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                                Finalizar Todo el Despacho
                            </button>
                        )}
                    </div>
                </div>

                <ConfirmModal
                    show={showFinalizarTodoConfirm}
                    title="Finalizar Despacho"
                    message="¿Está seguro de finalizar todo el proceso de despacho? Esta acción marcará la ejecución como PROCESADA."
                    icon={AlertTriangle}
                    onConfirm={handleFinalizarTodo}
                    onCancel={() => setShowFinalizarTodoConfirm(false)}
                    confirmText="Finalizar Todo"
                    type="danger"
                />
            </div>
        </div>,
        document.body
    );
};

export default DespachoComedoresModal;
