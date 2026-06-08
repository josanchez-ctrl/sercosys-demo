-- Propósito: Maestro de clientes (Comercialización)
-- Última modificación: 2026-05-08 (Sincronizado desde Supabase)

CREATE TABLE public.clientes (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 REFERENCES public.empresas(id),
  id_tipocliente int2 REFERENCES public.tipos_clientes(id),
  nombre text NOT NULL,
  id_letradni int8 REFERENCES public.letrasdni(id),
  dni text,
  direccion text,
  contacto_nombre text,
  contacto_telefono text,
  contacto_email text,
  estatus bool DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz DEFAULT now(),
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.clientes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
