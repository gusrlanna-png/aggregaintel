-- 005_cfem_intel_share.sql

CREATE TABLE cfem_anm (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emissor_id      UUID REFERENCES emissores(id),
  cnpj_titular    TEXT,
  razao_titular   TEXT,
  municipio       TEXT,
  uf              TEXT,
  substancia      TEXT,
  ncm             TEXT,
  cfem_acumulado  NUMERIC(16,2),
  n_recolhimentos INTEGER,
  cfem_ultimo     NUMERIC(14,2),
  mes_ano_ref     TEXT,  -- "maio de 2026"
  data_captura    DATE DEFAULT CURRENT_DATE,
  fonte           TEXT DEFAULT 'anm_powerbi'
);

CREATE TABLE inteligencia_mercado (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_fonte      TEXT NOT NULL,  -- whatsapp | manual | nf | anm | outro
  conteudo_raw    TEXT,
  emissor_id      UUID REFERENCES emissores(id),
  cliente_id      UUID REFERENCES clientes(id),
  classificacao   TEXT,  -- preco | volume | concorrente | cliente | alerta | outro
  confianca       TEXT DEFAULT 'media',  -- alta | media | baixa
  data_info       DATE,
  texto_extraido  TEXT,
  valor_num       NUMERIC,  -- se for um número relevante
  unidade         TEXT,
  tags            TEXT[],
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_share_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ref         TEXT NOT NULL,  -- "2024-07"
  produto_tipo    TEXT NOT NULL,
  regiao          TEXT,
  mbv_volume_ton  NUMERIC(14,2),
  mercado_total_ton NUMERIC(14,2),
  mbv_share_pct   NUMERIC(6,2),
  metodologia     TEXT,  -- "projecao_nf" | "cfem" | "manual"
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cfem_emissor ON cfem_anm(emissor_id);
CREATE INDEX idx_intel_tipo ON inteligencia_mercado(tipo_fonte);
CREATE INDEX idx_share_mes ON market_share_snapshot(mes_ref);

-- ── RLS: usuários autenticados têm acesso total ────────────────────────
ALTER TABLE emissores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE nf_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE nf_projecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE traco_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_mix ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfem_anm ENABLE ROW LEVEL SECURITY;
ALTER TABLE inteligencia_mercado ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_share_snapshot ENABLE ROW LEVEL SECURITY;

-- Política única replicada para todas as tabelas
CREATE POLICY "Acesso total para usuários autenticados" ON emissores
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON clientes
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON notas_fiscais
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON nf_series
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON nf_projecao
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON traco_consumo
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON fornecedor_mix
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON cfem_anm
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON inteligencia_mercado
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Acesso total para usuários autenticados" ON market_share_snapshot
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
