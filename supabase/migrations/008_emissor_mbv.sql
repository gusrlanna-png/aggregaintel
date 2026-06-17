-- 008_emissor_mbv.sql
-- Flag "nossa empresa (MBV)" por produtor, controlável por toggle no app.

ALTER TABLE emissores
  ADD COLUMN IF NOT EXISTS eh_mbv BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_emissores_eh_mbv ON emissores(eh_mbv);
