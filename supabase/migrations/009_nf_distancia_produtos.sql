-- 009_nf_distancia_produtos.sql
-- Distância da NF (para R$/t/km) e catálogo de produtos.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS produtos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'outro', -- b0|b1|b2|bg|ai|aq|pp|outro
  aliases     TEXT[] DEFAULT '{}',
  origem      TEXT DEFAULT 'manual',         -- nf | manual
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nome)
);

CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para usuários autenticados" ON produtos
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
