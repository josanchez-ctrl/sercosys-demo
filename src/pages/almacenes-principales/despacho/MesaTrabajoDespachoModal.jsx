import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Truck, User, CreditCard, Car, Lock, Package, CheckCircle2, ChevronRight, AlertCircle, Building2, MapPin, Box, Loader2, ShoppingBasket, Plus, Minus } from 'lucide-react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { generarDespacho } from '../../../services/despachoService';
import { getTarasCestas } from '../../../services/despoteService';
import { getLetrasDni, getTiposVehiculo } from '../../../services/transporteService';
import { formato8Digitos } from '../../../util/workDate';
import { Now } from '../../../services/nowService';

const validationSchema = Yup.object().shape({
    chofer: Yup.string().nullable().default(''),
    dni: Yup.string().nullable().default(''),
    letradni: Yup.string().nullable().default(''),
    vehiculo: Yup.string().nullable().default(''),
    placa: Yup.string().nullable().default(''),
    precinto: Yup.string().nullable().default('')
});

export default function MesaTrabajoDespachoModal({ show, onClose, pickingIds, pickingsFullData, onSuccess }) {
    const { perfil, empresaActiva } = useModulePermissions();
    const [activeDestinoId, setActiveDestinoId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [letrasDni, setLetrasDni] = useState([]);
    const [tiposVehiculo, setTiposVehiculo] = useState([]);
    const [catalogoCestas, setCatalogoCestas] = useState([]);
    // Mapa de cestas por destino: { [destinoKey]: [{id_tara, descripcion, cantidad}] }
    const [cestasPorDestino, setCestasPorDestino] = useState({});

    useEffect(() => {
        const cargarCatalogos = async () => {
            const [letras, tipos, taras] = await Promise.all([
                getLetrasDni(),
                getTiposVehiculo(),
                getTarasCestas()
            ]);
            setLetrasDni(letras);
            setTiposVehiculo(tipos);
            setCatalogoCestas(taras || []);
        };
        cargarCatalogos();
    }, []);

    // Agrupar pickings por combinación Sucursal-Comedor (Patrón Logístico)
    const destinosAgrupados = useMemo(() => {
        const grupos = {};
        pickingsFullData.forEach(p => {
            const key = `${p.id_sucursal}_${p.id_comedor}`;
            if (!grupos[key]) {
                grupos[key] = {
                    id_sucursal: p.id_sucursal,
                    id_comedor: p.id_comedor,
                    id_almacen: p.id_almacen,
                    nombre_sucursal: p.sucursal?.nombre,
                    nombre_comedor: p.comedor?.nombre,
                    pickings: []
                };
            }
            grupos[key].pickings.push(p);
        });

        const keys = Object.keys(grupos);
        if (keys.length > 0 && !activeDestinoId) {
            setActiveDestinoId(keys[0]);
        }
        return grupos;
    }, [pickingsFullData]);

    const destinoActivo = destinosAgrupados[activeDestinoId];

    const handleSubmit = async (values) => {
        if (!destinoActivo) return;
        setProcessing(true);
        try {
            const nowStr = await Now();

            // Preparamos los ítems del destino activo (Solo lo recolectado físicamente)
            const items = destinoActivo.pickings.flatMap(p =>
                p.almacen_picking_detalle
                    .filter(d => Number(d.cantidad_recolectada || 0) > 0)
                    .map(d => ({
                        id_picking_detalle: d.id,
                        cantidad_enviada: Number(d.cantidad_recolectada),
                        // Propagamos empaques físicos para productos de peso variable
                        cantidad_presentacion: d.cantidad_presentacion ?? null
                    }))
            );

            const cestasDest = cestasPorDestino[activeDestinoId] || [];

            const payload = {
                id_empresa: empresaActiva.id,
                id_sucursal: destinoActivo.id_sucursal,
                id_comedor: destinoActivo.id_comedor,
                id_almacen_origen: destinoActivo.id_almacen,
                transporte: {
                    ...values,
                    letradni: values.letradni ? Number(values.letradni) : null,
                    vehiculo: values.vehiculo ? Number(values.vehiculo) : null
                },
                items,
                cestas: cestasDest.filter(c => Number(c.cantidad) > 0)
            };

            const result = await generarDespacho(payload, perfil?.id, nowStr);
            if (result.success) {
                // Si hay más destinos, pasamos al siguiente. Si no, cerramos.
                const remainingKeys = Object.keys(destinosAgrupados).filter(k => k !== activeDestinoId);
                if (remainingKeys.length > 0) {
                    setActiveDestinoId(remainingKeys[0]);
                    alert("Despacho generado con éxito. Pasando al siguiente destino.");
                } else {
                    onSuccess();
                }
            } else {
                alert("Error al generar despacho: " + result.error);
            }
        } catch (error) {
            console.error("Error en despacho:", error);
            alert("Error crítico al procesar despacho");
        } finally {
            setProcessing(false);
        }
    };

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-50 rounded-[2.5rem] shadow-2xl w-full h-full max-w-[95vw] max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500 border border-white/20">

                {/* HEADER */}
                <div className="bg-white px-8 py-6 border-b border-gray-100 flex items-center justify-between z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 rounded-md text-white shadow-lg shadow-brand-900/20">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Mesa de Trabajo de Despacho</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">
                                Consolidando {pickingIds.length} Pickings para Salida
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 flex overflow-hidden">
                    {/* SIDEBAR: DESTINOS */}
                    <div className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0">
                        <div className="p-6 border-b border-gray-50 bg-slate-50/50">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Rutas Consolidadas</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {Object.entries(destinosAgrupados).map(([key, dest]) => {
                                const isActive = activeDestinoId === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveDestinoId(key)}
                                        className={`w-full text-left p-5 rounded-3xl transition-all border-2 flex items-center justify-between group relative overflow-hidden ${isActive
                                            ? 'border-brand-500 bg-brand-50/30 shadow-md ring-4 ring-brand-500/5'
                                            : 'border-gray-50 hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1 relative z-10">
                                            <span className={`text-xs font-black uppercase tracking-tight ${isActive ? 'text-brand-900' : 'text-slate-700'}`}>
                                                {dest.nombre_sucursal}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
                                                {dest.nombre_comedor}
                                            </span>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="px-2 py-0.5 bg-white rounded-lg text-[9px] font-black text-slate-500 border border-slate-100 shadow-sm leading-none">
                                                    {dest.pickings.length} Pickings
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className={`${isActive ? 'text-brand-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* MAIN: DETALLE Y FORMIK */}
                    <div className="flex-1 flex flex-col overflow-auto px-4 py-1 space-y-2">
                        {destinoActivo ? (
                            <>
                                {/* LISTA DE RUBROS A DESPACHAR */}
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 flex flex-col h-full">
                                    <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Box size={16} className="text-brand-600" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Items en este Despacho</h4>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-left">
                                            <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Rubro / Picking</th>
                                                    <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Lote</th>
                                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Cant. Unidades</th>
                                                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Cant. Volumétrica</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-300">
                                                {destinoActivo.pickings.flatMap(p => p.almacen_picking_detalle.map(d => (
                                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-8 py-1">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-slate-700 uppercase leading-none mb-1">
                                                                    {d.producto?.rubro?.nombre} {d.producto?.marca?.nombre} {d.producto?.variedad}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase italic">
                                                                    PK #{formato8Digitos(p.id)} | {(() => {
                                                                        const basePres = d.producto?.presentaciones?.find(bp => bp.es_base);
                                                                        const baseFactor = basePres?.factor || 1;
                                                                        const baseNombre = basePres?.presentacion?.nombre || 'UND';
                                                                        const ratio = d.factor / baseFactor;

                                                                        const presNombre = d.presentacion_logistica?.presentacion?.nombre || 'UND';
                                                                        const ratioStr = ratio > 1 ? `${ratio % 1 === 0 ? ratio : ratio.toFixed(1)} ${baseNombre}` : '';

                                                                        return `${presNombre} ${ratioStr} | ${d.factor}${d.producto?.rubro?.unidad?.abreviatura}`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-1 text-center">
                                                            {d.lote != null && (
                                                                <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                                    {d.lote}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-1 text-right">
                                                            <div className="flex flex-col items-end gap-1">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-sm font-black tabular-nums ${Number(d.cantidad_recolectada || 0) < Number(d.cantidad) ? 'text-amber-600' : 'text-brand-900'}`}>
                                                                        {parseFloat(Number(d.cantidad_recolectada || 0).toFixed(3))}
                                                                    </span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">UND</span>
                                                                </div>
                                                                {Number(d.cantidad_recolectada || 0) < Number(d.cantidad) && (
                                                                    <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 rounded uppercase leading-none">
                                                                        Faltan {parseFloat((d.cantidad - (d.cantidad_recolectada || 0)).toFixed(3))}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-1 text-right">
                                                            <div className="flex justify-end items-center gap-1">
                                                                <span className="text-sm font-black text-slate-400 tabular-nums">
                                                                    {parseFloat((d.cantidad_recolectada * d.factor).toFixed(3))}
                                                                </span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase">{d.producto?.rubro?.unidad?.abreviatura}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* CESTAS RETORNABLES */}
                                {catalogoCestas.length > 0 && (
                                    <div className="bg-white rounded-md shadow-sm border border-blue-100 flex flex-col shrink-0">
                                        <div className="px-8 py-4 border-b border-blue-50 flex items-center gap-3 bg-blue-50/30">
                                            <ShoppingBasket size={16} className="text-blue-600" />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-800">Cestas / Envases Retornables</h4>
                                            <span className="text-[9px] font-bold text-blue-400 italic ml-2">El vehículo debe retornarlas al regresar</span>
                                        </div>
                                        <div className="px-8 py-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                {catalogoCestas.map(tara => {
                                                    const cestasActuales = cestasPorDestino[activeDestinoId] || [];
                                                    const item = cestasActuales.find(c => c.id_tara === tara.id);
                                                    const cantidad = item?.cantidad || 0;
                                                    const setQty = (val) => {
                                                        const qty = Math.max(0, parseInt(val) || 0);
                                                        setCestasPorDestino(prev => {
                                                            const old = prev[activeDestinoId] || [];
                                                            const filtered = old.filter(c => c.id_tara !== tara.id);
                                                            if (qty > 0) {
                                                                filtered.push({ id_tara: tara.id, descripcion: tara.descripcion, cantidad: qty });
                                                            }
                                                            return { ...prev, [activeDestinoId]: filtered };
                                                        });
                                                    };
                                                    return (
                                                        <div key={tara.id} className="flex items-center justify-between p-3 bg-blue-50/40 rounded-xl border border-blue-100">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-blue-900 uppercase leading-none">{tara.descripcion}</span>
                                                                {tara.tipotara?.nombre && <span className="text-[8px] font-bold text-blue-400 italic mt-0.5">{tara.tipotara.nombre}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button type="button" onClick={() => setQty(cantidad - 1)} className="w-7 h-7 bg-white border border-blue-200 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                                                                    <Minus size={12} />
                                                                </button>
                                                                <span className={`text-base font-black tabular-nums w-8 text-center ${cantidad > 0 ? 'text-blue-900' : 'text-slate-300'}`}>{cantidad}</span>
                                                                <button type="button" onClick={() => setQty(cantidad + 1)} className="w-7 h-7 bg-blue-600 border border-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-700 transition-all active:scale-95">
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* FORMULARIO DE TRANSPORTE */}
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 flex flex-col p-8 space-y-2">
                                    <div className="flex items-center gap-3 border-b border-gray-50 pb-6">
                                        <div className="p-3 bg-brand-50 text-brand-600 rounded-md">
                                            <Car size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Datos del Transporte</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información obligatoria para la guía</p>
                                        </div>
                                    </div>

                                    <Formik
                                        initialValues={{ chofer: '', dni: '', letradni: '', vehiculo: '', placa: '', precinto: '' }}
                                        validationSchema={validationSchema}
                                        onSubmit={handleSubmit}
                                    >
                                        {({ errors, touched }) => (
                                            <Form id="dispatch-form" className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Chofer */}
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                            <User size={12} className="text-brand-600" /> Nombre del Chofer
                                                        </label>
                                                        <Field
                                                            name="chofer"
                                                            className={`w-full bg-slate-50 border-2 ${errors.chofer && touched.chofer ? 'border-red-100 bg-red-50' : 'border-transparent'} rounded-md px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-inner`}
                                                            placeholder="EJ: JUAN PEREZ"
                                                        />
                                                    </div>

                                                    {/* DNI */}
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                            <CreditCard size={12} className="text-brand-600" /> Cédula / DNI
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <Field as="select" name="letradni" className="w-20 bg-slate-50 border-none rounded-md px-3 py-3.5 text-sm font-black text-brand-900 outline-none shadow-inner">
                                                                <option value="">-</option>
                                                                {letrasDni.map(l => (
                                                                    <option key={l.id} value={l.id}>{l.nombre}</option>
                                                                ))}
                                                            </Field>
                                                            <Field
                                                                name="dni"
                                                                className={`flex-1 bg-slate-50 border-2 ${errors.dni && touched.dni ? 'border-red-100 bg-red-50' : 'border-transparent'} rounded-md px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-inner`}
                                                                placeholder="NRO CEDULA"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Vehículo */}
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                            <Car size={12} className="text-brand-600" /> Tipo de Vehículo
                                                        </label>
                                                        <Field as="select" name="vehiculo" className={`w-full bg-slate-50 border-2 ${errors.vehiculo && touched.vehiculo ? 'border-red-100 bg-red-50' : 'border-transparent'} rounded-md px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-inner`}>
                                                            <option value="">SELECCIONE...</option>
                                                            {tiposVehiculo.map(t => (
                                                                <option key={t.id} value={t.id}>{t.nombre}</option>
                                                            ))}
                                                        </Field>
                                                    </div>

                                                    {/* Placa */}
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                            <Package size={12} className="text-brand-600" /> Placa / Matrícula
                                                        </label>
                                                        <Field
                                                            name="placa"
                                                            className={`w-full bg-slate-50 border-2 ${errors.placa && touched.placa ? 'border-red-100 bg-red-50' : 'border-transparent'} rounded-md px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-inner`}
                                                            placeholder="ABC-123"
                                                        />
                                                    </div>

                                                    {/* Precinto (Opcional) */}
                                                    <div className="md:col-span-2 space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                            <Lock size={12} className="text-brand-600" /> Precinto de Seguridad (Opcional)
                                                        </label>
                                                        <Field
                                                            name="precinto"
                                                            className="w-full bg-slate-50 border-transparent rounded-md px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-inner"
                                                            placeholder="NRO DE PRECINTO"
                                                        />
                                                    </div>
                                                </div>
                                            </Form>
                                        )}
                                    </Formik>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-6">
                                <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300">
                                    <MapPin size={48} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-slate-400 uppercase">Seleccione una Ruta</p>
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">A la izquierda tienes los destinos pendientes</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="px-8 py-5 bg-white border-t border-gray-100 flex items-center justify-end gap-3 z-10 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-md text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="dispatch-form"
                        disabled={processing || !destinoActivo}
                        className="bg-brand-900 text-white px-10 py-3.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-900/20 hover:bg-brand-800 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                    >
                        {processing ? (
                            <><Loader2 size={16} className="animate-spin" /> Procesando Salida...</>
                        ) : (
                            <><CheckCircle2 size={16} /> Confirmar y Despachar Camión</>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
