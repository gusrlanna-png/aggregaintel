-- 010_intel_marcacoes.sql
-- Marcações, sínteses por IA e nome de cliente livre na inteligência de mercado.

ALTER TABLE inteligencia_mercado
  ADD COLUMN IF NOT EXISTS importante  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_sintese  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_intel_importante ON inteligencia_mercado(importante);
CREATE INDEX IF NOT EXISTS idx_intel_cliente_nome ON inteligencia_mercado(cliente_nome);
