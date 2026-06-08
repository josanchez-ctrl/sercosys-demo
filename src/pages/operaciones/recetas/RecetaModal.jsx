import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ClipboardList, Plus, Trash2, Search, Utensils, Box, Check } from 'lucide-react';
import { useFormik, FieldArray, FormikProvider } from 'formik';
import * as Yup from 'yup';
import { saveRecetaCompleta } from '../../../services/recetaService';

const validationSchema = Yup.object({
  nombre: Yup.string().required('El nombre es obligatorio'),
  codigo_ficha: Yup.string().required('El código es obligatorio'),
  id_tipologia: Yup.string().required('Seleccione una tipología'),
  rendimiento: Yup.number().min(1, 'Mínimo 1 ración').required(),
  peso_porcion_base: Yup.number().min(0, 'No puede ser negativo').required('Requerido'),
  ingredientes: Yup.array().of(
    Yup.object().shape({
      cantidad: Yup.number().positive('Debe ser > 0').required('Requerido'),
      es_escalable: Yup.boolean()
    })
  ).min(1, 'Debe agregar al menos un ingrediente')
});

export default function RecetaModal({
  initialData = null,
  tipologias = [],
  rubros = [],
  unidades = [],
  recetasDisponibles = [],
  empresaActiva,
  perfil,
  onClose,
  onUpdate
}) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      id: initialData?.id || null,
      id_empresa: empresaActiva.id,
      id_tipologia: initialData?.id_tipologia || '',
      id_unidad_medida: initialData?.id_unidad_medida || '',
      codigo_ficha: initialData?.codigo_ficha || '',
      nombre: initialData?.nombre || '',
      rendimiento: initialData?.rendimiento || 1,
      peso_porcion_base: initialData?.peso_porcion_base || 0,
      estatus: true,
      ingredientes: initialData?.ingredientes?.map(i => ({
        id: i.id,
        id_rubro: i.id_rubro,
        id_sub_receta: i.id_sub_receta,
        cantidad: i.cantidad,
        es_opcional: i.es_opcional || false,
        es_escalable: i.es_escalable !== undefined ? i.es_escalable : true,
        _tipo: i.id_rubro ? 'RUBRO' : 'RECETA', // Auxiliar para UI
        _label: i.id_rubro ? i.rubro?.nombre : i.sub_receta?.nombre,
        _categoria: i.id_rubro ? i.rubro?.categoria?.nombre : `SUB-RECETA (${i.sub_receta?.codigo_ficha})`,
        _unidad: i.id_rubro ? i.rubro?.almacen_unidades_medida?.abreviatura : 'RAC'
      })) || []
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Buscamos la tipología para obtener su abreviatura
        const tipologiaSeleccionada = tipologias.find(t => String(t.id) === String(values.id_tipologia));
        const abreviatura = tipologiaSeleccionada?.abreviatura?.toUpperCase() || '';

        let codigoFinal = values.codigo_ficha.toUpperCase();

        // Si hay abreviatura y el código no empieza ya con ella, la anteponemos
        if (abreviatura && !codigoFinal.startsWith(`${abreviatura}-`)) {
          codigoFinal = `${abreviatura}-${codigoFinal}`;
        }

        const valuesToSave = { ...values, codigo_ficha: codigoFinal };

        await saveRecetaCompleta(valuesToSave, values.ingredientes, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('RUBRO'); // RUBRO o RECETA

  const filteredSearch = (searchType === 'RUBRO' ? rubros : recetasDisponibles)
    .filter(item =>
      item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo_ficha?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(item => searchType === 'RECETA' || item.es_ingrediente === true) // Solo ingredientes si es RUBRO
    .filter(item => item.id !== initialData?.id) // No incluirse a sí misma como sub-receta
    .filter(item => !formik.values.ingredientes.some(ing =>
      (searchType === 'RUBRO' && ing.id_rubro === item.id) ||
      (searchType === 'RECETA' && ing.id_sub_receta === item.id)
    ));

  const addIngrediente = (item) => {
    console.log(item);
    const exists = formik.values.ingredientes.find(i =>
      (searchType === 'RUBRO' && i.id_rubro === item.id) ||
      (searchType === 'RECETA' && i.id_sub_receta === item.id)
    );

    if (exists) return;

    const nuevo = {
      id_rubro: searchType === 'RUBRO' ? item.id : null,
      id_sub_receta: searchType === 'RECETA' ? item.id : null,
      cantidad: 0,
      es_opcional: false,
      es_escalable: true,
      _tipo: searchType,
      _label: item.nombre,
      _categoria: searchType === 'RUBRO' ? item.almacen_categorias?.nombre : `SUB-RECETA (${item.codigo_ficha})`,
      _unidad: searchType === 'RUBRO' ? item.almacen_unidades_medida?.abreviatura || 'UN' : 'RAC'
    };

    formik.setFieldValue('ingredientes', [nuevo, ...formik.values.ingredientes]);
    setSearchTerm('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white w-full h-full max-w-[98vw] max-h-[95vh] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-900" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-brand-50 text-brand-900 flex items-center justify-center border border-brand-100 shadow-inner">
              <ClipboardList size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Receta' : 'Nueva Receta'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                Ficha Técnica y Escandallo de Ingredientes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <FormikProvider value={formik}>
          <div className="flex-1 grid grid-cols-3 overflow-hidden bg-gray-50/30">

            {/* Panel Izquierdo: Info Cabecera */}
            <div className="w-full px-4 py-8 border-r border-gray-100 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información General</h4>

                <div className="flex flex-col gap-1">

                  <div className="grid grid-cols-1 align-center gap-1">
                    <div className="">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Tipología</label>
                      <select
                        {...formik.getFieldProps('id_tipologia')}
                        /* className="w-full px-4 py-3 bg-white rounded-md border border-gray-100 text-xs font-black text-slate-700 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all" */
                        className={`w-full px-4 py-3 bg-white rounded-md border border-gray-100 text-xs font-black text-slate-700 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all
                          ${formik.touched.id_tipologia && formik.errors.id_tipologia
                                  ? 'border-red-300 ring-4 ring-red-100'
                                  : 'border-gray-100 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent focus:bg-white'}`}
                      >
                        <option value="">Seleccione...</option>
                        {tipologias.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre} ({t.abreviatura})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 align-center gap-1">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Rendimiento</label>
                      <input
                        type="number"
                        {...formik.getFieldProps('rendimiento')}
                        className="w-full px-4 py-3 bg-white rounded-md border border-gray-100 text-xs font-black text-slate-700 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Cant. Base</label>
                      <input
                        type="number"
                        {...formik.getFieldProps('peso_porcion_base')}
                        placeholder="150"
                        className="w-full px-4 py-3 bg-white rounded-md border border-brand-900/20 text-xs font-black text-brand-900 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all"
                      />
                    </div>
                    <div className="">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Unidad Base</label>
                      <select
                        {...formik.getFieldProps('id_unidad_medida')}
                        className="w-full px-4 py-3 bg-brand-50 rounded-md border border-brand-100 text-xs font-black text-brand-900 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all"
                      >
                        <option value="">...</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.abreviatura}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 align-center gap-1">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Código Ficha</label>
                      <input
                        type="text"
                        {...formik.getFieldProps('codigo_ficha')}
                        placeholder="Ej: 001"
                        className="w-full px-4 py-3 bg-white rounded-md border border-gray-100 text-xs font-black text-slate-700 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all uppercase"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Nombre de la Receta</label>
                      <input
                        type="text"
                        {...formik.getFieldProps('nombre')}
                        placeholder="Ej: BROCHETAS DE POLLO"
                        className="w-full px-4 py-3 bg-white rounded-md border border-gray-100 text-xs font-black text-slate-700 focus:ring-4 focus:ring-brand-900/5 focus:border-brand-900 outline-none transition-all uppercase"
                      />
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* Panel Central/Derecho: Ingredientes */}
            <div className="col-span-2 px-4 py-8 flex flex-col gap-6 overflow-hidden">

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Composición de Ingredientes</h4>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSearchType('RUBRO')}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${searchType === 'RUBRO' ? 'bg-white text-brand-900 shadow-sm' : 'text-slate-400'}`}
                    >
                      Insumos/Rubros
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchType('RECETA')}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${searchType === 'RECETA' ? 'bg-white text-brand-900 shadow-sm' : 'text-slate-400'}`}
                    >
                      Sub-Recetas
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    type="text"
                    placeholder={`Buscar ${searchType === 'RUBRO' ? 'rubro' : 'receta'} para agregar...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-[1.5rem] text-sm font-semibold text-slate-700 outline-none focus:border-brand-900 shadow-sm"
                  />

                  {searchTerm && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-md shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-2">
                      {filteredSearch.length > 0 ? (
                        filteredSearch.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addIngrediente(item)}
                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-900 flex items-center justify-center">
                                {searchType === 'RUBRO' ? <Box size={14} /> : <Utensils size={14} />}
                              </div>
                              <div className="flex flex-col items-start text-left">
                                <span className="text-[11px] font-black text-slate-700 uppercase leading-none">{item.nombre}</span>
                                <span className="text-[8px] font-bold text-brand-600 uppercase tracking-tighter mt-1 bg-brand-50 px-1.5 py-0.5 rounded-md">
                                  {searchType === 'RUBRO' ? item.almacen_categorias?.nombre : item.codigo_ficha}
                                </span>
                              </div>
                            </div>
                            <Plus size={16} className="text-slate-300 group-hover:text-brand-900 transition-colors" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase">Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                <FieldArray name="ingredientes">
                  {({ remove }) => (
                    formik.values.ingredientes.length > 0 ? (
                      formik.values.ingredientes.map((ing, index) => (
                        <div key={index} className="flex items-center gap-4 bg-white p-2 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right-4 duration-300">
                          <span className="w-6 text-center text-xs font-bold text-slate-700 uppercase tracking-tight leading-none bg-brand-50 rounded-lg">{formik.values.ingredientes.length - index}</span>
                          <div className={`p-3 rounded-xl ${ing._tipo === 'RUBRO' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {ing._tipo === 'RUBRO' ? <Box size={16} /> : <Utensils size={16} />}
                          </div>

                          <div className="flex-1">
                            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight leading-none mb-1">{ing._label}</p>
                            <p className="text-[8px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-lg inline-block uppercase tracking-tighter italic">
                              {ing._categoria || (ing._tipo === 'RUBRO' ? 'Materia Prima' : 'Sub-Receta')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input
                                type="number"
                                min={0.001}
                                name={`ingredientes[${index}].cantidad`}
                                value={formik.values.ingredientes[index].cantidad}
                                onChange={formik.handleChange}
                                step="any"
                                className={`w-24 px-4 py-2 bg-slate-50 border rounded-xl text-center text-xs font-black outline-none transition-all ${formik.errors.ingredientes?.[index]?.cantidad
                                  ? 'border-red-500 text-red-600 focus:ring-red-50'
                                  : 'border-slate-100 text-slate-700 focus:border-brand-900'
                                  }`}
                              />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase w-10">{ing._unidad}</span>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <label className="text-[8px] font-black text-slate-300 uppercase leading-none">Escalable</label>
                            <button
                              type="button"
                              onClick={() => formik.setFieldValue(`ingredientes[${index}].es_escalable`, !ing.es_escalable)}
                              className={`p-2 rounded-xl transition-all border ${ing.es_escalable
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm'
                                : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-slate-400'
                                }`}
                              title={ing.es_escalable ? 'Escala con el gramaje' : 'Cantidad fija'}
                            >
                              <Check size={16} className={ing.es_escalable ? 'opacity-100 scale-110' : 'opacity-20 scale-90'} />
                            </button>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <label className="text-[8px] font-black text-slate-300 uppercase leading-none">Opcional</label>
                            <button
                              type="button"
                              onClick={() => formik.setFieldValue(`ingredientes[${index}].es_opcional`, !ing.es_opcional)}
                              className={`p-2 rounded-xl transition-all border ${ing.es_opcional
                                ? 'bg-brand-50 border-brand-200 text-brand-900 shadow-sm'
                                : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-slate-400'
                                }`}
                              title={ing.es_opcional ? 'Ingrediente Opcional' : 'Ingrediente Obligatorio'}
                            >
                              <Plus size={16} className={ing.es_opcional ? 'opacity-100 scale-110' : 'opacity-20 scale-90'} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                        <ClipboardList size={48} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4">Sin ingredientes configurados</p>
                      </div>
                    )
                  )}
                </FieldArray>
              </div>
            </div>

          </div>
        </FormikProvider>


        {/* Footer */}
        <div className="sticky bottom-0 w-full px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-md text-sm font-bold text-slate-400 hover:bg-gray-100 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => formik.handleSubmit()}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-4 bg-brand-900 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar Ficha Técnica'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
