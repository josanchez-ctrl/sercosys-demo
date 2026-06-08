//const WeekDaysCor = ['do','lu','ma','mi','ju','vi','sa'];
const WeekDaysCom = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WeekDaysComEst = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
//const MonthsLetCor = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MonthsLetCom = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
//const MonthsNum = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export const ajustarFechaHora = (now: Date) => {
    const cuatroHoras = 4 * 60 * 60 * 1000;
    return new Date(now.getTime() - cuatroHoras);
};

export const ajustarFechaHoraInsertar = (now: Date) => {
    const cuatroHoras = 4 * 60 * 60 * 1000 * 2;
    return new Date(now.getTime() - cuatroHoras);
};

export const formatDateToDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const formatDateSystemToDDMMYYYY = (dateString: string) => {
    //console.log(dateString);
    //2026-04-01T22:21:47.170678+00:00
    if (!dateString) return '';
    const [fecha, hora] = dateString.split('T');
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
};

export const formatDateSystemToDDMMYYYYHHMMSS = (dateString: string) => {
    //console.log(dateString);
    //2026-04-01T22:21:47.170678+00:00
    if (!dateString) return '';
    const [fecha, hora] = dateString.split('T');
    const [year, month, day] = fecha.split('-');
    const [hour, minute, second] = hora.split(':');
    return `${day}/${month}/${year} ${hour}:${minute}:${second.substring(0, 2)}`;
};

export const formatDateSystemToDDMMYYYY_HHMMSS = (dateString: string) => {
    //console.log(dateString);
    //2026-04-01T22:21:47.170678+00:00
    if (!dateString) return '';
    const [fecha, hora] = dateString.split('T');
    const [year, month, day] = fecha.split('-');
    const [hour, minute, second] = hora.split(':');
    return `${day}/${month}/${year}\n${hour}:${minute}:${second.substring(0, 2)}`;
};

export const formatDateToYYYYMMDD = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${year}-${month}-${day}`;
};


export const formato8Digitos = (numero: number) => {
    return String(numero).padStart(8, "0");
};

export const formato5Digitos = (numero: number) => {
    return String(numero).padStart(5, "0");
};

export const formatearFecha = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const getDatesFromWeek = (weekString: string) => {
    if (!weekString) return { start: null, end: null };
    const [yearStr, weekStr] = weekString.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // El 4 de enero siempre está en la semana 1
    const jan4 = new Date(year, 0, 4);
    // Encontrar el lunes de esa semana
    const day = jan4.getDay() || 7;
    const mon1 = new Date(jan4);
    mon1.setDate(jan4.getDate() - day + 1);

    const start = new Date(mon1);
    start.setDate(mon1.getDate() + (week - 1) * 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
};

/** 
 * POTENCIACIÓN PARA PLANIFICACIÓN 
 */

// Obtiene el Lunes de la semana de una fecha dada
export const startOfWeekManual = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que el Lunes sea el día 1
    return new Date(d.setDate(diff));
};

// Sumar/Restar días
export const addDaysManual = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

// Sumar/Restar semanas
export const addWeeksManual = (date: Date, weeks: number) => {
    return addDaysManual(date, weeks * 7);
};

// Formatear nombre de día (corto)
export const getDayNameShort = (date: Date) => {
    const day = date.getDay();
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return names[day];
};

// Formatear nombre de día (largo)
export const getDayNameLong = (date: Date) => {
    const day = date.getDay();
    return WeekDaysCom[day];
};

export const getDayNameLongString = (dateStr: string): string => {
    const date = new Date(dateStr);
    const dayIndex = date.getUTCDay();
    return WeekDaysCom[dayIndex];
};

// Formatear mes (corto)
export const getMonthNameShort = (date: Date) => {
    const month = date.getMonth();
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return names[month];
};

// Verificar si es el mismo día
export const isSameDayManual = (d1: Date, d2: Date) => {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
};

// Formatear para visualización (DD/MM/YYYY)
export const formatToDDMMYYYYManual = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Formatear para DB (YYYY-MM-DD)
export const formatToISODate = (date: Date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Obtener el número de semana (ISO-8601)
export const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

/**
 * Retorna un string en formato YYYY-Www (ej: 2024-W16)
 */
export const getWeekStringFromDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
};


export const parseTimestampToDate = (timestamp: any) => {
    if (!timestamp) return new Date();
    // Si ya es un objeto Date, lo retornamos
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
};

/**
 * Retorna solo la fecha YYYY-MM-DD desde un objeto Date o String ISO
 */
export const getDateOnly = (date: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return ''; // Fecha inválida
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Calcula los días restantes para una fecha de vencimiento
 * @param fechaVencimiento String en formato YYYY-MM-DD
 */
export const getDiasRestantes = (fechaVencimiento: string) => {
    if (!fechaVencimiento) return null;

    // Crear fecha de vencimiento (YYYY-MM-DD)
    const [year, month, day] = fechaVencimiento.split('-').map(Number);
    const fv = new Date(year, month - 1, day);

    // Fecha actual
    const hoy = new Date();

    // Normalizar ambas a medianoche para comparar solo días
    fv.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diffTime = fv.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

/**
 * Retorna el rango { start, end } (YYYY-MM-DD) de la semana de una fecha dada
 */
export const getWeekRange = (date: Date) => {
    const start = startOfWeekManual(date);
    const end = addDaysManual(start, 6);
    return {
        start: formatToISODate(start),
        end: formatToISODate(end)
    };
};

