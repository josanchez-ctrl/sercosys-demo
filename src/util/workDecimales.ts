export function getDecimalPlaces(num: number) {
    // Redondeamos a 6 decimales para evitar errores de precisión de punto flotante (ej: 108.00000000001)
    const normalizedNum = Math.round(num * 1e6) / 1e6;
    
    if (Math.floor(normalizedNum) === normalizedNum) return 0;
    const parts = normalizedNum.toString().split('.');
    if (parts.length < 2) return 0;
    const decimals = parts[1].length;
    return decimals > 3 ? 3 : decimals;
}

/**
 * Formatea un número para vista: Miles con punto (.) y decimales con coma (,)
 * Ejemplo: 1245.67 -> "1.245,67"
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
    if (value === null || value === undefined || value === "") return "0" + (decimals > 0 ? "," + "0".repeat(decimals) : "");
    
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(num)) return "0" + (decimals > 0 ? "," + "0".repeat(decimals) : "");

    return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

/**
 * Normaliza un string de entrada de usuario para cálculos o envío a base de datos.
 * Reemplaza la coma decimal por punto y elimina cualquier punto de miles si existiera.
 */
export function parseNumber(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Si viene con formato "1.245,67", quitamos los puntos de miles y cambiamos la coma por punto
    const cleanValue = value.toString()
        .replace(/\./g, '') // Quita puntos de miles
        .replace(',', '.'); // Cambia coma decimal por punto
        
    return parseFloat(cleanValue) || 0;
}