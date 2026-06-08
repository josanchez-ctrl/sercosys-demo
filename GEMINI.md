# Manifiesto de Diseño y Flujo "Sercosys Core"

Este documento es la "Fuente de Verdad" para el desarrollo de Sercosys. El asistente está OBLIGADO a seguir estas reglas para mantener la consistencia visual y operativa.

> [!IMPORTANT]
> El acceso por MCP siempre será al proyecto **sercosys-demo**.

## 🏛️ Regla de Oro: La Jerarquía de Contexto
Sercosys elimina los títulos estáticos ("Gestión de...") para priorizar el contexto de datos.

1.  **Nivel 0 (Raíz)**: Si no hay selección, mostrar estado vacío con icono grande (`opacity-40`) y mensaje de espera.
2.  **Nivel 1 (Entidad)**: Selector de **Cliente** siempre visible al inicio (badge o select).
3.  **Nivel 2 (Estructura)**: Tras elegir cliente, aparecen **Sucursales**, **Comedores** o **Almacenes**. (dependiendo de la función)
    - **Tabs**: Para < 4 opciones o estados fijos (Activos/Inactivos).
    - **Selects**: Para listas dinámicas o largas (> 4 opciones).
4.  **Nivel 3 (Detalle/Acción)**: Activación de filtros (Fecha, Búsqueda) y botón de "Agregar".

## ⚠️ Protocolo de Advertencia Enfática
Antes de modificar cualquier lógica operativa, estructural o de base de datos que ya esté marcada como funcional (especialmente en módulos de **Costos, Inventario, Auditoría o Cotejo**), el asistente está **OBLIGADO** a:
1.  Identificar que se está tocando una zona "volátil".
2.  Emitir una advertencia visualmente destacada (usando `> [!CAUTION]`).
3.  Explicar qué funciona actualmente y cómo el cambio solicitado podría impactar la integridad de los datos.
4.  Solicitar confirmación explícita antes de escribir una sola línea de código.

## 🎨 ADN Visual (Tokens de Estilo)

### Contenedores y Layout
- **Wrapper Principal**: `p-4 space-y-2 animate-in fade-in duration-500`.
- **Card Estándar**: `bg-white rounded-md shadow-sm border border-gray-100`.
- **Fondo de Página**: `bg-slate-50`.

### Tablas de Datos
- **thead**: `bg-gray-50/50`, texto `[10px]` o `[11px]`, `font-black`, `uppercase`, `tracking-widest`.
- **tbody**: `divide-y divide-gray-300`, `hover:bg-slate-50 transition-all`.
- **Pills de Estado**: Redondeadas (`rounded-full` o `rounded-xl`), fondo intensidad 50, texto intensidad 700.

### Iconografía y Marca
- **Brand Boxes**: Iconos de `lucide-react` envueltos en `p-3 bg-brand-50 rounded-xl`.
- **Acciones**: Botón principal con `shadow-brand-accent/30` y `active:scale-95`.

### 🏭 Selectores de Almacén (Header)
Los almacenes se muestran como una rejilla de botones interactivos con los siguientes estilos:
```jsx
<div className="flex items-center gap-4 relative">
  <div className='grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2'>
    {almacenesFiltrados.map(almacen => (
      <button
        key={almacen.id}
        onClick={() => setAlmacenSel(almacenSel?.id === almacen.id ? null : almacen)}
        className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[100px] ${
          almacenSel?.id === almacen.id
          ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/20 scale-105'
          : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
        }`}
      >
        <Warehouse size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest">{almacen.nombre}</span>
      </button>
    ))}
  </div>
</div>
```

### 📊 KPIs de Estado (Filtros Interactivos el nombre de los estados e iconos varian dependiendo del modulo)
La nomenclatura de estados base y su representación visual en cards:
```jsx
const statusConfig = {
  BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <FileEdit size={12} /> },
  PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
  PROCESADO: { label: 'Procesado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
  ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
};

// Renderizado de KPIs
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {Object.entries(statusConfig).map(([key, config]) => {
    const count = data.filter(c => c.estatus === key).length;
    const isActive = activeStatusFilter === key;
    return (
      <button
        key={key}
        onClick={() => setActiveStatusFilter(isActive ? null : key)}
        className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
          isActive
          ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
          : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${isActive ? config.color.split(' ')[0] + ' ' + config.color.split(' ')[1] : config.color.split(' ').slice(0, 2).join(' ')}`}>
            {config.icon}
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand-900' : 'text-slate-400'}`}>
            {config.label}
          </span>
        </div>
        <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${config.color.split(' ').find(c => c.startsWith('text-'))}`}>
          {count}
        </span>
      </button>
    );
  })}
</div>
```

## 🪟 ADN de los Modales
1.  **Montaje**: Uso obligatorio de `createPortal` hacia `document.body`.
2.  **Overlay**: `bg-black/60` con `backdrop-blur-sm`.
3.  **Contenedor**: Redondeado extremo (`rounded-[2.5rem]` o `2xl`), sombra `shadow-2xl`.
4.  **Cabecera**: Icono en círculo de color, Título (`h3`) y Subtítulo en itálica (`p`).
5.  **Cuerpo**: Fondo `bg-gray-50/30`, campos en "Cards" blancas segmentadas por sección.
6.  **Footer**: Sticky, botones alineados a la derecha (Cancelar en gris, Acción en Brand).

## 🚀 Estándares de Flujo y Código
- **Tecnología**: React + Vite + Tailwind CSS (SOLO Tailwind).
- **Formularios**: Estándar obligatorio de **Formik + Yup** para validación.
- **Servicios**: Toda consulta a Supabase debe vivir en `src/services/`.
- **Lenguaje**: El asistente debe mantener un lenguaje estrictamente profesional, respetuoso y libre de cualquier tipo de groserías o expresiones vulgares.
- **Importaciones**: Prohibido el uso de `await import(...)` o importaciones dinámicas dentro de funciones o componentes. Todas las dependencias deben declararse en la parte superior del archivo.
- **Atomicidad y RPC**: Siempre que una operación requiera modificar múltiples tablas o realizar cálculos de negocio críticos (como inventario, costos ponderados o estatus encadenados), se debe **sugerir y priorizar el uso de RPC (Funciones de PostgreSQL)** para garantizar la integridad de los datos y la atomicidad de la transacción, aunado a ello, si hay que modificar una función de RPC, se debe quitar el .sql de la carpeta rpc y crear uno nuevo con el mismo nombre.
- **Limpieza**: No dejar basura en la consola ni comentarios innecesarios.
- **Permisos**: Siempre que se trabaje con permisos, se debe tener en cuenta el perfil del usuario y la empresa activa.
- **Planes de Implementación**: Todos los artefactos de tipo `implementation_plan.md` deben escribirse OBLIGATORIAMENTE en idioma español y deben ser detallados (indicando qué se cambia, qué se modifica, qué se crea y la lógica detrás) para aprobación previa del usuario.
- **Responsividad**: Prohibido el uso de anchos fijos en píxeles (`w-[180px]`) para columnas o contenedores en layouts dinámicos. Se deben usar anchos relativos porcentuales (`w-[20%]`) o clases de flex-grow (`flex-1`) para garantizar que la interfaz se adapte a cualquier tamaño de pantalla sin desbordamientos.

## 🗄️ Estándares de Base de Datos (PostgreSQL / Supabase)

Estas convenciones son **OBLIGATORIAS** en toda tabla nueva o migración que se cree en el proyecto.

### Tipos de Columnas
- **Primary Key**: SIEMPRE `int8` (BIGINT) generado con `GENERATED ALWAYS AS IDENTITY`. **NUNCA usar `uuid`** como PK.
- **Foreign Keys**: `int8` para referencias hacia otras tablas que usen `int8` como PK.
- **Identificadores externos o de sesión**: Solo se permite `uuid` si la referencia apunta explícitamente a `auth.users(id)` de Supabase.

### Nomenclatura de Columnas de Auditoría
Toda tabla debe incluir las columnas de auditoría necesarias con los siguientes nombres estandarizados:

| Propósito            | Timestamp                | Usuario asociado          |
|----------------------|--------------------------|---------------------------|
| Creación             | `timestamp_create`       | `id_usuario_create`       |
| Actualización        | `timestamp_update`       | `id_usuario_update`       |
| Anulación            | `timestamp_anula`        | `id_usuario_anula`        |
| Procesamiento        | `timestamp_procesa`      | `id_usuario_procesa`      |


- Los campos `timestamp_*` son de tipo `timestamptz`.
- Los campos `id_usuario_*` son de tipo `int8` y referencian `public.usuarios(id)` que almacena `perfil.id`. **No se declara FK a `auth.users`**.
- Los campos de anulación y procesamiento son **opcionales** (`NULL` por defecto); solo se incluyen si el ciclo de vida del registro lo requiere.
- El campo `timestamp_create` no debe ser actualizable.
- El trigger de `updated_at` queda **eliminado**; la lógica de actualizar `all timestamp_*` es responsabilidad del servicio o RPC.
- **Timestamps en el servicio**: Todos los valores `timestamp_*` asignados desde el código deben obtenerse con `const nowStr = await Now()` importando desde `'./nowService'` y procesarse con las funciones de `'../util/workDate'`. **Nunca usar `new Date().toISOString()` de forma aislada**. Toda manipulación o transformación de fechas debe centralizarse en `src/util/workDate.ts`. Si la función necesaria no existe, se debe crear allí; si ya existe, se debe reutilizar obligatoriamente.

### Ejemplo de Estructura Canónica
```sql
CREATE TABLE almacen_ejemplo (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre               text        NOT NULL,
  estatus              boolean     NOT NULL DEFAULT true,
  -- auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  timestamp_anula      timestamptz, -- cuando aplique
  timestamp_procesa    timestamptz, -- cuando aplique
  id_usuario_create    int8,
  id_usuario_update    int8,
  id_usuario_anula     int8, -- cuando aplique
  id_usuario_procesa   int8 -- cuando aplique

);
```

## 📜 Protocolo de Persistencia y Documentación SQL

El asistente está **OBLIGADO** a mantener un espejo local de toda la estructura y lógica de la base de datos dentro de la carpeta `/sql`. Ningún cambio debe existir solo en Supabase.

### 📁 Estructura de Archivos
- **Tablas**: Se almacenan en `sql/tables/[nombre_tabla].sql`. Contienen el `CREATE TABLE` y sus `ALTER TABLE` iniciales.
- **RPCs (Funciones)**: Se almacenan en `sql/rpcs/[nombre_funcion].sql`. Contienen el `CREATE OR REPLACE FUNCTION`.
- **Vistas**: Se almacenan en `sql/views/[nombre_vista].sql`.

### 🔄 Regla de Sincronización
1.  **Antes de Ejecutar**: Antes de sugerir o aplicar un cambio en Supabase (vía consola o MCP), el asistente debe crear o actualizar el archivo `.sql` correspondiente en el proyecto.
2.  **Atomicidad**: Si un cambio requiere modificar una tabla y un RPC, ambos archivos deben actualizarse en la misma sesión de trabajo.
3.  **Documentación Interna**: Todo archivo SQL debe comenzar con un comentario breve explicando su propósito y la fecha de última modificación.

### 🚫 Prohibiciones
- Prohibido dejar "código huérfano" en la base de datos sin su respaldo en el repositorio.
- Prohibido usar archivos SQL genéricos (como `rpcs.sql` o `tables.sql`) que agrupen múltiples entidades. Se debe usar **un archivo por entidad/función**.