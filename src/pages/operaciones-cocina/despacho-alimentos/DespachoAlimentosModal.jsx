import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { X, ChefHat, Package, ClipboardList, Truck, Plus, Trash2, Scale, BoxSelect, Layers, Search, AlertCircle } from 'lucide-react';
import { getUtensiliosComedor, getProductosComedorParaDespacho, getRubrosConSaldoCocina, getRecetasPlanificadasYMaestro, guardarDespachoCocina } from '../../../services/despachoCocinaService';
import { getServiciosConfig } from '../../../services/planificacionService';
import { toast } from 'sonner';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';

const UNIDADES = ['KG', 'L', 'UND'];

const validationSchema = Yup.object().shape({
    id_comedor_destino:    Yup.string().required('El comedor destino es obligatorio'),
    id_tipo_servicio:      Yup.string().required('El servicio es obligatorio'),
    tipo_salida:           Yup.string().required(),
    comensales_estimados:  Yup.number().min(0).nullable(),
    personal_serco_estimado: Yup.number().min(0).nullable(),
    responsable_traslado:  Yup.string().when('tipo_salida', {
        is: (v) => v?.startsWith('CATERING'),
        then: () => Yup.string().required('El responsable es obligatorio para catering'),
        otherwise: () => Yup.string().nullable()
    }),
    placa_vehiculo: Yup.string().when('tipo_salida', {
        is: (v) => v?.startsWith('CATERING'),
        then: () => Yup.string().required('La placa es obligatoria para catering'),
        otherwise: () => Yup.string().nullable()
    }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getNombreItem = (item) => {
    if (!item) return '';
    const marca = item.producto?.marca?.nombre || '';
    const variedad = item.producto?.variedad || '';
    const rubro = item.producto?.rubro?.nombre || '';
    return [rubro, marca, variedad].filter(Boolean).join(' · ');
};

const getCategoriaItem = (item) => item?.producto?.rubro?.categoria?.nombre?.toUpperCase() || '';
const isRetornable = (item) => getCategoriaItem(item) === 'UTENSILIOS';

// ─── Componente ───────────────────────────────────────────────────────────────
export default function DespachoAlimentosModal({
    empresaActiva, perfil, sucursalOrigenId,
    comedores, servicios, comedorIdPre, servicioIdPre,
    fechaSelected, onClose, onUpdate
}) {
    // Catálogos
    const [utensilios, setUtensilios]               = useState([]);
    const [productosDisponibles, setProductosDisponibles] = useState([]);
    const [rubrosDisponibles, setRubrosDisponibles] = useState([]);
    const [recetasMaestro, setRecetasMaestro]       = useState([]);
    const [loadingCatalogos, setLoadingCatalogos]   = useState(false);
    const [serviciosDisponibles, setServiciosDisponibles] = useState(servicios || []);
    const [mostrarTodasLasRecetas, setMostrarTodasLasRecetas] = useState(false);

    const recetasFiltradas = useMemo(() => {
        if (mostrarTodasLasRecetas) return recetasMaestro;
        return recetasMaestro.filter(r => r.es_planificado === true);
    }, [recetasMaestro, mostrarTodasLasRecetas]);

    // ── Bloque A LINEA: cada ítem es { id_receta, receta_nombre, id_item_recipiente,
    //    item_nombre, peso_bruto, tara, raciones, id_grupo_bandeja:null }
    const [bloqueALinea, setBloqueALinea] = useState([]);
    const [tempALinea, setTempALinea]     = useState({
        id_receta: '', id_item_recipiente: '', raciones: '', peso_bruto: '', tara: ''
    });

    // ── Bloque A LINEA insumos aparte
    const [insumosAparte, setInsumosAparte]   = useState([]);
    const [tempInsumo, setTempInsumo]         = useState({ id_item: '', cantidad: '1', unidad: '--' });

    // ── Bloque A EMPACADO: grupos de bandejas
    //    cada grupo = { id_grupo (local), id_item_envase, envase_nombre, es_retornable, cantidad_bandejas,
    //                   composicion: [{id_receta, receta_nombre, porcion, unidad}] }
    const [gruposBandeja, setGruposBandeja]   = useState([]);
    const [tempGrupo, setTempGrupo]           = useState({ id_item_envase: '', cantidad_bandejas: '1' });
    const [tempComposicion, setTempComposicion] = useState({});  // { grupoIdx: { id_receta, porcion, unidad } }

    // ── Bloque B: Utensilios de servicio (retornables no asociados a receta)
    const [bloqueB, setBloqueB]   = useState([]);
    const [tempB, setTempB]       = useState({ id_item: '', cantidad: '1' });

    // IDs ya usados para evitar duplicados en B
    const usedItemIds = useMemo(() => new Set([
        ...bloqueALinea.filter(i => i.id_item_recipiente).map(i => String(i.id_item_recipiente)),
        ...gruposBandeja.map(g => String(g.id_item_envase)),
        ...bloqueB.map(i => String(i.id_item))
    ]), [bloqueALinea, gruposBandeja, bloqueB]);

    const comedoresSucursal = comedores.filter(c => c.id_sucursal == sucursalOrigenId);

    // ── Carga inicial de catálogos
    useEffect(() => {
        if (sucursalOrigenId && comedorIdPre) {
            cargarCatalogos(comedorIdPre);
        }
    }, [sucursalOrigenId, comedorIdPre]);

    useEffect(() => {
        if (comedorIdPre && servicioIdPre) {
            const fecha = fechaSelected || new Date().toISOString().split('T')[0];
            cargarRecetas(empresaActiva.id, fecha, comedorIdPre, servicioIdPre);
        }
    }, [comedorIdPre, servicioIdPre]);

    const cargarCatalogos = async (idComedor) => {
        setLoadingCatalogos(true);
        try {
            // Primero obtenemos los rubros que tienen saldo en cocina para este comedor
            const rubrosSaldo = await getRubrosConSaldoCocina(empresaActiva.id, idComedor);
            //console.log("Rubros con saldo en cocina:", rubrosSaldo);
            const rubrosIds = (rubrosSaldo || []).map(r => r.rubro?.id).filter(Boolean);

            const [uts, prods] = await Promise.all([
                getUtensiliosComedor(empresaActiva.id, sucursalOrigenId, idComedor),
                getProductosComedorParaDespacho(empresaActiva.id, sucursalOrigenId, idComedor, rubrosIds.length > 0 ? rubrosIds : null),
            ]);
            setUtensilios(uts);
            setProductosDisponibles(prods);
            setRubrosDisponibles(rubrosSaldo);
        } catch (e) {
            toast.error('Error al cargar inventario del comedor');
        } finally {
            setLoadingCatalogos(false);
        }
    };

    const cargarRecetas = async (idEmpresa, fecha, idComedor, idServicio) => {
        try {
            const data = await getRecetasPlanificadasYMaestro(idEmpresa, fecha, idComedor, idServicio);
            // filtrar primero: dejar solo elementos con unidad_medida !== null
            const filtered = (data || []).filter(item => item?.unidad_medida != null);

            // ordenar el array filtrado por tipologia.nombre y luego por nombre
            const sortedData = [...filtered].sort((a, b) => {
            const cmpTipologia = (a.tipologia?.nombre || "").localeCompare(b.tipologia?.nombre || "");
            if (cmpTipologia !== 0) return cmpTipologia;
            return (a?.nombre || "").localeCompare(b?.nombre || "");
            });
            setRecetasMaestro(sortedData);
        } catch (e) {
            toast.error('Error al cargar recetas del menú');
        }
    };

    const handleComedorChange = async (idComedor, setFieldValue) => {
        setFieldValue('id_comedor_destino', idComedor);
        setFieldValue('id_tipo_servicio', '');
        setRecetasMaestro([]);
        resetBloques();
        setUtensilios([]);
        setProductosDisponibles([]);
        setRubrosDisponibles([]);
        if (!idComedor) return;
        cargarCatalogos(idComedor);
        try {
            const svcs = await getServiciosConfig(idComedor);
            setServiciosDisponibles(svcs || []);
        } catch (e) { toast.error('Error al cargar servicios del comedor'); }
    };

    const handleServicioChange = async (idServicio, values, setFieldValue) => {
        setFieldValue('id_tipo_servicio', idServicio);
        if (!idServicio || !values.id_comedor_destino) return;
        const fecha = fechaSelected || new Date().toISOString().split('T')[0];
        cargarRecetas(empresaActiva.id, fecha, values.id_comedor_destino, idServicio);
    };

    const resetBloques = () => {
        setBloqueALinea([]); setInsumosAparte([]);
        setGruposBandeja([]); setBloqueB([]);
    };

    // ── Bloque A LINEA ────────────────────────────────────────────────────────
    // uomActual: unidad de medida de la receta seleccionada en tempALinea
    const uomActual = useMemo(() => {
        if (!tempALinea.id_receta) return '--';
        const receta = recetasMaestro.find(r => r.id == tempALinea.id_receta);
        return receta?.unidad_medida?.abreviatura || 'N/P';
    }, [tempALinea.id_receta, recetasMaestro]);

    // Recipientes de transporte: solo utensilios marcados como es_recipiente_transporte
    const recipientesTransporte = useMemo(() =>
        utensilios.filter(u => u.producto?.es_recipiente_transporte === true),
        [utensilios]
    );

    // Envases disponibles para empacado: utensilios o desechables
    const envasesDisponibles = useMemo(() => {
        return productosDisponibles.filter(p => {
            const cat = getCategoriaItem(p);
            return cat === 'UTENSILIOS' || cat.startsWith('DESECHABLE');
        });
    }, [productosDisponibles]);

    // Helper ATP: calcula cuántas unidades de un item ya fueron comprometidas en el despacho
    const cantidadYaUsada = (idItem) => {
        let total = 0;
        // Bloque A: recipientes
        bloqueALinea.forEach(r => { if (r.id_item_recipiente == idItem) total += 1; });
        // Bloque B
        bloqueB.forEach(b => { if (b.id_item == idItem) total += Number(b.cantidad); });
        return total;
    };

    const addBloqueALinea = () => {
        if (!tempALinea.id_receta) { toast.error('Seleccione una receta'); return; }
        const receta = recetasMaestro.find(r => r.id == tempALinea.id_receta);
        
        const racionesVal = Number(tempALinea.raciones) || 0;
        const brutoVal = Number(tempALinea.peso_bruto) || 0;
        const isKg = (receta?.unidad_medida?.abreviatura || receta?.unidad_medida_abreviatura) === 'KG';

        if (racionesVal <= 0) {
            toast.error('Debe ingresar las raciones estimadas (debe ser mayor a 0)');
            return;
        }
        if (brutoVal <= 0) {
            const labelCant = isKg ? 'el peso bruto' : 'la cantidad';
            toast.error(`Debe ingresar ${labelCant} (debe ser mayor a 0)`);
            return;
        }
        if (isKg) {
            const taraVal = Number(tempALinea.tara) || 0;
            if (brutoVal <= taraVal) {
                toast.error('El peso bruto debe ser mayor que la tara del recipiente');
                return;
            }
        }

        // Validación ATP para el recipiente
        if (tempALinea.id_item_recipiente) {
            const recipiente = recipientesTransporte.find(u => u.id == tempALinea.id_item_recipiente);
            const disponible = recipiente?.cantidad_actual || 0;
            const yaUsados = cantidadYaUsada(tempALinea.id_item_recipiente) + 1;
            if (yaUsados > disponible) {
                toast.error(`Stock insuficiente para "${getNombreItem(recipiente)}" (Máximo disponible: ${disponible} und.)`);
                return;
            }
        }

        setBloqueALinea(prev => [...prev, {
            id_receta:              Number(tempALinea.id_receta),
            receta_nombre:          receta?.nombre || '',
            unidad_medida:          receta?.unidad_medida?.abreviatura || receta?.unidad_medida_abreviatura || '--',
            id_item_recipiente:     tempALinea.id_item_recipiente ? Number(tempALinea.id_item_recipiente) : null,
            item_nombre:            tempALinea.id_item_recipiente
                ? getNombreItem(recipientesTransporte.find(u => u.id == tempALinea.id_item_recipiente))
                : null,
            raciones:               racionesVal,
            peso_bruto:             brutoVal,
            tara:                   isKg ? (Number(tempALinea.tara) || 0) : 0,
        }]);
        setTempALinea({ id_receta: '', id_item_recipiente: '', raciones: '', peso_bruto: '', tara: '' });
    };

    // ── Insumos Aparte ────────────────────────────────────────────────────────
    const addInsumoAparte = () => {
        if (!tempInsumo.id_item) { toast.error('Seleccione un producto del inventario'); return; }
        const item = productosDisponibles.find(p => p.id == tempInsumo.id_item);
        
        const rubroSaldo = rubrosDisponibles.find(r => {
            if (r.id_producto) {
                return r.id_producto === item?.producto?.id;
            } else {
                return r.rubro?.id === item?.producto?.rubro?.id;
            }
        });

        if (!rubroSaldo) {
            toast.error('No se encontró saldo registrado en cocina para este producto');
            return;
        }

        const cantidadNueva = Number(tempInsumo.cantidad) || 0;
        if (cantidadNueva <= 0) {
            toast.error('Ingrese una cantidad mayor a cero');
            return;
        }

        const yaAgregado = insumosAparte
            .filter(ins => {
                const insItem = productosDisponibles.find(p => p.id == ins.id_item);
                if (!insItem) return false;
                if (rubroSaldo.id_producto) {
                    return insItem.producto?.id === rubroSaldo.id_producto;
                } else {
                    return insItem.producto?.rubro?.id === rubroSaldo.rubro?.id;
                }
            })
            .reduce((sum, ins) => sum + ins.cantidad, 0);

        if (yaAgregado + cantidadNueva > rubroSaldo.cantidad) {
            toast.error(`Excede el saldo disponible en cocina (Saldo: ${rubroSaldo.cantidad}, Ya agregado: ${yaAgregado})`);
            return;
        }

        setInsumosAparte(prev => [...prev, {
            id_item:    Number(tempInsumo.id_item),
            item_nombre: getNombreItem(item),
            cantidad:   cantidadNueva,
            unidad:     tempInsumo.unidad,
        }]);
        setTempInsumo({ id_item: '', cantidad: '1', unidad: '--' });
    };

    // ── Grupos de Bandeja EMPACADO ────────────────────────────────────────────
    const addGrupoBandeja = () => {
        if (!tempGrupo.id_item_envase) { toast.error('Seleccione el tipo de envase'); return; }
        if (!tempGrupo.cantidad_bandejas || Number(tempGrupo.cantidad_bandejas) <= 0) {
            toast.error('Ingrese la cantidad de bandejas'); return;
        }
        const item = productosDisponibles.find(p => p.id == tempGrupo.id_item_envase);
        if (!item) { toast.error('Producto no encontrado'); return; }

        const isRet = isRetornable(item);
        let disponible = 0;
        if (isRet) {
            disponible = item.cantidad_actual || 0;
        } else {
            const rubroSaldo = rubrosDisponibles.find(r => {
                if (r.id_producto) {
                    return r.id_producto === item.producto?.id;
                } else {
                    return r.rubro?.id === item.producto?.rubro?.id;
                }
            });
            disponible = rubroSaldo ? rubroSaldo.cantidad : 0;
        }

        const yaAgregados = gruposBandeja
            .filter(g => g.id_item_envase === Number(tempGrupo.id_item_envase))
            .reduce((sum, g) => sum + g.cantidad_bandejas, 0);

        const cantidadNueva = Number(tempGrupo.cantidad_bandejas);
        if (yaAgregados + cantidadNueva > disponible) {
            toast.error(`Stock insuficiente para "${getNombreItem(item)}" (Máximo disponible: ${disponible}, Ya agregado: ${yaAgregados})`);
            return;
        }

        const nuevoGrupo = {
            id_grupo_local:    Date.now(),
            id_item_envase:    Number(tempGrupo.id_item_envase),
            envase_nombre:     getNombreItem(item),
            es_retornable:     isRet,
            cantidad_bandejas: cantidadNueva,
            composicion:       []
        };
        setGruposBandeja(prev => [...prev, nuevoGrupo]);
        setTempGrupo({ id_item_envase: '', cantidad_bandejas: '1' });
    };

    const addComposicionGrupo = (grupoLocalId) => {
        const comp = tempComposicion[grupoLocalId] || {};
        if (!comp.id_receta) { toast.error('Seleccione una receta para la composición'); return; }
        if (!comp.porcion || Number(comp.porcion) <= 0) { toast.error('Ingrese una porción válida'); return; }
        const receta = recetasMaestro.find(r => r.id == comp.id_receta);
        setGruposBandeja(prev => prev.map(g => {
            if (g.id_grupo_local !== grupoLocalId) return g;
            if (g.composicion.some(c => c.id_receta == comp.id_receta)) {
                toast.error('Esta receta ya está en la composición del grupo'); return g;
            }
            return {
                ...g,
                composicion: [...g.composicion, {
                    id_receta:     Number(comp.id_receta),
                    receta_nombre: receta?.nombre || '',
                    porcion:       Number(comp.porcion),
                    unidad:        comp.unidad || '--'
                }]
            };
        }));
        setTempComposicion(prev => ({ ...prev, [grupoLocalId]: { id_receta: '', porcion: '', unidad: '--' } }));
    };

    const removeComposicionGrupo = (grupoLocalId, recetaId) => {
        setGruposBandeja(prev => prev.map(g =>
            g.id_grupo_local === grupoLocalId
                ? { ...g, composicion: g.composicion.filter(c => c.id_receta !== recetaId) }
                : g
        ));
    };

    // ── Bloque B ──────────────────────────────────────────────────────────────
    const addBloqueB = () => {
        if (!tempB.id_item) { toast.error('Seleccione un utensilio'); return; }
        if (usedItemIds.has(String(tempB.id_item))) { toast.error('Este ítem ya está en el despacho'); return; }
        const item = utensilios.find(u => u.id == tempB.id_item);
        // Validación ATP
        const disponible = item?.cantidad_actual || 0;
        const yaUsados = cantidadYaUsada(tempB.id_item) + Number(tempB.cantidad);
        if (yaUsados > disponible) {
            toast.error(`Stock insuficiente para "${getNombreItem(item)}" (Máximo disponible: ${disponible} und.)`);
            return;
        }
        setBloqueB(prev => [...prev, {
            id_item:     Number(tempB.id_item),
            item_nombre: getNombreItem(item),
            cantidad:    Number(tempB.cantidad) || 1,
        }]);
        setTempB({ id_item: '', cantidad: '1' });
    };

    // Bloque C eliminado

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleFormSubmit = async (values, { setSubmitting }) => {
        const esLinea = values.tipo_salida === 'LINEA' || values.tipo_salida === 'CATERING_LINEA';

        // Validación unificada para asegurar que hay al menos un ítem agregado
        const totalItems = bloqueALinea.length + insumosAparte.length + (!esLinea ? gruposBandeja.length : 0) + bloqueB.length;
        if (totalItems === 0) {
            toast.error('Debe añadir al menos un ítem al despacho');
            setSubmitting(false);
            return;
        }
        if (!esLinea && gruposBandeja.some(g => g.composicion.length === 0)) {
            toast.error('Todos los grupos de bandejas deben tener al menos una receta en su composición');
            setSubmitting(false); return;
        }

        try {
            const cabecera = {
                id_empresa:              empresaActiva.id,
                id_sucursal_origen:      sucursalOrigenId,
                id_comedor_destino:      values.id_comedor_destino,
                id_tipo_servicio:        values.id_tipo_servicio,
                tipo_salida:             values.tipo_salida,
                comensales_estimados:    Number(values.comensales_estimados),
                personal_serco_estimado: Number(values.personal_serco_estimado),
                responsable_traslado:    values.responsable_traslado || null,
                cargo_responsable:       values.cargo_responsable || null,
                tipo_vehiculo:           values.tipo_vehiculo || null,
                placa_vehiculo:          values.placa_vehiculo || null,
                ruta_entrega:            values.ruta_entrega || null,
                hora_contratada:         values.hora_contratada || null,
                id_usuario_create:       perfil.id
            };

            const detalles = [];

            // 1. Alimentos en Recipientes (Granel) - Disponible en todos los modos
            bloqueALinea.forEach(item => {
                detalles.push({
                    bloque_tipo:                'RECETA',
                    id_receta:                  item.id_receta,
                    id_item_inventario_comedor: item.id_item_recipiente || null,
                    raciones_despachadas:        item.raciones,
                    peso_bruto:                 item.peso_bruto,
                    tara:                       item.unidad_medida === 'KG' ? item.tara : 0,
                    volumen_despachado:         item.unidad_medida === 'KG'
                        ? (item.peso_bruto && item.tara ? parseFloat((item.peso_bruto - item.tara).toFixed(3)) : null)
                        : item.peso_bruto,
                    unidad_volumen:             item.unidad_medida || '--',
                    cantidad_despachada:        1,
                    es_insumo_aparte:           false,
                });
            });

            // 2. Insumos Aparte - Disponible en todos los modos
            insumosAparte.forEach(item => {
                detalles.push({
                    bloque_tipo:                'RECETA',
                    id_item_inventario_comedor: item.id_item,
                    cantidad_despachada:        item.cantidad,
                    unidad_volumen:             item.unidad,
                    es_insumo_aparte:           true,
                });
            });

            // 3. Envases y Menú Empacado (solo si no es línea y hay grupos creados)
            if (!esLinea) {
                gruposBandeja.forEach((grupo, gIdx) => {
                    const grupoNum = gIdx + 1;
                    // Fila del envase
                    detalles.push({
                        bloque_tipo:                'RECETA',
                        id_item_inventario_comedor: grupo.id_item_envase,
                        cantidad_despachada:        grupo.cantidad_bandejas,
                        id_grupo_bandeja:           grupoNum,
                        es_insumo_aparte:           false,
                    });
                    // Filas de composición (recetas dentro de la bandeja)
                    grupo.composicion.forEach(comp => {
                        detalles.push({
                            bloque_tipo:          'RECETA',
                            id_receta:            comp.id_receta,
                            cantidad_despachada:  parseFloat((grupo.cantidad_bandejas * comp.porcion).toFixed(3)),
                            volumen_despachado:   parseFloat((grupo.cantidad_bandejas * comp.porcion).toFixed(3)),
                            unidad_volumen:       comp.unidad,
                            cantidad_bandejas:    grupo.cantidad_bandejas,
                            id_grupo_bandeja:     grupoNum,
                            es_insumo_aparte:     false,
                        });
                    });
                });
            }

            // Bloque B
            bloqueB.forEach(item => {
                detalles.push({
                    bloque_tipo:                'UTENSILIO',
                    id_item_inventario_comedor: item.id_item,
                    cantidad_despachada:        item.cantidad,
                });
            });

            await guardarDespachoCocina(cabecera, detalles);
            toast.success('Guía de despacho registrada en BORRADOR');
            onUpdate(); onClose();
        } catch (error) {
            toast.error('Error al registrar despacho: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const esLinea = (tipoSalida) => tipoSalida === 'LINEA' || tipoSalida === 'CATERING_LINEA';

    // ── Render ────────────────────────────────────────────────────────────────
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white rounded-md w-full max-w-[98vw] max-h-[95vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative shrink-0">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-900 text-white rounded-md shadow-xl shadow-brand-900/20">
                            <ChefHat size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Crear Guía de Despacho</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest italic mt-0.5">
                                {comedores.find(c => c.id == comedorIdPre)?.nombre} · {servicios.find(s => s.id == servicioIdPre)?.nombre}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <Formik
                    initialValues={{
                        id_comedor_destino:      comedorIdPre || '',
                        id_tipo_servicio:        servicioIdPre || '',
                        tipo_salida:             'LINEA',
                        comensales_estimados:    '0',
                        personal_serco_estimado: '0',
                        responsable_traslado:    '',
                        cargo_responsable:       'CHOFER',
                        tipo_vehiculo:           'CAMIONETA',
                        placa_vehiculo:          '',
                        ruta_entrega:            '',
                        hora_contratada:         ''
                    }}
                    validationSchema={validationSchema}
                    onSubmit={handleFormSubmit}
                >
                    {({ values, setFieldValue, isSubmitting }) => (
                        <Form className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/50">

                                {/* ── Bloque Contexto ── */}
                                <div className="bg-white p-5 rounded-md border border-gray-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-900 border-b pb-2 mb-4 flex items-center gap-2">
                                        <ClipboardList size={13} /> Contexto del Servicio
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Salida</label>
                                            <Field as="select" name="tipo_salida"
                                                className="text-xs font-bold text-brand-900 bg-brand-50 p-2.5 rounded-lg border border-brand-100 outline-none focus:border-brand-500 uppercase tracking-widest"
                                                onChange={(e) => { setFieldValue('tipo_salida', e.target.value); resetBloques(); }}
                                            >
                                                <option value="LINEA">Línea (In Situ)</option>
                                                <option value="EMPACADO">Empacado (In Situ)</option>
                                                <option value="CATERING_LINEA">Catering Línea</option>
                                                <option value="CATERING_EMPACADO">Catering Empacado</option>
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Logística Catering (condicional) ── */}
                                {values.tipo_salida.startsWith('CATERING') && (
                                    <div className="bg-white p-5 rounded-md border border-amber-100 shadow-sm animate-in slide-in-from-top-3 duration-300">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-2">
                                            <Truck size={13} /> Logística de Transporte
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Responsable / Chofer</label>
                                                <Field type="text" name="responsable_traslado" placeholder="Nombre completo"
                                                    className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                                <ErrorMessage name="responsable_traslado" component="span" className="text-[9px] text-red-500 font-bold" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Cargo</label>
                                                <Field type="text" name="cargo_responsable"
                                                    className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Placa Vehículo</label>
                                                <Field type="text" name="placa_vehiculo" placeholder="Ej: AB123CD"
                                                    className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                                <ErrorMessage name="placa_vehiculo" component="span" className="text-[9px] text-red-500 font-bold" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Hora Contratada</label>
                                                <Field type="time" name="hora_contratada"
                                                    className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Ruta / Dirección de Entrega</label>
                                            <Field type="text" name="ruta_entrega" placeholder="Ej: Planta Remota Zona A"
                                                className="mt-1 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500 w-full" />
                                        </div>
                                    </div>
                                )}

                                {/* ════════════ ALIMENTOS EN RECIPIENTES / GRANEL ════════════ */}
                                <div className="bg-white p-4 rounded-md border border-orange-100 shadow-sm space-y-3">                                            
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Scale size={16} /></div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                {esLinea(values.tipo_salida) ? 'Bloque A — Alimentos en Recipientes (Granel)' : 'Alimentos / Bebidas a Granel (Opcional)'}
                                            </h4>
                                            <p className="text-[9px] text-slate-400 italic">Receta → Recipiente de Transporte → Peso Bruto → Tara → Neto calculado</p>
                                        </div>
                                    </div>

                                    {/* Lista Bloque A LINEA */}
                                    {bloqueALinea.length > 0 && (
                                        <div className="border border-slate-100 rounded-md overflow-hidden">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                                                        <th className="px-4 py-2">Receta</th>
                                                        <th className="px-4 py-2">Recipiente</th>
                                                        <th className="px-4 py-2 text-center">Raciones</th>
                                                        <th className="px-4 py-2 text-center">Bruto</th>
                                                        <th className="px-4 py-2 text-center">Tara</th>
                                                        <th className="px-4 py-2 text-center text-emerald-600">Neto</th>
                                                        <th className="px-4 py-2 text-right">Quitar</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {bloqueALinea.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2 font-bold text-slate-700 uppercase">{item.receta_nombre}</td>
                                                            <td className="px-4 py-2 text-slate-500 text-[10px]">
                                                                {item.item_nombre
                                                                    ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">{item.item_nombre}</span>
                                                                    : <span className="text-slate-300 italic">Desechable</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-black text-slate-600">{item.raciones || '—'}</td>
                                                            <td className="px-4 py-2 text-center font-black text-slate-600">{item.peso_bruto ? `${formatNumber(item.peso_bruto, getDecimalPlaces(item.peso_bruto))} ${item.unidad_medida || '--'}` : '—'}</td>
                                                            <td className="px-4 py-2 text-center font-black text-slate-400">
                                                                {item.unidad_medida === 'KG' && item.tara ? `${formatNumber(item.tara, getDecimalPlaces(item.tara))} KG` : '—'}
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-black text-emerald-600">
                                                                {item.unidad_medida === 'KG'
                                                                    ? (item.peso_bruto && item.tara 
                                                                        ? (() => {
                                                                            const val = item.peso_bruto - item.tara;
                                                                            return `${formatNumber(val, getDecimalPlaces(val))} KG`;
                                                                            })()
                                                                        : '—')
                                                                    : `${formatNumber(item.peso_bruto, getDecimalPlaces(item.peso_bruto))} ${item.unidad_medida || '--'}`
                                                                }
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <button type="button" onClick={() => setBloqueALinea(p => p.filter((_, idx) => idx !== i))}
                                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {/* Fila de adición */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end bg-slate-50 p-1 rounded-lg border border-slate-100">
                                        <div className="flex flex-col gap-1 md:col-span-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Receta / Plato</label>
                                                <label className="flex items-center gap-1 text-[9px] font-black text-slate-500 cursor-pointer select-none">
                                                    <input type="checkbox" checked={mostrarTodasLasRecetas} onChange={e => setMostrarTodasLasRecetas(e.target.checked)} className="rounded text-brand-900 focus:ring-brand-500 h-3 w-3" />
                                                    Fuera de Menú
                                                </label>
                                            </div>
                                            <select value={tempALinea.id_receta}
                                                onChange={e => setTempALinea(p => ({ ...p, id_receta: e.target.value }))}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                <option value="">-- SELECCIONAR RECETA --</option>
                                                                                                        {recetasFiltradas.map(r => {
                                                    const yaAgregado = bloqueALinea.some(item => Number(item.id_receta) === Number(r.id));
                                                    return (
                                                        <option key={r.id} value={r.id} disabled={yaAgregado} className={yaAgregado ? "text-slate-300" : ""}>
                                                            {r.es_planificado ? '⭐ ' : ''}{r.nombre} ( [{r.codigo_ficha}] {r.tipologia.nombre} )  {yaAgregado ? '(Ya agregado)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1 md:col-span-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Recipiente (Utensilio de Transporte)</label>
                                            <select value={tempALinea.id_item_recipiente}
                                                onChange={e => {
                                                    const idRec = e.target.value;
                                                    const recipiente = recipientesTransporte.find(u => u.id == idRec);
                                                    setTempALinea(p => ({
                                                        ...p,
                                                        id_item_recipiente: idRec,
                                                        // Autocompletar tara desde el producto maestro
                                                        tara: idRec && recipiente?.producto?.peso_tara_estandar
                                                            ? String(recipiente.producto.peso_tara_estandar)
                                                            : p.tara
                                                    }));
                                                }}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                <option value="">-- NINGUNO (Desechable) --</option>
                                                {recipientesTransporte.map(u => {
                                                    const yaUsados = cantidadYaUsada(u.id);
                                                    const disponible = u.cantidad_actual - yaUsados;
                                                    return (
                                                        <option key={u.id} value={u.id} disabled={disponible <= 0} className={disponible <= 0 ? "text-slate-300" : ""}>
                                                            {getNombreItem(u)} [{disponible} disp.]
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2 items-end bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Raciones Est.</label>
                                                <input type="number" placeholder="Ej: 50" value={tempALinea.raciones}
                                                    onChange={e => setTempALinea(p => ({ ...p, raciones: e.target.value }))}
                                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">
                                                    {uomActual === 'KG' ? `Peso Bruto (KG)` : `Cantidad (${uomActual})`}
                                                </label>
                                                <input type="number" step="0.001" placeholder="Ej: 12.5" value={tempALinea.peso_bruto}
                                                    onChange={e => setTempALinea(p => ({ ...p, peso_bruto: e.target.value }))}
                                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">
                                                    Tara (${uomActual})
                                                    {uomActual === 'KG' && tempALinea.id_item_recipiente && (
                                                        <span className="ml-1 text-brand-500 font-bold normal-case">(auto)</span>
                                                    )}
                                                </label>
                                                <input type="number" placeholder={uomActual === 'KG' ? "Ej: 2.0" : "No aplica"} value={uomActual === 'KG' ? tempALinea.tara : ''}
                                                    disabled={uomActual !== 'KG'}
                                                    onChange={e => setTempALinea(p => ({ ...p, tara: e.target.value }))}
                                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-400" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Neto Calculado</label>
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs font-black text-emerald-700">
                                                    {uomActual === 'KG'
                                                        ? (tempALinea.peso_bruto && tempALinea.tara
                                                            ? (() => {
                                                                const val = Number(tempALinea.peso_bruto) - Number(tempALinea.tara);
                                                                return `${formatNumber(val, getDecimalPlaces(val))} KG`;
                                                            })()
                                                            : `0 KG`)
                                                        : (tempALinea.peso_bruto
                                                            ? (() => {
                                                                const val = Number(tempALinea.peso_bruto);
                                                                return `${formatNumber(val, getDecimalPlaces(val))} ${uomActual}`;
                                                            })()
                                                            : `0 ${uomActual}`)
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-full flex justify-end">
                                            <button type="button" onClick={addBloqueALinea}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-black uppercase hover:bg-orange-600 active:scale-95 transition-all">
                                                <Plus size={14} /> Añadir Receta
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ════════════ BLOQUE A — Modo EMPACADO ════════════ */}
                                {!esLinea(values.tipo_salida) && (
                                    <div className="bg-white p-4 rounded-md border border-purple-100 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><BoxSelect size={16} /></div>
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Bloque A — Envases y Menú Empacado</h4>
                                                    <p className="text-[9px] text-slate-400 italic">
                                                        Cree un grupo por cada envase independiente. Ej: Grupo 1 (Bandeja de Anime) para el Seco, Grupo 2 (Vaso) para la Sopa.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Añadir grupo */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Envase (del inventario)</label>
                                                <select value={tempGrupo.id_item_envase}
                                                    onChange={e => setTempGrupo(p => ({ ...p, id_item_envase: e.target.value }))}
                                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                    <option value="">-- TIPO DE ENVASE --</option>
                                                    {envasesDisponibles.map(p => {
                                                        const isRet = isRetornable(p);
                                                        let cantidadDisp = 0;
                                                        if (isRet) {
                                                            cantidadDisp = p.cantidad_actual || 0;
                                                        } else {
                                                            const rubroSaldo = rubrosDisponibles.find(r => {
                                                                if (r.id_producto) {
                                                                    return r.id_producto === p.producto?.id;
                                                                } else {
                                                                    return r.rubro?.id === p.producto?.rubro?.id;
                                                                }
                                                            });
                                                            cantidadDisp = rubroSaldo ? rubroSaldo.cantidad : 0;
                                                        }

                                                        const yaUsadoEnGrupos = gruposBandeja
                                                            .filter(g => g.id_item_envase === p.id)
                                                            .reduce((sum, g) => sum + g.cantidad_bandejas, 0);

                                                        const disponibleReal = Math.max(0, cantidadDisp - yaUsadoEnGrupos);

                                                        return (
                                                            <option key={p.id} value={p.id} disabled={disponibleReal <= 0} className={disponibleReal <= 0 ? "text-slate-300" : ""}>
                                                                {isRet ? '↩ (Retornable) ' : '🗑️ (Desechable) '} {getNombreItem(p)} [{disponibleReal} disp.]
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad de Bandejas</label>
                                                <input type="number" min="1" value={tempGrupo.cantidad_bandejas}
                                                    onChange={e => setTempGrupo(p => ({ ...p, cantidad_bandejas: e.target.value }))}
                                                    className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                            </div>
                                            <button type="button" onClick={addGrupoBandeja}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-xs font-black uppercase hover:bg-purple-700 active:scale-95 transition-all">
                                                <Plus size={14} /> Agregar Grupo
                                            </button>
                                        </div>

                                        {/* Grupos creados */}
                                        {gruposBandeja.map((grupo, gIdx) => {
                                            const compTemp = tempComposicion[grupo.id_grupo_local] || { id_receta: '', porcion: '', unidad: '--' };
                                            return (
                                                <div key={grupo.id_grupo_local} className="border border-purple-100 rounded-md overflow-hidden">
                                                    <div className="bg-purple-50 px-4 py-2 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Layers size={13} className="text-purple-600" />
                                                            <span className="text-xs font-black text-purple-900 uppercase">
                                                                Grupo {gIdx + 1}: {grupo.envase_nombre}
                                                                {grupo.es_retornable && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[8px]">RETORNABLE</span>}
                                                            </span>
                                                            <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full text-[9px] font-black">{grupo.cantidad_bandejas} UND</span>
                                                        </div>
                                                        <button type="button" onClick={() => setGruposBandeja(p => p.filter(g => g.id_grupo_local !== grupo.id_grupo_local))}
                                                            className="text-red-400 hover:text-red-600 p-1 rounded transition-all">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                    {/* Composición */}
                                                    <div className="p-3 space-y-2">
                                                        {grupo.composicion.length > 0 && (
                                                            <table className="w-full text-left text-xs border-collapse">
                                                                <thead>
                                                                    <tr className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                                                                        <th className="px-3 py-1">Receta</th>
                                                                        <th className="px-3 py-1 text-center">Porción/Bandeja</th>
                                                                        <th className="px-3 py-1 text-center text-emerald-600">Total ({grupo.cantidad_bandejas} band.)</th>
                                                                        <th className="px-3 py-1 text-right">Quitar</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {grupo.composicion.map((comp, ci) => (
                                                                        <tr key={ci} className="hover:bg-slate-50/50 border-b border-slate-50">
                                                                            <td className="px-3 py-1.5 font-bold text-slate-700 uppercase">{comp.receta_nombre}</td>
                                                                            <td className="px-3 py-1.5 text-center font-black text-slate-600">{formatNumber(comp.porcion, getDecimalPlaces(comp.porcion))} {comp.unidad}</td>
                                                                            <td className="px-3 py-1.5 text-center font-black text-emerald-600">
                                                                                {(() => {
                                                                                    const val = grupo.cantidad_bandejas * comp.porcion;
                                                                                    return `${formatNumber(val, getDecimalPlaces(val))} ${comp.unidad}`;
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-3 py-1.5 text-right">
                                                                                <button type="button" onClick={() => removeComposicionGrupo(grupo.id_grupo_local, comp.id_receta)}
                                                                                    className="text-red-400 hover:text-red-600 p-1 rounded transition-all">
                                                                                    <Trash2 size={12} />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                        {grupo.composicion.length === 0 && (
                                                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg">
                                                                <AlertCircle size={13} />
                                                                <span className="text-[9px] font-black uppercase">Agregue al menos una receta a la composición</span>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase">Receta</label>
                                                                    <label className="flex items-center gap-1 text-[9px] font-black text-slate-500 cursor-pointer select-none">
                                                                        <input type="checkbox" checked={mostrarTodasLasRecetas} onChange={e => setMostrarTodasLasRecetas(e.target.checked)} className="rounded text-brand-900 focus:ring-brand-500 h-3 w-3" />
                                                                        Fuera de Menú
                                                                    </label>
                                                                </div>
                                                                <select value={compTemp.id_receta}
                                                                    onChange={e => {
                                                                        const recId = e.target.value;
                                                                        const receta = recetasMaestro.find(r => r.id == recId);
                                                                        const uom = receta?.unidad_medida?.abreviatura || receta?.unidad_medida_abreviatura || '--';
                                                                        setTempComposicion(p => ({
                                                                            ...p,
                                                                            [grupo.id_grupo_local]: {
                                                                                ...compTemp,
                                                                                id_receta: recId,
                                                                                unidad: uom
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                                    <option value="">-- RECETA --</option>
                                                                    {recetasFiltradas.map(r => {
                                                                        const yaAgregado = grupo.composicion.some(c => Number(c.id_receta) === Number(r.id));
                                                                        return (
                                                                            <option key={r.id} value={r.id} disabled={yaAgregado} className={yaAgregado ? "text-slate-300" : ""}>
                                                                                {/* {r.es_planificado ? '⭐ ' : ''}{r.nombre} [{r.codigo_ficha}] {} {yaAgregado ? '(Ya agregado)' : ''} */}
                                                                                {r.es_planificado ? '⭐ ' : ''}{r.nombre} ( [{r.codigo_ficha}] {r.tipologia.nombre} )  {yaAgregado ? '(Ya agregado)' : ''}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase">Porción/Bandeja</label>
                                                                <input type="number" step="0.001" placeholder="Ej: 0.22" value={compTemp.porcion}
                                                                    onChange={e => setTempComposicion(p => ({ ...p, [grupo.id_grupo_local]: { ...compTemp, porcion: e.target.value } }))}
                                                                    className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase">Unidad</label>
                                                                <select value={compTemp.unidad || '--'}
                                                                    onChange={e => setTempComposicion(p => ({ ...p, [grupo.id_grupo_local]: { ...compTemp, unidad: e.target.value } }))}
                                                                    className="hidden text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-gray-200 outline-none">
                                                                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                                                </select>
                                                                <span className="text-xs font-bold text-slate-700 bg-white p-1.5 rounded-lg outline-none">{compTemp.unidad}</span>
                                                            </div>
                                                            <button type="button" onClick={() => addComposicionGrupo(grupo.id_grupo_local)}
                                                                className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg text-xs font-black uppercase hover:bg-purple-600 active:scale-95 transition-all">
                                                                <Plus size={12} /> Añadir
                                                            </button>
                                                        </div>
                                                        
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Sub-bloque: Insumos Aparte */}
                                <div className="bg-white p-4 rounded-md border border-orange-100 shadow-sm space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Package size={16} /></div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Insumos Aparte</h4>
                                            <p className="text-[9px] text-slate-400 italic">Insumos que acompañan al menú pero se despachan en envase separado (queso, hielo, salsas...)</p>
                                        </div>
                                    </div>
                                    {insumosAparte.length > 0 && (
                                        <div className="border border-slate-100 rounded-md overflow-hidden">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                                                        <th className="px-4 py-2">Producto</th>
                                                        <th className="px-4 py-2 text-center">Cantidad</th>
                                                        <th className="px-4 py-2 text-right">Quitar</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {insumosAparte.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2 font-bold text-slate-700 uppercase">{item.item_nombre}</td>
                                                            <td className="px-4 py-2 text-center font-black text-slate-600">{formatNumber(item.cantidad, getDecimalPlaces(item.cantidad))} {item.unidad}</td>
                                                            <td className="px-4 py-2 text-right">
                                                                <button type="button" onClick={() => setInsumosAparte(p => p.filter((_, idx) => idx !== i))}
                                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex flex-col gap-1 md:col-span-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Producto del Inventario</label>
                                            <select value={tempInsumo.id_item}
                                                onChange={e => {
                                                    const itemId = e.target.value;
                                                    const item = productosDisponibles.find(p => p.id == itemId);
                                                    const unidadAbr = item?.producto?.rubro?.unidad_medida?.abreviatura || '--';
                                                    setTempInsumo(p => ({
                                                        ...p,
                                                        id_item: itemId,
                                                        unidad: unidadAbr
                                                    }));
                                                }}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                <option value="">-- SELECCIONE --</option>
                                                {rubrosDisponibles.length > 0 ? (
                                                    rubrosDisponibles.map(r => {
                                                        const productsInRubro = productosDisponibles.filter(p => {
                                                            if (r.id_producto) {
                                                                return p.producto?.id === r.id_producto;
                                                            } else {
                                                                return p.producto?.rubro?.id === r.rubro?.id;
                                                            }
                                                        });
                                                        if (productsInRubro.length === 0) return null;

                                                        const isDesechable = productsInRubro.some(p => getCategoriaItem(p).startsWith('DESECHABLE'));

                                                        if (isDesechable) {
                                                            return (
                                                                <optgroup key={r.id_producto ? `${r.rubro?.id}-${r.id_producto}` : r.rubro?.id} label={`${r.rubro?.nombre?.toUpperCase()} [Saldo Cocina: ${r.cantidad}]`} className="font-bold text-slate-500">
                                                                    {productsInRubro.map(p => {
                                                                            const yaAgregado = insumosAparte.some(ins => Number(ins.id_item) === Number(p.id));
                                                                            return (
                                                                                <option key={p.id} value={p.id} disabled={yaAgregado} className={yaAgregado ? "text-slate-300 font-normal" : "font-normal text-slate-700"}>
                                                                                    {getNombreItem(p)} [Saldo Cocina: {r.cantidad}] {yaAgregado ? '(Ya agregado)' : ''}
                                                                                </option>
                                                                            );
                                                                        })}
                                                                </optgroup>
                                                            );
                                                        } else {
                                                                const yaAgregadoGlobal = insumosAparte.some(ins => Number(ins.id_item) === Number(productsInRubro[0].id));
                                                                return (
                                                                    <option key={r.rubro?.id} value={productsInRubro[0].id} disabled={yaAgregadoGlobal} className={yaAgregadoGlobal ? "text-slate-300 font-bold" : "font-bold text-slate-700"}>
                                                                        {r.rubro?.nombre?.toUpperCase()} [Saldo Cocina: {r.cantidad}] {yaAgregadoGlobal ? '(Ya agregado)' : ''}
                                                                    </option>
                                                                );
                                                            }
                                                    })
                                                ) : (
                                                        productosDisponibles.map(p => {
                                                            const yaAgregadoFallback = insumosAparte.some(ins => Number(ins.id_item) === Number(p.id));
                                                            return (
                                                                <option key={p.id} value={p.id} disabled={yaAgregadoFallback} className={yaAgregadoFallback ? "text-slate-300" : ""}>
                                                                    {getNombreItem(p)} [{p.cantidad_actual} disp.] {yaAgregadoFallback ? '(Ya agregado)' : ''}
                                                                </option>
                                                            );
                                                        })
                                                    )}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad</label>
                                            <input type="number" step="0.01" value={tempInsumo.cantidad}
                                                onChange={e => setTempInsumo(p => ({ ...p, cantidad: e.target.value }))}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Unidad</label>
                                            <select value={tempInsumo.unidad}
                                                onChange={e => setTempInsumo(p => ({ ...p, unidad: e.target.value }))}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="button" onClick={addInsumoAparte}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-black uppercase hover:bg-amber-600 active:scale-95 transition-all">
                                                <Plus size={14} /> Añadir
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ════════════ BLOQUE B — Utensilios ════════════ */}
                                <div className="bg-white p-4 rounded-md border border-blue-100 shadow-sm space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package size={16} /></div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Bloque B — Utensilios y Equipos Retornables</h4>
                                            <p className="text-[9px] text-slate-400 italic">Herramientas de servicio vacías (cucharones, pinzas, equipos de servir) — obligación de retorno</p>
                                        </div>
                                    </div>
                                    {bloqueB.length > 0 && (
                                        <div className="border border-slate-100 rounded-md overflow-hidden">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                                                        <th className="px-4 py-2">Utensilio</th>
                                                        <th className="px-4 py-2 text-center">Cantidad</th>
                                                        <th className="px-4 py-2 text-center">Retornable</th>
                                                        <th className="px-4 py-2 text-right">Quitar</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {bloqueB.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2 font-bold text-slate-700 uppercase">{item.item_nombre}</td>
                                                            <td className="px-4 py-2 text-center font-black text-slate-600">{item.cantidad}</td>
                                                            <td className="px-4 py-2 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black border border-blue-200">SÍ</span></td>
                                                            <td className="px-4 py-2 text-right">
                                                                <button type="button" onClick={() => setBloqueB(p => p.filter((_, idx) => idx !== i))}
                                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex flex-col gap-1 md:col-span-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Utensilio / Equipo</label>
                                            <select value={tempB.id_item}
                                                onChange={e => setTempB(p => ({ ...p, id_item: e.target.value }))}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500">
                                                <option value="">-- SELECCIONE UTENSILIO --</option>
                                                {utensilios.filter(u => !usedItemIds.has(String(u.id))).map(u => (
                                                    <option key={u.id} value={u.id}>{getNombreItem(u)} [{u.cantidad_actual} disp.]</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad</label>
                                            <input type="number" min="1" value={tempB.cantidad}
                                                onChange={e => setTempB(p => ({ ...p, cantidad: e.target.value }))}
                                                className="text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-gray-200 outline-none focus:border-brand-500" />
                                        </div>
                                        <button type="button" onClick={addBloqueB}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase hover:bg-blue-700 active:scale-95 transition-all">
                                            <Plus size={14} /> Añadir
                                        </button>
                                    </div>
                                </div>

                                {/* Bloque C eliminado */}

                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button type="button" onClick={onClose}
                                    className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs font-black uppercase hover:bg-slate-50 active:scale-95 transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-6 py-3 bg-brand-900 text-white rounded-lg text-xs font-black uppercase shadow-xl shadow-brand-900/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                                    {isSubmitting ? 'Registrando...' : 'Registrar Guía (Borrador)'}
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
