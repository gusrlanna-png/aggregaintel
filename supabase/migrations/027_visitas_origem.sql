-- 027 — Origem/dedup nas visitas (WhatsApp→Visitas; aplicado via MCP 2026-06-18)
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS origem TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS origem_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_visitas_origem
  ON visitas(origem, origem_ref)
  WHERE origem IS NOT NULL AND origem_ref IS NOT NULL;
