-- Propósito: Maestro de productos
-- Última modificación: 2026-05-28 - Se agrega campo peso_variable para soportar productos a granel con peso en báscula

CREATE TABLE public.almacen_productos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  id_marca int8 REFERENCES public.almacen_marcas(id),
  variedad text,
  stock_minimo numeric DEFAULT 0,
  id_logistica_stock_minimo int8, -- Ref a almacen_productos_codigos(id)
  maneja_lote boolean DEFAULT true,
  costo_ponderado numeric DEFAULT 0,
  ultimo_costo numeric DEFAULT 0,
  
  -- Configuración de Depreciación (Aplica si es un activo)
  id_tipo_depreciacion int8 REFERENCES public.logistica_activos_tipos_depreciacion(id),
  valor_calculo_depreciacion numeric(12,3),
  
  -- Control de transporte y tara (aplica funcionalmente a productos de categoría UTENSILIOS)
  es_recipiente_transporte  boolean      NOT NULL DEFAULT false,   -- True si es apto para transportar raciones de alimentos (termos, cavas, Chefandish)
  peso_tara_estandar        numeric(12,3) NOT NULL DEFAULT 0.000,  -- Peso por defecto del envase vacío en KG/L

  -- Clasificación para transformación física (reenvasado/desposte)
  es_insumo_transformacion    boolean      NOT NULL DEFAULT false,
  es_resultado_transformacion boolean      NOT NULL DEFAULT false,
  es_reprocesable             boolean      NOT NULL DEFAULT false,

  -- Indica que cada empaque (bolsa, bandeja, etc.) tiene peso diferente en báscula
  -- Al ser true, el picking desvincula la cantidad de empaques del cálculo por factor
  peso_variable               boolean      NOT NULL DEFAULT false,
  
  -- Indica si el producto es considerado un subproducto o desecho físico en desposte
  es_subproducto              boolean      NOT NULL DEFAULT false,

  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_productos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
