import { getDiasRestantes, getDateOnly } from "./workDate";
import { getDecimalPlaces, formatNumber } from './workDecimales';

/**
 * Verifica si un lote está vencido
 */
export const esLoteVencido = (fecha_vencimiento: string | Date | null): boolean => {
    if (!fecha_vencimiento) return false;
    const dateStr = typeof fecha_vencimiento === 'string' ? fecha_vencimiento : getDateOnly(fecha_vencimiento);
    const dias = getDiasRestantes(dateStr);
    return dias !== null && dias <= 0;
};

/**
 * Devuelve un Badge visual con el estado de vencimiento
 */
export const getExpirationBadge = (fecha: string | Date | null): React.ReactNode => {
    if (!fecha) return null;
    const dateStr = typeof fecha === 'string' ? fecha : getDateOnly(fecha);
    const dias = getDiasRestantes(dateStr);
    if (dias === null) return null;

    let color = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    let text = `Vence en ${dias} d`;

    if (dias <= 0) {
        color = 'bg-red-50 text-red-600 border border-red-100 animate-pulse';
        text = '¡VENCIDO!';
    } else if (dias <= 30) {
        color = 'bg-yellow-50 text-yellow-600 border border-yellow-100';
    } else if (dias <= 60) {
        color = 'bg-amber-50 text-amber-600 border border-amber-100';
    } else if (dias <= 120) {
        color = 'bg-orange-50 text-orange-600 border border-orange-100';
    } else if (dias <= 180) {
        color = 'bg-blue-50 text-blue-600 border border-blue-100';
    } else if (dias <= 360) {
        color = 'bg-purple-50 text-purple-600 border border-purple-100';
    }

    return (
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${color}`}>
            {text}
        </span>
    );
};

interface LogisticaItem {
    id?: number | string;
    factor: number | string;
    es_base?: boolean;
    presentacion?: {
        nombre: string;
    };
    orden?: number;
}

/**
 * Calcula el desglose logístico consolidado (ej: 10 BULTO + 5 PAQ)
 */
export const getDesgloseLogistico = (
    cantidadActual: number | string,
    logistica: LogisticaItem[] = [],
    unidadAbrev: string = ''
): string => {
    if (!logistica || logistica.length === 0) return `${cantidadActual} ${unidadAbrev}`;

    const baseLog = logistica.find(l => l.es_base);
    if (!baseLog) return `${cantidadActual} ${unidadAbrev}`;

    const factorBase = Number(baseLog.factor || 1);

    // 2. La cantidad actual YA está en la unidad base del rubro (ej. Litros, KG)
    let totalAbsoluto = Number(Number(cantidadActual).toFixed(4));

    // 3. Filtrar y ordenar: 
    // Solo mostramos desde la presentación "es_base" hacia abajo (ignoramos Paletas si el Bulto es base)
    const logSorted = [...logistica]
        .filter(l => Number(l.factor) <= factorBase)
        .sort((a, b) => Number(b.factor) - Number(a.factor));

    const partes: string[] = [];
    let resto = totalAbsoluto;

    logSorted.forEach(log => {
        const factor = Number(log.factor);
        if (factor <= 0) return;

        // ¿Cuántas unidades de esta presentación caben?
        // Usamos una pequeña tolerancia para evitar problemas de precisión
        const cantidadPartes = Math.floor((resto + 0.0001) / factor);

        if (cantidadPartes > 0) {
            partes.push(`${formatNumber(cantidadPartes, 0)} ${log.presentacion?.nombre || 'UND'}`);
            // Restamos lo consumido de forma exacta
            resto = Number((resto - (cantidadPartes * factor)).toFixed(4));
        }
    });

    // 4. Si queda un resto que no encaja en ninguna presentación
    if (resto > 0.001) {
        partes.push(`${formatNumber(resto, getDecimalPlaces(resto))} ${unidadAbrev}`);
    }

    return partes.length > 0 ? partes.join(' + ') : `0 ${unidadAbrev}`;
};

/**
 * Normaliza sinónimos comunes de unidades de medida para evitar duplicaciones
 */
const normalizarUnidad = (u: string): string => {
    if (!u) return '';
    const s = u.toLowerCase().trim();
    if (s === 'und' || s === 'unidad' || s === 'unidades' || s === 'u') return 'u';
    if (s === 'kg' || s === 'kilo' || s === 'kilogramo' || s === 'kilogramos' || s === 'kgs') return 'kg';
    if (s === 'l' || s === 'litro' || s === 'litros' || s === 'lts') return 'l';
    if (s === 'paq' || s === 'paquete' || s === 'paquetes') return 'paq';
    return s;
};

/**
 * Devuelve un array con el total de stock expresado en todas las unidades logísticas disponibles
 * Ordenado de mayor a menor factor
 */
export const getEquivalenciasLogisticas = (
    cantidadActual: number | string,
    logistica: LogisticaItem[] = [],
    unidadAbrev: string = '',
    cantidadPresentacion?: number | string | null,
    idPresentacionLogistica?: number | string | null
): { cantidad: string, unidad: string, isBase: boolean }[] => {
    const total = Number(cantidadActual);
    if (isNaN(total) || total === 0) return [{ cantidad: '0', unidad: unidadAbrev, isBase: false }];

    // Si viene la presentación física real guardada (caso peso variable)
    if (cantidadPresentacion !== undefined && cantidadPresentacion !== null && Number(cantidadPresentacion) > 0 && idPresentacionLogistica) {
        const matchingLog = logistica.find(l => l.id == idPresentacionLogistica);
        if (matchingLog) {
            const totalDecimales = getDecimalPlaces(total);
            return [
                {
                    cantidad: formatNumber(cantidadPresentacion, 0),
                    unidad: matchingLog.presentacion?.nombre || 'UND',
                    isBase: false
                },
                {
                    cantidad: formatNumber(total, totalDecimales),
                    unidad: unidadAbrev,
                    isBase: true
                }
            ];
        }
    }

    // 1. Ordenar logística de mayor a menor factor
    const sortedLog = [...logistica].sort((a, b) => Number(b.factor) - Number(a.factor));

    const equivalencias = sortedLog.map(log => {
        const factor = Number(log.factor) || 1;
        const isBaseLog = !!log.es_base;
        let valor = total / factor;
        
        // Para presentaciones superiores (no base), solo mostramos ENTEROS completos
        if (!isBaseLog) {
            valor = Math.floor(valor + 0.00001); // Tolerancia para precisión
            // Si no llegamos ni a 1 unidad entera de esta presentación superior, no la mostramos
            if (valor < 1) return null;
        }
        
        const decimales = isBaseLog ? getDecimalPlaces(valor) : 0;

        return {
            cantidad: formatNumber(valor, decimales),
            unidad: log.presentacion?.nombre || 'UND',
            isBase: isBaseLog
        };
    }).filter(Boolean) as { cantidad: string, unidad: string, isBase: boolean }[];

    // 2. SIEMPRE añadimos la unidad base del rubro (L, KG, etc.) al final 
    // para que el usuario vea el volumen/masa total independientemente del empaque
    const ultimaUnidad = equivalencias[equivalencias.length - 1]?.unidad;
    
    if (!ultimaUnidad || normalizarUnidad(ultimaUnidad) !== normalizarUnidad(unidadAbrev)) {
        const totalDecimales = getDecimalPlaces(total);
        equivalencias.push({
            cantidad: formatNumber(total, totalDecimales),
            unidad: unidadAbrev,
            isBase: true // Marcamos esta como la verdadera base para el estilo
        });
    } else if (equivalencias.length > 0) {
        // Si ya estaba (porque la logística base se llamaba igual que la unidad del rubro), 
        // nos aseguramos de que esté marcada como base
        equivalencias[equivalencias.length - 1].isBase = true;
    }

    // 3. Si solo hay una equivalencia, la marcamos como no-base para que se renderice destacada (en negrita)
    if (equivalencias.length === 1) {
        equivalencias[0].isBase = false;
    }

    return equivalencias;
};

/**
 * Devuelve un array con el costo unitario expresado en todas las unidades logísticas disponibles
 * Ordenado de mayor a menor factor, filtrando aquellas presentaciones que no tengan stock activo
 */
export const getEquivalenciasCostos = (
    costoBase: number | string,
    cantidadActual: number | string,
    logistica: LogisticaItem[] = [],
    unidadAbrev: string = ''
): { costo: string, unidad: string, isBase: boolean }[] => {
    const totalCosto = Number(costoBase);
    const totalStock = Number(cantidadActual);
    if (isNaN(totalCosto) || totalCosto <= 0) return [{ costo: '0.00', unidad: unidadAbrev, isBase: false }];

    // 1. Ordenar logística de mayor a menor factor
    const sortedLog = [...logistica].sort((a, b) => Number(b.factor) - Number(a.factor));

    const equivalencias = sortedLog.map(log => {
        const factor = Number(log.factor) || 1;
        const isBaseLog = !!log.es_base;
        
        // Filtrar presentaciones superiores sin stock
        if (!isBaseLog && !isNaN(totalStock)) {
            const stockVal = totalStock / factor;
            const roundedStock = Math.floor(stockVal + 0.00001);
            if (roundedStock < 1) return null;
        }

        const valorCosto = totalCosto * factor;
        const decimales = 2; // Formato de moneda estándar de 2 decimales para empaques

        return {
            costo: formatNumber(valorCosto, decimales),
            unidad: log.presentacion?.nombre || 'UND',
            isBase: isBaseLog
        };
    }).filter(Boolean) as { costo: string, unidad: string, isBase: boolean }[];

    // 2. SIEMPRE añadimos la unidad base del rubro al final
    const ultimaUnidad = equivalencias[equivalencias.length - 1]?.unidad;
    
    if (!ultimaUnidad || normalizarUnidad(ultimaUnidad) !== normalizarUnidad(unidadAbrev)) {
        equivalencias.push({
            costo: formatNumber(totalCosto, 4), // 4 decimales para el costo unitario base (por kg, litro, etc.)
            unidad: unidadAbrev,
            isBase: true
        });
    } else if (equivalencias.length > 0) {
        equivalencias[equivalencias.length - 1].isBase = true;
    }

    // 3. Si solo hay una equivalencia, la marcamos como no-base para que se renderice destacada (en negrita)
    if (equivalencias.length === 1) {
        equivalencias[0].isBase = false;
    }

    return equivalencias;
};
