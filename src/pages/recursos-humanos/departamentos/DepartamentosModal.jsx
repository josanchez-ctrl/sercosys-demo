import { Formik, Form, Field, ErrorMessage } from 'formik';
import { createPortal } from 'react-dom';
import * as Yup from 'yup';
import { Building2, RefreshCw, Hash, AlertCircle } from 'lucide-react';

/*
  MODAL: Departamentos
  ESTÁNDAR: Formik + Yup
*/

// Esquema de validación con Yup
const DepartamentoSchema = Yup.object().shape({
    nombre: Yup.string()
        .min(3, 'Mínimo 3 caracteres')
        .required('El nombre es obligatorio'),
    orden: Yup.number()
        .min(0, 'No puede ser negativo')
        .required('El orden es obligatorio'),
    estatus: Yup.boolean().required()
});

export default function DepartamentosModal({ selectedItem, onSave, onCancel, saving }) {
    
    const initialValues = {
        nombre: selectedItem?.nombre || '',
        orden: selectedItem?.orden || 0,
        estatus: selectedItem ? selectedItem.estatus : true
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                
                <Formik
                    initialValues={initialValues}
                    validationSchema={DepartamentoSchema}
                    enableReinitialize={true}
                    onSubmit={(values) => {
                        onSave({
                            ...values,
                            nombre: values.nombre.toUpperCase()
                        });
                    }}
                >
                    {({ errors, touched, values, setFieldValue }) => (
                        <Form className="flex flex-col h-full overflow-hidden">
                            {/* Cabecera */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-900 text-white rounded-md">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                            {selectedItem ? 'Editar Departamento' : 'Nuevo Departamento'}
                                        </h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">Registro Organizacional</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cuerpo */}
                            <div className="flex-1 overflow-y-auto bg-gray-50/30 p-8">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                {/* Campo: Nombre */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Departamento</label>
                                    <Field
                                        name="nombre"
                                        placeholder="EJ. SEGURIDAD PATRIMONIAL"
                                        autoComplete="off"
                                        className={`w-full px-5 py-3 bg-slate-50 border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all uppercase ${
                                            errors.nombre && touched.nombre ? 'border-red-300 focus:border-red-400' : 'border-slate-100 focus:border-brand-200'
                                        }`}
                                    />
                                    <ErrorMessage name="nombre" component="div" className="text-[10px] font-black text-red-500 flex items-center gap-1 mt-1 ml-1" />
                                </div>

                                {/* Campo: Orden */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Hash size={10} /> Orden de Visualización
                                    </label>
                                    <Field
                                        type="number"
                                        name="orden"
                                        className={`w-full px-5 py-3 bg-slate-50 border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all ${
                                            errors.orden && touched.orden ? 'border-red-300 focus:border-red-400' : 'border-slate-100 focus:border-brand-200'
                                        }`}
                                    />
                                    <ErrorMessage name="orden" component="div" className="text-[10px] font-black text-red-500 mt-1 ml-1" />
                                </div>

                                {/* Campo: Estado (Solo en edición) */}
                                {selectedItem && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Operativo</label>
                                        <div className="flex items-center gap-4 p-1 bg-slate-50 rounded-md border border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setFieldValue('estatus', true)}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                                    values.estatus 
                                                    ? 'bg-brand-900 text-white shadow-md' 
                                                    : 'text-slate-400 hover:bg-slate-100'
                                                }`}
                                            >
                                                Activo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFieldValue('estatus', false)}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                                    !values.estatus 
                                                    ? 'bg-red-600 text-white shadow-md' 
                                                    : 'text-slate-400 hover:bg-slate-100'
                                                }`}
                                            >
                                                Inactivo
                                            </button>
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 p-6 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={saving}
                                    className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-8 py-2.5 bg-brand-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-900/20 hover:bg-brand-800 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw size={14} className="animate-spin" />}
                                    {selectedItem ? 'Actualizar' : 'Guardar'}
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
