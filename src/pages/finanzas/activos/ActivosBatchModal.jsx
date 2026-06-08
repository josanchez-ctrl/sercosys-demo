import { Formik, Form, Field, ErrorMessage } from 'formik';
import { createPortal } from 'react-dom';
import * as Yup from 'yup';
import { Package, RefreshCw } from 'lucide-react';

/*
  MODAL: Registro Masivo de Activos
  ESTÁNDAR: Formik + Yup + Sercosys Core
*/

const BatchSchema = Yup.object().shape({
    cantidad: Yup.number().required('Requerido').min(1, 'Mínimo 1').max(100, 'Máximo 100'),
    id_categoria: Yup.string().required('Seleccione categoría'),
    id_rubro: Yup.string().required('Seleccione rubro'),
    id_producto: Yup.string().required('Seleccione producto'),
    peso: Yup.number().min(0, 'No puede ser negativo').nullable(),
    condicion: Yup.string().required(),
    estatus_operativo: Yup.string().required(),
    id_sucursal_actual: Yup.string().nullable().when('condicion', {
        is: 'ASIGNADO',
        then: (schema) => schema.required('Requerido'),
        otherwise: (schema) => schema.nullable()
    }),
    id_departamento_actual: Yup.string().nullable().when('condicion', {
        is: 'ASIGNADO',
        then: (schema) => schema.required('Requerido'),
        otherwise: (schema) => schema.nullable()
    })
});

export default function ActivosBatchModal({ categorias, rubros, productos, sucursales, departamentos, onSave, onCancel, saving }) {

    const initialValues = {
        cantidad: 1,
        id_categoria: '',
        id_rubro: '',
        id_producto: '',
        peso: 0,
        condicion: 'RESGUARDO',
        estatus_operativo: 'ACTIVO',
        id_sucursal_actual: '',
        id_departamento_actual: '',
        observaciones: ''
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
            <div className="relative bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                <Formik
                    initialValues={initialValues}
                    validationSchema={BatchSchema}
                    onSubmit={onSave}
                >
                    {({ errors, touched, values }) => (
                        <Form className="flex flex-col h-full overflow-hidden">
                            {/* Cabecera */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-900 text-white rounded-md">
                                        <Package size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Registro Masivo (Capitalización)</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">Generación Automática de Códigos ACT</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cuerpo */}
                            <div className="flex-1 overflow-y-auto bg-gray-50/30 px-8 py-6">
                                <div className="space-y-4">
                                    {/* Fila Cantidad */}
                                    <div className="bg-brand-50/30 p-4 rounded-xl border border-brand-100/50 space-y-1">
                                        <label className="text-[10px] font-black text-brand-900 uppercase tracking-widest ml-1 text-center block">Cantidad a Crear</label>
                                        <Field type="number" name="cantidad" className="w-full max-w-[150px] mx-auto block px-4 py-2 bg-white border border-brand-200 rounded-md text-xl font-black text-brand-900 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all text-center" />
                                        <ErrorMessage name="cantidad" component="div" className="text-[9px] font-black text-red-500 text-center" />
                                    </div>

                                    {/* Categoría y Rubro */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                                            <Field as="select" name="id_categoria" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_categoria && touched.id_categoria ? 'border-red-300' : 'border-slate-100'}`}>
                                                <option value="">SELECCIONE...</option>
                                                {categorias?.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                                ))}
                                            </Field>
                                            <ErrorMessage name="id_categoria" component="div" className="text-[9px] font-black text-red-500 ml-1 mt-0.5" />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rubro</label>
                                            <Field as="select" name="id_rubro" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_rubro && touched.id_rubro ? 'border-red-300' : 'border-slate-100'}`}>
                                                <option value="">SELECCIONE...</option>
                                                {rubros?.filter(r => r.id_categoria.toString() === values.id_categoria?.toString()).map(r => (
                                                    <option key={r.id} value={r.id}>{r.nombre}</option>
                                                ))}
                                            </Field>
                                            <ErrorMessage name="id_rubro" component="div" className="text-[9px] font-black text-red-500 ml-1 mt-0.5" />
                                        </div>
                                    </div>

                                    {/* Producto y Peso */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Producto</label>
                                            <Field as="select" name="id_producto" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_producto && touched.id_producto ? 'border-red-300' : 'border-slate-100'}`}>
                                                <option value="">SELECCIONE...</option>
                                                {productos?.filter(p => p.id_rubro.toString() === values.id_rubro?.toString()).map(p => (
                                                    <option key={p.id} value={p.id}>{p.marca?.nombre || ''} {p.variedad || ''}</option>
                                                ))}
                                            </Field>
                                            <ErrorMessage name="id_producto" component="div" className="text-[9px] font-black text-red-500 ml-1 mt-0.5" />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peso Lote (KG) - Opcional</label>
                                            <Field type="number" step="0.1" name="peso" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" />
                                        </div>
                                    </div>

                                    {/* Condición y Estatus */}
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

                                    {/* Ubicación y Departamento (Condicional) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Sucursal Inicial {values.condicion === 'ASIGNADO' && <span className="text-red-500">*</span>}
                                            </label>
                                            <Field as="select" name="id_sucursal_actual" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_sucursal_actual && touched.id_sucursal_actual ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100'}`}>
                                                <option value="">SELECCIONE...</option>
                                                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                            </Field>
                                            <ErrorMessage name="id_sucursal_actual" component="div" className="text-[9px] font-black text-red-500 ml-1 mt-0.5" />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Departamento Inicial {values.condicion === 'ASIGNADO' && <span className="text-red-500">*</span>}
                                            </label>
                                            <Field as="select" name="id_departamento_actual" className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${errors.id_departamento_actual && touched.id_departamento_actual ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100'}`}>
                                                <option value="">SELECCIONE...</option>
                                                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                            </Field>
                                            <ErrorMessage name="id_departamento_actual" component="div" className="text-[9px] font-black text-red-500 ml-1 mt-0.5" />
                                        </div>
                                    </div>

                                    {/* Observaciones */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Justificación</label>
                                            <Field as="textarea" name="observaciones" placeholder="Escriba aquí observaciones para el lote de activos..." className="w-full h-20 px-4 py-2.5 bg-white border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all resize-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 p-6 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button type="button" onClick={onCancel} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                                <button type="submit" disabled={saving} className="px-8 py-2.5 bg-brand-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-900/20 hover:bg-brand-800 transition-all flex items-center gap-2">
                                    {saving && <RefreshCw size={14} className="animate-spin" />}
                                    Procesar Registro
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>,
        document.body
    );
}
