-- 012_projecao_mensal.sql
-- Overrides manuais do volume projetado por mês (emissor/série/ano).

CREATE TABLE IF NOT EXISTS projecao_mensal (
  id          TEXT PRIMARY KEY, -- "<emissor_id>:<serie>:<ano>"
  emissor_id  UUID REFERENCES emissores(id) ON DELETE CASCADE,
  serie       TEXT,
  ano         INTEGER NOT NULL,
  volumes     JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"1":95000,...}
  pesos       JSONB NOT NULL DEFAULT '{}'::jsonb, -- peso médio (t) por mês {"1":27.1,...}
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Para bancos onde 012 já foi aplicado sem a coluna pesos:
ALTER TABLE projecao_mensal
  ADD COLUMN IF NOT EXISTS pesos JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE projecao_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para usuários autenticados" ON projecao_mensal
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
