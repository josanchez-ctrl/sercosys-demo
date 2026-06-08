-- Propósito: Maestro de usuarios y gestión de permisos multicliente
-- Última modificación: 2026-05-04

CREATE TABLE public.usuarios (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_auth text NOT NULL, -- UID de Supabase Auth
  nombres text,
  apellidos text,
  F_ALL boolean DEFAULT false, -- SuperAdmin bypass
  ids_clientes jsonb, -- [1, 2, 3...]
  ids_sucursales jsonb,
  ids_menus jsonb,
  ids_gerencias jsonb,
  ids_departamentos jsonb,
  ids_almacenes jsonb,
  -- Auditoría
  timestamp_create timestamptz NOT NULL DEFAULT now()
);

-- Seguridad RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.usuarios 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
