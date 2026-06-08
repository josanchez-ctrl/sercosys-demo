/*
  TABLA: logistica_activos
  DESCRIPCIÓN: Maestro de activos individuales con seguimiento por código de inventario, ubicación y estado.
  ÚLTIMA MODIFICACIÓN: 2026-05-16
*/

CREATE TABLE public.logistica_activos (
    id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo_inventario    text        GENERATED ALWAYS AS ('ACT-' || LPAD(id::text, 5, '0')) STORED, -- Autogenerado en base al ID
    
    id_producto          int8        NOT NULL REFERENCES public.almacen_productos(id),
    serial               text,
    peso                 numeric(12,3) DEFAULT 0,
    
    -- Ubicación actual
    id_sucursal_actual   int8        REFERENCES public.sucursales(id),
    id_departamento_actual int8      REFERENCES public.departamentos(id),
    
    -- Estados
    condicion            text        NOT NULL DEFAULT 'RESGUARDO', -- ASIGNADO, RESGUARDO
    estatus_operativo    text        NOT NULL DEFAULT 'ACTIVO',    -- ACTIVO, INACTIVO, MANTENIMIENTO, BAJA
    estatus_logistico    text        NOT NULL DEFAULT 'DISPONIBLE', -- DISPONIBLE, EN_TRANSITO, ENTREGADO_CLIENTE
    estatus_interno      text        NOT NULL DEFAULT 'DISPONIBLE', -- DISPONIBLE, EN_USO (control local cocina/comedor)
    
    observaciones        text,
    
    -- auditoría
    timestamp_create     timestamptz NOT NULL,
    timestamp_update     timestamptz,
    id_usuario_create    int8        REFERENCES public.usuarios(id),
    id_usuario_update    int8        REFERENCES public.usuarios(id)
);

CREATE INDEX idx_activos_empresa ON public.logistica_activos(id_empresa);
CREATE INDEX idx_activos_codigo ON public.logistica_activos(codigo_inventario);
CREATE INDEX idx_activos_sucursal ON public.logistica_activos(id_sucursal_actual);
CREATE INDEX idx_activos_modelo ON public.logistica_activos(id_modelo);
