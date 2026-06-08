import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, MapPin, Hash, Phone, Mail, User, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { getLetrasDni } from '../../../services/letradniService';
import { menuConfig } from '../../../config/menuConfig';
import { getTipoCliente, getClientes, createCliente, updateCliente } from '../../../services/clienteService';

export default function ClientesModal({ client = null, onClose, onUpdate, perfil, empresaActiva }) {

  const isEdit = !!client;
  const [letrasDni, setLetrasDni] = useState([]);
  const [tipoCliente, setTipoCliente] = useState([]);
  const [clientesExistentes, setClientesExistentes] = useState([]);
  const [errorValidacion, setErrorValidacion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarMaestros = async () => {
      setCargando(true);
      try {
        const [letras, ticli, cliexi] = await Promise.all([
          getLetrasDni(),
          getTipoCliente(),
          getClientes()
        ]);
        setLetrasDni(letras);
        setTipoCliente(ticli);
        setClientesExistentes(cliexi);

      } catch (error) {
        console.error("Error al cargar maestros:", error);
      } finally {
        setCargando(false);
      }
    };

    if (empresaActiva) cargarMaestros();
  }, [empresaActiva]);

  const validationSchema = Yup.object({
    nombre: Yup.string()
      .required('La razón social es obligatoria')
      .min(3, 'Mínimo 3 caracteres'),
    id_letradni: Yup.string()
      .required('Requerido'),
    dni: Yup.string()
      .required('El número de identificación es obligatorio')
      .matches(/^[0-9]+$/, 'Solo números')
      .min(7, 'Mínimo 7 dígitos'),
    direccion: Yup.string(),
    contacto_nombre: Yup.string(),
    contacto_telefono: Yup.string(),
    contacto_email: Yup.string()
      .email('Correo inválido'),
    estatus: Yup.boolean(),
    id_tipocliente: Yup.string()
      .required('La razón social es obligatoria')
  });

  const formik = useFormik({
    initialValues: {
      nombre: '',
      id_letradni: '',
      letra_dni: '',
      dni: '',
      direccion: '',
      contacto_nombre: '',
      contacto_telefono: '',
      contacto_email: '',
      estatus: true,
      id_empresa: empresaActiva.id,
      id_tipocliente: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setErrorValidacion(null);

      // Normalizar valores para comparación
      const nombreNormalizado = values.nombre.trim().toUpperCase();
      const dniNormalizado = values.dni.trim();
      const idLetradni = values.id_letradni;

      // Validar nombre duplicado (excluyendo el cliente actual si es edición)
      const clienteMismoNombre = clientesExistentes.find(
        c => c.nombre?.trim().toUpperCase() === nombreNormalizado && c.id !== (client?.id || client?.id_cliente)
      );

      // Validar combinación id_letradni + dni duplicada
      const clienteMismaIdentificacion = clientesExistentes.find(
        c => c.id_letradni === idLetradni && c.dni === dniNormalizado && c.id !== (client?.id || client?.id_cliente)
      );

      if (clienteMismoNombre) {
        setErrorValidacion('Ya existe un cliente con esta razón social');
        return;
      }

      if (clienteMismaIdentificacion) {
        setErrorValidacion('Ya existe un cliente con esta identificación (RIF/DNI)');
        return;
      }

      try {
        if (isEdit) {
          await updateCliente(client.id, values, perfil?.id);
        } else {
          await createCliente(values, perfil?.id);
        }
        onUpdate();
        onClose();
      } catch (err) {
        console.error('Error:', err);
        alert(`Error al ${isEdit ? 'actualizar' : 'crear'} empresa: ` + (err.message || 'Error desconocido'));
      }
    },
  });

  useEffect(() => {
    if (isEdit && client) {
      formik.resetForm({
        values: {
          nombre: client.nombre?.toUpperCase() || '',
          id_letradni: client.letradni?.id || '',
          letra_dni: client.letradni?.nombre || '',
          dni: client.dni || '',
          direccion: client.direccion || '',
          contacto_nombre: client.contacto_nombre || '',
          contacto_telefono: client.contacto_telefono || '',
          contacto_email: client.contacto_email || '',
          estatus: client.estatus !== false,
          id_empresa: empresaActiva.id,
          id_usuario: perfil?.id,
          id_tipocliente: client.id_tipocliente || '',
        }
      });
    }
  }, [client, isEdit, perfil]);

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
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {isEdit ? formik.values.nombre : 'Configure los datos del nuevo cliente'}
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
                  <Building2 size={14} /> Información Comercial
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Razón Social */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Razón Social</label>
                  <input
                    type="text"
                    {...formik.getFieldProps('nombre')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none 
                            ${formik.touched.nombre && formik.errors.nombre
                        ? 'border-red-300 focus:ring-4 focus:ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="Nombre de la empresa"
                  />
                  {formik.touched.nombre && formik.errors.nombre && (
                    <p className="text-[10px] font-bold text-red-500 ml-1">{formik.errors.nombre}</p>
                  )}
                </div>

                {/* Identificación (RIF/DNI) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <Hash size={12} /> Identificación
                  </label>
                  <div className={`flex gap-0 overflow-hidden rounded-xl border transition-all
                      ${(formik.touched.dni && formik.errors.dni) || (formik.touched.id_letradni && formik.errors.id_letradni)
                      ? 'border-red-300 ring-4 ring-red-100'
                      : 'border-gray-200 focus-within:ring-4 focus-within:ring-brand-accent/10 focus-within:border-brand-accent'}`}>
                    <select
                      {...formik.getFieldProps('id_letradni')}
                      className="w-16 bg-gray-50 px-3 py-2.5 border-r border-gray-200 outline-none text-sm font-bold text-gray-700"
                    >
                      <option value="">-</option>
                      {letrasDni.map(letra => (
                        <option key={letra.id} value={letra.id}>{letra.nombre}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      {...formik.getFieldProps('dni')}
                      className="flex-1 px-4 py-2.5 outline-none text-sm font-semibold text-gray-800"
                      placeholder="Número"
                    />
                  </div>
                  {((formik.touched.dni && formik.errors.dni) || (formik.touched.id_letradni && formik.errors.id_letradni)) && (
                    <p className="text-[10px] font-bold text-red-500 ml-1">Requerido</p>
                  )}
                </div>

                {/* Persona de Contacto */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <User size={12} /> Persona de Contacto
                  </label>
                  <input
                    type="text"
                    {...formik.getFieldProps('contacto_nombre')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.contacto_nombre && formik.errors.contacto_nombre
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="Nombre Completo"
                  />
                </div>

                {/* Dirección */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <MapPin size={12} /> Dirección Fiscal
                  </label>
                  <textarea
                    {...formik.getFieldProps('direccion')}
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none resize-none
                      ${formik.touched.direccion && formik.errors.direccion
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="Dirección Fiscal..."
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <Phone size={12} /> Teléfono
                  </label>
                  <input
                    type="tel"
                    {...formik.getFieldProps('contacto_telefono')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.contacto_telefono && formik.errors.contacto_telefono
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="+584123456789"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    <Mail size={12} /> Correo
                  </label>
                  <input
                    type="email"
                    {...formik.getFieldProps('contacto_email')}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold text-gray-800 outline-none
                      ${formik.touched.contacto_email && formik.errors.contacto_email
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-gray-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent'}`}
                    placeholder="email@email.com"
                  />
                </div>

                {/* Tipo Cliente */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                    {/* <Mail size={12} /> */} Tipo de Cliente
                  </label>
                  <select
                    {...formik.getFieldProps('id_tipocliente')}
                    className="w-full bg-gray-50 px-3 py-2.5 border-r border-gray-200 outline-none text-sm font-bold text-gray-700"
                  >
                    <option value="">-</option>
                    {tipoCliente.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
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
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={formik.handleSubmit}
            disabled={formik.isSubmitting || !formik.dirty}
            className={`bg-brand-900 text-white px-10 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-600 shadow-xl shadow-brand-accent/30 transition-all active:scale-95 flex items-center gap-2 ${(!formik.dirty || formik.isSubmitting) ? 'opacity-50 cursor-not-allowed grayscale' : 'opacity-100'}`}
          >
            {formik.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            {isEdit ? 'Guardar Cambios' : 'Crear Empresa'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
