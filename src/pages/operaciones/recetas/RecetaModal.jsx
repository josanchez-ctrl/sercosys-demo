import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ClipboardList, Plus, Trash2, Search, Utensils, Box, Check, AlertTriangle, Tag } from 'lucide-react';
import { useFormik, FieldArray, FormikProvider } from 'formik';
import * as Yup from 'yup';
import { saveRecetaCompleta } from '../../../services/recetaService';

const COMPATIBILIDAD_TAGS = [
  // Proteínas y Grasas
  { code: 'FRITO', label: 'Frito / Grasoso', color: 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-900/10' },
  { code: 'PROTEICO_GRASO', label: 'Proteico Graso', color: 'bg-red-50 text-red-700 border-red-200 shadow-red-900/10' },
  { code: 'PROTEINA_MAGRA', label: 'Proteína Magra', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-900/10' },
  { code: 'PROCESADO_EMBUTIDO', label: 'Procesado / Embutido', color: 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-900/10' },
  { code: 'CARNE_ROJA', label: 'Carne Roja', color: 'bg-red-50 text-red-700 border-red-200 shadow-red-900/10' },
  { code: 'PESCADO_MARISCO', label: 'Pescado / Marisco', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 shadow-cyan-900/10' },
  { code: 'PROTEINA_VEGETAL', label: 'Proteína Vegetal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-900/10' },

  // Carbohidratos y Sopas
  { code: 'ALTO_CARBO', label: 'Alto Carbohidrato', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 shadow-yellow-900/10' },
  { code: 'CARBO_INTEGRAL', label: 'Carbohidrato Integral', color: 'bg-lime-50 text-lime-700 border-lime-200 shadow-lime-900/10' },
  { code: 'LEGUMINOSA', label: 'Leguminosa / Grano', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-900/10' },
  { code: 'SOPA_PESADA', label: 'Sopa Densa / Sancocho', color: 'bg-amber-100 text-amber-800 border-amber-300 shadow-amber-900/10' },
  { code: 'TUBERCULO_ALMIDON', label: 'Tubérculo / Almidón', color: 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-900/10' },
  { code: 'GLUTEN', label: 'Contiene Gluten 🌾', color: 'bg-yellow-50 text-yellow-800 border-yellow-200 shadow-yellow-900/10' },

  // Vegetales y Ensaladas
  { code: 'ENSALADA_FRESCA', label: 'Ensalada Fresca', color: 'bg-teal-50 text-teal-700 border-teal-200 shadow-teal-900/10' },
  { code: 'ENSALADA_PESADA', label: 'Ensalada Pesada', color: 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-900/10' },
  { code: 'VEGETAL_CRUCIFERA', label: 'Vegetal Crucifera', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 shadow-cyan-900/10' },
  { code: 'VEGETAL_HOJA_VERDE', label: 'Vegetal Hoja Verde', color: 'bg-green-50 text-green-700 border-green-200 shadow-green-900/10' },
  { code: 'LACTEO_DERIVADO', label: 'Contiene Lácteos 🥛', color: 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-900/10' },

  // Bebidas, Postres e Irritantes
  { code: 'BEBIDA_ACIDA', label: 'Bebida Ácida', color: 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-900/10' },
  { code: 'BEBIDA_DULCE', label: 'Bebida Dulce', color: 'bg-purple-50 text-purple-700 border-purple-200 shadow-purple-900/10' },
  { code: 'BEBIDA_SIN_AZUCAR', label: 'Bebida Sin Azúcar', color: 'bg-teal-50 text-teal-700 border-teal-200 shadow-teal-900/10' },
  { code: 'CAFEINA_ESTIMULANTE', label: 'Contiene Cafeína ☕', color: 'bg-purple-50 text-purple-700 border-purple-200 shadow-purple-900/10' },
  { code: 'POSTRE_DULCE', label: 'Postre Dulce', color: 'bg-pink-50 text-pink-700 border-pink-200 shadow-pink-900/10' },
  { code: 'POSTRE_FRUTAL', label: 'Postre Frutal', color: 'bg-pink-50 text-pink-700 border-pink-200 shadow-pink-900/10' },
  { code: 'FRUTA_ENTERA', label: 'Fruta Entera', color: 'bg-green-50 text-green-700 border-green-200 shadow-green-900/10' },
  { code: 'CONDIMENTADO_IRRITANTE', label: 'Condimentado / Irritante', color: 'bg-violet-50 text-violet-700 border-violet-200 shadow-violet-900/10' },
];

const TIPOLOGIA_TAGS_MAP = {
  // Aves (1), Cerdo (2), Res (3), Pescados (12)
  '1': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'GLUTEN', 'LACTEO_DERIVADO'],
  '2': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'GLUTEN', 'LACTEO_DERIVADO'],
  '3': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'GLUTEN', 'LACTEO_DERIVADO'],
  '12': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'GLUTEN', 'LACTEO_DERIVADO'],

  // Contornos Principales (5) y Secundarios (6)
  '5': ['ALTO_CARBO', 'CARBO_INTEGRAL', 'LEGUMINOSA', 'FRITO', 'CONDIMENTADO_IRRITANTE', 'TUBERCULO_ALMIDON', 'GLUTEN', 'LACTEO_DERIVADO'],
  '6': ['ALTO_CARBO', 'CARBO_INTEGRAL', 'LEGUMINOSA', 'FRITO', 'CONDIMENTADO_IRRITANTE', 'TUBERCULO_ALMIDON', 'GLUTEN', 'LACTEO_DERIVADO'],

  // Ensaladas (9)
  '9': ['ENSALADA_FRESCA', 'ENSALADA_PESADA', 'VEGETAL_CRUCIFERA', 'CARBO_INTEGRAL', 'LEGUMINOSA', 'FRITO', 'CONDIMENTADO_IRRITANTE', 'VEGETAL_HOJA_VERDE', 'LACTEO_DERIVADO', 'GLUTEN'],

  // Sopas (8)
  '8': ['SOPA_PESADA', 'LEGUMINOSA', 'PROCESADO_EMBUTIDO', 'CONDIMENTADO_IRRITANTE', 'TUBERCULO_ALMIDON', 'GLUTEN', 'LACTEO_DERIVADO', 'VEGETAL_CRUCIFERA'],

  // Bebidas (10)
  '10': ['BEBIDA_ACIDA', 'BEBIDA_DULCE', 'BEBIDA_SIN_AZUCAR', 'CAFEINA_ESTIMULANTE'],

  // Panadería (13) y Pastelería (14)
  '13': ['POSTRE_DULCE', 'POSTRE_FRUTAL', 'ALTO_CARBO', 'CARBO_INTEGRAL', 'GLUTEN', 'LACTEO_DERIVADO', 'FRUTA_ENTERA'],
  '14': ['POSTRE_DULCE', 'POSTRE_FRUTAL', 'ALTO_CARBO', 'CARBO_INTEGRAL', 'GLUTEN', 'LACTEO_DERIVADO', 'FRUTA_ENTERA'],

  // Platos Compuestos (Almuerzo: 4, Desayuno: 11) - Permiten todas excepto las de bebidas/postres exclusivos
  '4': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'ALTO_CARBO', 'CARBO_INTEGRAL', 'LEGUMINOSA', 'SOPA_PESADA', 'ENSALADA_FRESCA', 'ENSALADA_PESADA', 'VEGETAL_CRUCIFERA', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'TUBERCULO_ALMIDON', 'GLUTEN', 'VEGETAL_HOJA_VERDE', 'LACTEO_DERIVADO', 'POSTRE_DULCE', 'POSTRE_FRUTAL'],
  '11': ['FRITO', 'PROTEICO_GRASO', 'PROTEINA_MAGRA', 'PROCESADO_EMBUTIDO', 'ALTO_CARBO', 'CARBO_INTEGRAL', 'LEGUMINOSA', 'SOPA_PESADA', 'ENSALADA_FRESCA', 'ENSALADA_PESADA', 'VEGETAL_CRUCIFERA', 'CONDIMENTADO_IRRITANTE', 'CARNE_ROJA', 'PESCADO_MARISCO', 'PROTEINA_VEGETAL', 'TUBERCULO_ALMIDON', 'GLUTEN', 'VEGETAL_HOJA_VERDE', 'LACTEO_DERIVADO', 'POSTRE_DULCE', 'POSTRE_FRUTAL']
};

const validationSchema = Yup.object({
  nombre: Yup.string().required('El nombre es obligatorio'),
  codigo_ficha: Yup.string().required('El código es obligatorio'),
  id_tipologia: Yup.string().required('Seleccione una tipología'),
  rendimiento: Yup.number().min(1, 'Mínimo 1 ración').required(),
  peso_porcion_base: Yup.number().min(0, 'No puede ser negativo').required('Requerido'),
  calorias: Yup.number().min(0, 'Mínimo 0').required('Requerido'),
  proteinas_g: Yup.number().min(0, 'Mínimo 0').required('Requerido'),
  carbohidratos_g: Yup.number().min(0, 'Mínimo 0').required('Requerido'),
  grasas_g: Yup.number().min(0, 'Mínimo 0').required('Requerido'),
  ingredientes: Yup.array().of(
    Yup.object().shape({
      cantidad: Yup.number().positive('Debe ser > 0').required('Requerido'),
      es_escalable: Yup.boolean()
    })
  ).min(1, 'Debe agregar al menos un ingrediente')
});

export default function RecetaModal({
  initialData = null,
  isClone = false,
  tipologias = [],
  rubros = [],
  unidades = [],
  recetasDisponibles = [],
  empresaActiva,
  perfil,
  onClose,
  onUpdate
}) {
  const isEdit = !!initialData && !isClone;
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      id: isClone ? null : (initialData?.id || null),
      id_empresa: empresaActiva.id,
      id_tipologia: initialData?.id_tipologia || '',
      id_unidad_medida: initialData?.id_unidad_medida || '',
      codigo_ficha: isClone ? '' : (initialData?.codigo_ficha || ''),
      nombre: isClone ? `COPIA - ${initialData?.nombre || ''}` : (initialData?.nombre || ''),
      rendimiento: initialData?.rendimiento || 1,
      peso_porcion_base: initialData?.peso_porcion_base || 0,
      calorias: initialData?.calorias || 0,
      proteinas_g: initialData?.proteinas_g || 0,
      carbohidratos_g: initialData?.carbohidratos_g || 0,
      grasas_g: initialData?.grasas_g || 0,
      tags: initialData?.receta_tags?.map(t => t.tag_code) || [],
      estatus: true,
      ingredientes: initialData?.ingredientes?.map(i => ({
        id: isClone ? null : i.id,
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

  const selectedTipologyId = formik.values.id_tipologia;
  const visibleTags = useMemo(() => {
    if (!selectedTipologyId) return [];
    const allowedCodes = TIPOLOGIA_TAGS_MAP[selectedTipologyId];
    if (!allowedCodes) return [];
    return COMPATIBILIDAD_TAGS.filter(tag => allowedCodes.includes(tag.code));
  }, [selectedTipologyId]);

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
                {isClone ? 'Duplicar Receta' : isEdit ? 'Editar Receta' : 'Nueva Receta'}
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
            <div className="w-full px-4 py-2 border-r border-gray-100 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información General</h4>

                <div className="flex flex-col gap-1">

                  <div className="grid grid-cols-1 align-center gap-1">
                    <div className="">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Tipología</label>
                      <select
                        name="id_tipologia"
                        value={formik.values.id_tipologia}
                        onChange={(e) => {
                          const newTipologyId = e.target.value;
                          formik.setFieldValue('id_tipologia', newTipologyId);
                          
                          if (newTipologyId && TIPOLOGIA_TAGS_MAP[newTipologyId]) {
                            const allowedCodes = TIPOLOGIA_TAGS_MAP[newTipologyId];
                            const currentTags = formik.values.tags || [];
                            const filtered = currentTags.filter(code => allowedCodes.includes(code));
                            formik.setFieldValue('tags', filtered);
                          } else {
                            formik.setFieldValue('tags', []);
                          }
                        }}
                        onBlur={formik.handleBlur}
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

                  {/* <hr className="border-gray-100 my-4" /> */}

                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 block">Composición Nutricional</h4>
                  <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Calorías (kcal)</label>
                      <input
                        type="number"
                        step="any"
                        {...formik.getFieldProps('calorias')}
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs font-black outline-none transition-all ${
                          formik.touched.calorias && formik.errors.calorias
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-slate-100 text-slate-700 focus:border-brand-900 focus:bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Proteínas (g)</label>
                      <input
                        type="number"
                        step="any"
                        {...formik.getFieldProps('proteinas_g')}
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs font-black outline-none transition-all ${
                          formik.touched.proteinas_g && formik.errors.proteinas_g
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-slate-100 text-slate-700 focus:border-brand-900 focus:bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Carbohidratos (g)</label>
                      <input
                        type="number"
                        step="any"
                        {...formik.getFieldProps('carbohidratos_g')}
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs font-black outline-none transition-all ${
                          formik.touched.carbohidratos_g && formik.errors.carbohidratos_g
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-slate-100 text-slate-700 focus:border-brand-900 focus:bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Grasas (g)</label>
                      <input
                        type="number"
                        step="any"
                        {...formik.getFieldProps('grasas_g')}
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs font-black outline-none transition-all ${
                          formik.touched.grasas_g && formik.errors.grasas_g
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-slate-100 text-slate-700 focus:border-brand-900 focus:bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  {/* <hr className="border-gray-100 my-4" /> */}

                  <div className="flex items-center justify-between mt-4 mb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Etiquetas de Compatibilidad</h4>
                  </div>
                  {visibleTags.length === 0 ? (
                    <div className="w-full p-4 border border-dashed border-slate-200 rounded-lg text-center opacity-60 bg-white">
                      <Tag size={20} className="mx-auto mb-1 text-slate-400 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Seleccione una tipología para ver etiquetas aplicables
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {visibleTags.map(tag => {
                        const isSelected = formik.values.tags?.includes(tag.code);
                        return (
                          <button
                            key={tag.code}
                            type="button"
                            onClick={() => {
                              const newTags = isSelected
                                ? formik.values.tags.filter(t => t !== tag.code)
                                : [...(formik.values.tags || []), tag.code];
                              formik.setFieldValue('tags', newTags);
                            }}
                            className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5 ${
                              isSelected
                                ? `${tag.color} ring-2 ring-brand-900/10 scale-105 shadow-md`
                                : 'bg-white border-gray-150 text-slate-400 hover:border-brand-200 hover:bg-slate-50/50'
                            }`}
                          >
                            <Tag size={10} className={isSelected ? 'text-current' : 'text-slate-300'} />
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            </div>

            {/* Panel Central/Derecho: Ingredientes */}
            <div className="col-span-2 px-4 py-2 flex flex-col gap-6 overflow-hidden">

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
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black text-slate-700 uppercase leading-none">{item.nombre}</span>
                                  {((searchType === 'RUBRO' && item.es_alergeno) || (searchType === 'RECETA' && item.contiene_alergenos)) && (
                                    <span className="flex items-center gap-0.5 px-1 bg-amber-50 text-amber-700 border border-amber-200 text-[7px] font-black uppercase tracking-widest rounded-md animate-pulse">
                                      <AlertTriangle size={6} /> Alérgeno
                                    </span>
                                  )}
                                </div>
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
                      formik.values.ingredientes.map((ing, index) => {
                        const rubroInfo = ing.id_rubro ? rubros.find(r => r.id === ing.id_rubro) : null;
                        const subrecetaInfo = ing.id_sub_receta ? recetasDisponibles.find(r => r.id === ing.id_sub_receta) : null;
                        const esAlergeno = (rubroInfo?.es_alergeno) || (subrecetaInfo?.contiene_alergenos);

                        return (
                          <div key={index} className="flex items-center gap-4 bg-white p-2 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right-4 duration-300">
                            <span className="w-6 text-center text-xs font-bold text-slate-700 uppercase tracking-tight leading-none bg-brand-50 rounded-lg">{formik.values.ingredientes.length - index}</span>
                            <div className={`p-3 rounded-xl ${ing._tipo === 'RUBRO' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                              {ing._tipo === 'RUBRO' ? <Box size={16} /> : <Utensils size={16} />}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight leading-none">{ing._label}</p>
                                {esAlergeno && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[7px] font-black uppercase tracking-widest rounded-md animate-pulse">
                                    <AlertTriangle size={6} /> Alérgeno
                                  </span>
                                )}
                              </div>
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
                        );
                      })
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
