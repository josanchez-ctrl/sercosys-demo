-- Propósito: Ubicaciones físicas dentro de los almacenes (Racks, Estantes, etc.)
-- Última modificación: 2026-05-08 (Sincronizado desde Supabase)

CREATE TABLE public.almacen_ubicaciones (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_almacen int8 NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text,
  estatus bool DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL DEFAULT now(),
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_ubicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_ubicaciones 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
