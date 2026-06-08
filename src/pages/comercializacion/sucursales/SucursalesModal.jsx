import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Hash, Phone, Mail, User, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { getSucursales, createSucursal, updateSucursal } from '../../../services/sucursalService';
import { getClientes } from '../../../services/clienteService';

export default function SucursalModal({ empresaActiva, perfil, nombre_cliente, sucursal = null, clienteSeleccionadoId = null, onClose, onUpdate }) {
  const isEdit = !!sucursal;

  const [clientesExistentes, setClientesExistentes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [errorValidacion, setErrorValidacion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarMaestros = async () => {
      setCargando(true);
      try {
        const [cliexi, clis] = await Promise.all([
          getSucursales(empresaActiva.id),
          getClientes()
        ]);
        setClientesExistentes(cliexi);
        setClientes(clis);

      } catch (error) {
        console.error("Error al cargar maestros:", error);
      } finally {
        setCargando(false);
      }
    };

    if (empresaActiva) cargarMaestros();
  }, [empresaActiva]);

  const validationSchema = Yup.object({
    nombre: Yup.string().required('El nombre es obligatorio').min(3, 'Mínimo 3 caracteres'),
    direccion: Yup.string(),
    nombre_responsable: Yup.string(),
    telefono_responsable: Yup.string(),
    email_responsable: Yup.string().email('Correo inválido'),
    estatus: Yup.boolean(),
  });

  const formik = useFormik({
    initialValues: {
      nombre: '',
      direccion: '',
      nombre_responsable: '',
      telefono_responsable: '',
      email_responsable: '',
      estatus: true,
      id_cliente: clienteSeleccionadoId || '',
      id_empresa: empresaActiva?.id,
      id_usuario: perfil?.id
    },
    validationSchema,
    onSubmit: async (values) => {
      setErrorValidacion(null);

      // Normalizar valores para comparación
      const nombreNormalizado = values.nombre.trim().toUpperCase();
      // Validar nombre duplicado (excluyendo el cliente actual si es edición)
      const clienteMismoNombre = clientesExistentes.find(
        c => c.nombre?.trim().toUpperCase() === nombreNormalizado && c.id !== (sucursal?.id || sucursal?.id_sucursal)
      );

      if (clienteMismoNombre) {
        setErrorValidacion('Ya existe una sucursal con este nombre');
        return;
      }

      try {
        if (isEdit) {
          await updateSucursal(sucursal.id, values);
        } else {
          await createSucursal(values);
        }
        onUpdate();
        onClose();
      } catch (err) {
        console.error('Error:', err);
        alert(`Error al ${isEdit ? 'actualizar' : 'crear'} sucursal: ` + (err.message || 'Error desconocido'));
      }
    },
  });

  useEffect(() => {
    if (isEdit && sucursal) {
      formik.resetForm({
        values: {
          nombre: sucursal.nombre?.toUpperCase() || '',
          id_empresa: sucursal.id_empresa || null,
          direccion: sucursal.direccion?.toUpperCase() || '',
          nombre_responsable: sucursal.nombre_responsable?.toUpperCase() || '',
          telefono_responsable: sucursal.telefono_responsable || '',
          email_responsable: sucursal.email_responsable?.toUpperCase() || '',
          id_cliente: sucursal.id_cliente || '',
          estatus: sucursal.estatus !== false,
          id_usuario: perfil?.id
        }
      });
    }
  }, [sucursal, isEdit]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col overflow-hidden sm:rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center transition-colors duration-300 border shadow-inner ${isEdit ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-brand-50 text-brand-600 border-brand-100'}`}>
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Sucursal' : `Nueva Sucursal`}
              </h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {isEdit ? formik.values.nombre : `Sede para ${nombre_cliente || 'Empresa'}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={formik.handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar bg-gray-50/30">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${isEdit ? "lg:col-span-2" : "lg:col-span-3"} bg-white p-6 rounded-md border border-gray-200 shadow-sm space-y-6`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={14} /> Información de la Sede para: {nombre_cliente || 'Empresa'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Cliente Asociado */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Cliente Asociado (Opcional)</label>
                  <select
                    {...formik.getFieldProps('id_cliente')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all text-sm font-semibold text-gray-800 outline-none bg-white appearance-none cursor-pointer"
                  >
                    <option value="">SIN CLIENTE ESPECÍFICO</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Nombre */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="Empresatext-[11px] font-bold text-gray-500 uppercase ml-1">Nombre de Sede</label>
                  <input
                    type="text"
                    {...formik.getFieldProps('nombre')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none 
                      ${formik.touched.nombre && formik.errors.nombre
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="EJ: SEDE PRINCIPAL, DEPÓSITO 1..."
                  />
                  {formik.touched.nombre && formik.errors.nombre && (
                    <p className="text-[10px] font-bold text-red-500 ml-1">{formik.errors.nombre}</p>
                  )}
                </div>

                {/* Dirección */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="Empresatext-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <MapPin size={12} /> Dirección Completa
                  </label>
                  <textarea
                    {...formik.getFieldProps('direccion')}
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none resize-none
                      ${formik.touched.direccion && formik.errors.direccion
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="Dirección exacta..."
                  />
                </div>

                {/* Persona de Contacto */}
                <div className="space-y-1.5">
                  <label className="Empresatext-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <User size={12} /> Responsable
                  </label>
                  <input
                    type="text"
                    {...formik.getFieldProps('nombre_responsable')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.nombre_responsable && formik.errors.nombre_responsable
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="Nombre del responsable"
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-1.5">
                  <label className="Empresatext-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <Phone size={12} /> Teléfono
                  </label>
                  <input
                    type="tel"
                    {...formik.getFieldProps('telefono_responsable')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.telefono_responsable && formik.errors.telefono_responsable
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="+58..."
                  />
                </div>

                {/* Email */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="Empresatext-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <Mail size={12} /> Correo Electrónico
                  </label>
                  <input
                    type="email"
                    {...formik.getFieldProps('email_responsable')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.email_responsable && formik.errors.email_responsable
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="sede@empresa.com"
                  />
                </div>
              </div>
            </div>

            {isEdit && (
              <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex flex-col justify-start space-y-4 h-fit">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  Configuración
                </h4>
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all group">
                  <span className="text-sm font-bold text-gray-700">Estado Activo</span>
                  <input type="checkbox" {...formik.getFieldProps('estatus')} checked={formik.values.estatus} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[4.5px] after:right-[15.5px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:-translate-x-full relative"></div>
                </label>
              </div>
            )}
          </div>

        </form>

        {/* Error de validación */}
        {errorValidacion && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-bold text-red-700">{errorValidacion}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-end gap-3 sticky bottom-0">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
          <button
            type="button"
            onClick={() => formik.handleSubmit()}
            disabled={formik.isSubmitting || !formik.dirty}
            className={`bg-brand-900 text-white px-10 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-600 shadow-xl shadow-brand-accent/30 transition-all active:scale-95 flex items-center gap-2 ${(!formik.dirty || formik.isSubmitting) ? 'opacity-50 cursor-not-allowed grayscale' : 'opacity-100'}`}
          >
            {formik.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            {isEdit ? 'Guardar Cambios' : 'Registrar Sucursal'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
