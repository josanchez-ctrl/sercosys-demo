import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { X, Save, Users, Mail, Phone, MapPin } from 'lucide-react';
import { createProveedor, updateProveedor } from '../../../services/proveedorService';
import { supabase } from '../../../lib/supabase';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { toast } from 'sonner';

const ProveedorSchema = Yup.object().shape({
    nombre: Yup.string().required('Campo obligatorio'),
    dni: Yup.string().required('Campo obligatorio'),
    id_letradni: Yup.string().required('Requerido'),
    email: Yup.string().email('Email inválido'),
    telefono: Yup.string(),
    direccion: Yup.string(),
});

const ProveedorModal = ({ isOpen, onClose, onSuccess, proveedor }) => {
    const { empresaActiva, perfil } = useModulePermissions();
    const [letrasDni, setLetrasDni] = useState([]);

    useEffect(() => {
        fetchLetrasDni();
    }, []);

    const fetchLetrasDni = async () => {
        const { data } = await supabase.from('letrasdni').select('*').order('orden');
        setLetrasDni(data || []);
    };

    if (!isOpen) return null;

    const initialValues = {
        nombre: proveedor?.nombre || '',
        dni: proveedor?.dni || '',
        id_letradni: proveedor?.id_letradni || '',
        email: proveedor?.email || '',
        telefono: proveedor?.telefono || '',
        direccion: proveedor?.direccion || '',
        id_empresa: empresaActiva?.id,
        estatus: proveedor ? proveedor.estatus : true,
        id_usuario_create: proveedor?.id_usuario_create || perfil.id,
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            if (proveedor) {
                await updateProveedor(proveedor.id, { ...values, id_usuario_update: usuario?.id });
                toast.success('Proveedor actualizado');
            } else {
                await createProveedor(values);
                toast.success('Proveedor creado');
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar datos');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 rounded-full text-white">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                {proveedor ? 'Ficha de Proveedor' : 'Nuevo Aliado'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Información Maestra</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <Formik
                    initialValues={initialValues}
                    validationSchema={ProveedorSchema}
                    onSubmit={handleSubmit}
                >
                    {({ errors, touched, isSubmitting }) => (
                        <Form>
                            <div className="p-6 space-y-4 bg-gray-50/30 overflow-y-auto max-h-[70vh]">
                                {/* Datos Principales */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Razón Social</label>
                                        <Field
                                            name="nombre"
                                            className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none text-sm font-bold ${errors.nombre && touched.nombre ? 'border-red-100 bg-red-50' : 'border-gray-50 bg-gray-50 focus:border-brand-200 focus:bg-white'}`}
                                            placeholder="Ej: DISTRIBUIDORA ALIMENTOS C.A."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Identificación</label>
                                        <div className="flex gap-2">
                                            <Field
                                                as="select"
                                                name="id_letradni"
                                                className="w-20 px-3 py-3 rounded-xl border-2 border-gray-50 bg-gray-50 focus:border-brand-200 outline-none text-sm font-bold"
                                            >
                                                <option value="">-</option>
                                                {letrasDni.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                                            </Field>
                                            <Field
                                                name="dni"
                                                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all outline-none text-sm font-bold ${errors.dni && touched.dni ? 'border-red-100 bg-red-50' : 'border-gray-50 bg-gray-50 focus:border-brand-200 focus:bg-white'}`}
                                                placeholder="Nro Identificación"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Correo Electrónico</label>
                                        <div className="relative">
                                            <Field
                                                name="email"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-50 bg-gray-50 focus:border-brand-200 outline-none text-sm font-bold"
                                                placeholder="email@ejemplo.com"
                                            />
                                            <Mail className="absolute left-3 top-3.5 text-slate-300" size={16} />
                                        </div>
                                    </div>
                                </div>

                                {/* Contacto y Dirección */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Teléfono de Contacto</label>
                                        <div className="relative">
                                            <Field
                                                name="telefono"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-50 bg-gray-50 focus:border-brand-200 outline-none text-sm font-bold"
                                                placeholder="Ej: 04121234567"
                                            />
                                            <Phone className="absolute left-3 top-3.5 text-slate-300" size={16} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Dirección Fiscal</label>
                                        <div className="relative">
                                            <Field
                                                as="textarea"
                                                name="direccion"
                                                rows="3"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-50 bg-gray-50 focus:border-brand-200 outline-none text-sm font-bold resize-none"
                                                placeholder="Indique la dirección completa..."
                                            />
                                            <MapPin className="absolute left-3 top-3.5 text-slate-300" size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-white border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-gray-50 transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-brand-900 text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-brand-900/20 active:scale-95 transition-all"
                                >
                                    <Save size={16} />
                                    {isSubmitting ? 'Guardando...' : 'Guardar Ficha'}
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>,
        document.body
    );
};

export default ProveedorModal;
