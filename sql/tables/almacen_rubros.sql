-- Propósito: Rubros genéricos de insumos
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_rubros (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_categoria int8 REFERENCES public.almacen_categorias(id),
  nombre text NOT NULL,
  id_unidad_medida int8 REFERENCES public.almacen_unidades_medida(id),
  requiere_marca bool NOT NULL DEFAULT true,
  estatus bool NOT NULL DEFAULT true,
  porcentaje_costo_indirecto numeric NOT NULL DEFAULT 0.00,
  permite_merma_reposo bool NOT NULL DEFAULT false,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  
  CONSTRAINT chk_porcentaje_costo_indirecto CHECK (porcentaje_costo_indirecto >= 0)
);

-- Seguridad RLS
ALTER TABLE public.almacen_rubros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_rubros 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
