-- 011_cliente_grupo_contatos.sql
-- Grupo econômico e contatos (à parte) para clientes.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS grupo_economico TEXT,
  ADD COLUMN IF NOT EXISTS contatos JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_clientes_grupo ON clientes(grupo_economico);
