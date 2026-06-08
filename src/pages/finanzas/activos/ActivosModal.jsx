import { Formik, Form, Field } from 'formik';
import { createPortal } from 'react-dom';
import * as Yup from 'yup';
import { Landmark, RefreshCw, Edit2, Plus, Info, History, ArrowRight, User, Calendar, FileText, XCircle, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getHistorialActivo } from '../../../services/activoService';

/*
  MODAL: Activos Individuales con Línea de Tiempo de Historial
  ESTÁNDAR: Formik + Yup + Sercosys Core
*/

const ActivoSchema = Yup.object().shape({
    id_categoria: Yup.string().required('Seleccione categoría'),
    id_rubro: Yup.string().required('Seleccione rubro'),
    id_producto: Yup.string().required('Seleccione producto'),
    serial: Yup.string().nullable(),
    peso: Yup.number().min(0, 'No puede ser negativo'),
    condicion: Yup.string().required(),
    estatus_operativo: Yup.string().required(),
    id_sucursal_actual: Yup.string().nullable().when('condicion', {
        is: 'ASIGNADO',
        then: (schema) => schema.required('Seleccione ubicación/sucursal'),
        otherwise: (schema) => schema.nullable()
    }),
    id_departamento_actual: Yup.string().nullable().when('condicion', {
        is: 'ASIGNADO',
        then: (schema) => schema.required('Seleccione departamento'),
        otherwise: (schema) => schema.nullable()
    })
});

export default function ActivosModal({ selectedItem, categorias, rubros, productos, departamentos, sucursales, onSave, onCancel, saving }) {
    const [activeTab, setActiveTab] = useState('DATOS'); // DATOS o HISTORIAL
    const [historial, setHistorial] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    useEffect(() => {
        if (selectedItem?.id && activeTab === 'HISTORIAL') {
            fetchHistorial();
        }
    }, [selectedItem, activeTab]);

    const fetchHistorial = async () => {
        setLoadingHistorial(true);
        try {
            const data = await getHistorialActivo(selectedItem.id);
            setHistorial(data || []);
        } catch (error) {
            console.error('Error al cargar historial:', error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    const initialValues = {
        id_categoria: selectedItem?.producto?.rubro?.id_categoria || '',
        id_rubro: selectedItem?.producto?.id_rubro || '',
        id_producto: selectedItem?.id_producto || '',
        serial: selectedItem?.serial || '',
        peso: selectedItem?.peso || 0,
        id_sucursal_actual: selectedItem?.id_sucursal_actual || '',
        id_departamento_actual: selectedItem?.id_departamento_actual || '',
        condicion: selectedItem?.condicion || 'RESGUARDO',
        estatus_operativo: selectedItem?.estatus_operativo || 'ACTIVO',
        observaciones: selectedItem?.observaciones || ''
    };

    const getTipoMovimientoConfig = (tipo) => {
        const configs = {
            ASIGNACION_INICIAL: { label: 'Asignación Inicial', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Plus size={12} /> },
            TRASLADO: { label: 'Traslado de Ubicación', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <ArrowRight size={12} /> },
            MANTENIMIENTO: { label: 'Envío a Mantenimiento', color: 'bg-red-50 text-red-700 border-red-200', icon: <RefreshCw size={12} /> },
            REASIGNACION: { label: 'Reasignación Operativa', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Landmark size={12} /> },
            BAJA: { label: 'Desincorporación (Baja)', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: <XCircle size={12} /> },
            REACTIVACION: { label: 'Reactivación de Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Check size={12} /> },
            ACTUALIZACION_DATOS: { label: 'Actualización Ficha', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: <FileText size={12} /> }
        };
        return configs[tipo] || { label: tipo, color: 'bg-gray-50 text-gray-700 border-gray-200', icon: <Info size={12} /> };
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
            <div className="relative bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                <Formik
                    initialValues={initialValues}
                    validationSchema={ActivoSchema}
                    enableReinitialize={true}
                    onSubmit={onSave}
                >
                    {({ errors, touched, values, setFieldValue }) => (
                        <Form className="flex flex-col h-full overflow-hidden">
                            {/* Cabecera */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-900 text-white rounded-md">
                                        {selectedItem ? <Edit2 size={20} /> : <Plus size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                            {selectedItem ? 'Editar Activo' : 'Nuevo Activo'}
                                        </h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">Registro en Inventario</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de Pestañas (Solo si se está editando) */}
                            {selectedItem && (
                                <div className="flex border-b border-gray-100 bg-white shrink-0 px-6">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('DATOS')}
                                        className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all ${
                                            activeTab === 'DATOS'
                                                ? 'border-brand-900 text-brand-900'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <Info size={14} />
                                        Datos Generales
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('HISTORIAL')}
                                        className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all ${
                                            activeTab === 'HISTORIAL'
                                                ? 'border-brand-900 text-brand-900'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <History size={14} />
                                        Historial de Movimientos
                                    </button>
                                </div>
                            )}

                            {/* Cuerpo */}
                            <div className="flex-1 overflow-y-auto bg-gray-50/30 px-8 py-4">
                                {activeTab === 'DATOS' ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                                                <Field as="select" name="id_categoria" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_categoria && touched.id_categoria ? 'border-red-300' : 'border-slate-100'}`}>
                                                    <option value="">SELECCIONE...</option>
                                                    {categorias?.map(c => (
                                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                                    ))}
                                                </Field>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rubro</label>
                                                <Field as="select" name="id_rubro" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_rubro && touched.id_rubro ? 'border-red-300' : 'border-slate-100'}`}>
                                                    <option value="">SELECCIONE...</option>
                                                    {rubros?.filter(r => r.id_categoria.toString() === values.id_categoria?.toString()).map(r => (
                                                        <option key={r.id} value={r.id}>{r.nombre}</option>
                                                    ))}
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Producto</label>
                                                <Field as="select" name="id_producto" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_producto && touched.id_producto ? 'border-red-300' : 'border-slate-100'}`}>
                                                    <option value="">SELECCIONE...</option>
                                                    {productos?.filter(p => p.id_rubro.toString() === values.id_rubro?.toString()).map(p => (
                                                        <option key={p.id} value={p.id}>{p.marca?.nombre || ''} {p.variedad || ''}</option>
                                                    ))}
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número Serial</label>
                                                <Field name="serial" placeholder="EJ. S/N 123456" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peso (KG) - Opcional</label>
                                                <Field type="number" step="0.1" name="peso" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condición</label>
                                                <Field as="select" name="condicion" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all">
                                                    <option value="RESGUARDO">RESGUARDO</option>
                                                    <option value="ASIGNADO">ASIGNADO</option>
                                                </Field>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estatus Operativo</label>
                                                <Field as="select" name="estatus_operativo" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all">
                                                    <option value="ACTIVO">ACTIVO</option>
                                                    <option value="INACTIVO">INACTIVO</option>
                                                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                                                    <option value="BAJA">BAJA</option>
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    Sucursal Asignada {values.condicion === 'ASIGNADO' && <span className="text-red-500">*</span>}
                                                </label>
                                                <Field as="select" name="id_sucursal_actual" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_sucursal_actual && touched.id_sucursal_actual ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100'}`}>
                                                    <option value="">SELECCIONE...</option>
                                                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                                </Field>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    Departamento {values.condicion === 'ASIGNADO' && <span className="text-red-500">*</span>}
                                                </label>
                                                <Field as="select" name="id_departamento_actual" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_departamento_actual && touched.id_departamento_actual ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100'}`}>
                                                    <option value="">SELECCIONE...</option>
                                                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Justificación</label>
                                                <Field as="textarea" name="observaciones" placeholder="Escriba aquí observaciones del activo o motivo del cambio de estado..." className="w-full h-20 px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all resize-none" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {loadingHistorial ? (
                                            <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                                <RefreshCw className="animate-spin text-brand-900" size={24} />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando Historial...</span>
                                            </div>
                                        ) : historial.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 space-y-2 opacity-60">
                                                <History size={40} className="text-slate-300" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin movimientos registrados</span>
                                            </div>
                                        ) : (
                                            <div className="relative border-l-2 border-slate-200 ml-4 py-2 space-y-6">
                                                {historial.map((h) => {
                                                    const conf = getTipoMovimientoConfig(h.tipo_movimiento);
                                                    return (
                                                        <div key={h.id} className="relative pl-6 animate-in fade-in duration-300">
                                                            {/* Icono del Timeline */}
                                                            <div className={`absolute -left-[13px] top-1 p-1 rounded-full border shadow-sm ${conf.color}`}>
                                                                {conf.icon}
                                                            </div>
                                                            
                                                            {/* Ficha del Historial */}
                                                            <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${conf.color}`}>
                                                                        {conf.label}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                                        <Calendar size={10} />
                                                                        {new Date(h.timestamp_create).toLocaleString()}
                                                                    </span>
                                                                </div>

                                                                {/* Cambios */}
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] border-t border-slate-50 pt-2">
                                                                    {(h.sucursal_origen || h.sucursal_destino) && (
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ubicación</span>
                                                                            <div className="flex items-center gap-1 font-bold text-slate-700">
                                                                                <span className="truncate max-w-[100px]">{h.sucursal_origen?.nombre || 'S/O'}</span>
                                                                                <ArrowRight size={10} className="text-slate-400" />
                                                                                <span className="text-brand-900 truncate max-w-[100px]">{h.sucursal_destino?.nombre || 'S/D'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(h.departamento_origen || h.departamento_destino) && (
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Área / Depto</span>
                                                                            <div className="flex items-center gap-1 font-bold text-slate-700">
                                                                                <span className="truncate max-w-[100px]">{h.departamento_origen?.nombre || 'S/D'}</span>
                                                                                <ArrowRight size={10} className="text-slate-400" />
                                                                                <span className="text-brand-900 truncate max-w-[100px]">{h.departamento_destino?.nombre || 'S/D'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(h.estatus_operativo_origen || h.estatus_operativo_destino) && (
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estatus</span>
                                                                            <div className="flex items-center gap-1 font-bold text-slate-700">
                                                                                <span>{h.estatus_operativo_origen || 'S/E'}</span>
                                                                                <ArrowRight size={10} className="text-slate-400" />
                                                                                <span className="text-brand-900">{h.estatus_operativo_destino || 'S/E'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(h.condicion_origen || h.condicion_destino) && (
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Condición</span>
                                                                            <div className="flex items-center gap-1 font-bold text-slate-700">
                                                                                <span>{h.condicion_origen || 'S/C'}</span>
                                                                                <ArrowRight size={10} className="text-slate-400" />
                                                                                <span className="text-brand-900">{h.condicion_destino || 'S/C'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {h.observaciones && (
                                                                    <p className="text-[10px] text-slate-500 font-bold bg-slate-50 p-2 rounded border border-slate-100 italic">
                                                                        "{h.observaciones}"
                                                                    </p>
                                                                )}

                                                                <div className="flex items-center gap-1 border-t border-slate-50 pt-2 text-[9px] font-bold text-slate-400 uppercase">
                                                                    <User size={10} />
                                                                    <span>Operador: {h.usuario ? `${h.usuario.nombres} ${h.usuario.apellidos}` : 'Sistema'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 p-6 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button type="button" onClick={onCancel} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                                {activeTab === 'DATOS' && (
                                    <button type="submit" disabled={saving} className="px-8 py-2.5 bg-brand-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-900/20 hover:bg-brand-800 transition-all flex items-center gap-2">
                                        {saving && <RefreshCw size={14} className="animate-spin" />}
                                        {selectedItem ? 'Actualizar' : 'Guardar'}
                                    </button>
                                )}
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>,
        document.body
    );
}
