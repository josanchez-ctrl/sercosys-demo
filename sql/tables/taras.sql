-- Propósito: Maestro de taras (cestas, paletas, contenedores) para cálculo automático de pesaje neto
-- Última modificación: 2026-05-26

CREATE TABLE IF NOT EXISTS public.taras (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo                 text        NOT NULL, -- 'CESTA', 'PALETA', 'GANCHO', etc.
  descripcion          text        NOT NULL, -- e.g., 'Cesta Gris Alta', 'Paleta Plástica Azul'
  medida               text,                 -- e.g., '60x40x30 cm'
  peso                 numeric     NOT NULL, -- Peso de la tara en Kilogramos (KG)
  estatus              boolean     NOT NULL DEFAULT true,

  -- Auditoría (Estándar Sercosys)
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8        REFERENCES public.usuarios(id),
  id_usuario_update    int8        REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.taras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.taras 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
