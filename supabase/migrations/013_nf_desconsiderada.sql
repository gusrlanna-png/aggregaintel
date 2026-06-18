-- Migration 013: NF desconsiderada
-- Marca uma NF como "desconsiderada" — excluída de todos os cálculos e análises.

ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS desconsiderada BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_nf_desconsiderada ON notas_fiscais(desconsiderada) WHERE desconsiderada = TRUE;
