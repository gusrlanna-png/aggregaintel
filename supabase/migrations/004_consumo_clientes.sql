-- 004_consumo_clientes.sql

CREATE TABLE traco_consumo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID REFERENCES clientes(id) ON DELETE CASCADE,
  segmento        TEXT NOT NULL,   -- concreto | asfalto | premoldado | varejo
  subtipo         TEXT,            -- bloco | paver | manilha | etc. (para premoldado)
  periodo_tipo    TEXT NOT NULL,   -- macro | ano | mes
  periodo_ref     TEXT,            -- NULL | "2024" | "2024-07"
  producao_volume NUMERIC(14,2),   -- m3 ou t ou unid ou cargas
  producao_unit   TEXT,            -- m3 | t | unid | cargas
  -- Traço em kg por unidade de produção (JSONB flexível)
  traco_kg        JSONB NOT NULL,  -- {"b1":550,"b2":250,"ai":1000,"aq":200,"pp":0}
  -- Para varejo: caminhão
  caminhao_tipo   TEXT,            -- toco | truck | carreta | bitrem | custom
  caminhao_peso_t NUMERIC(8,2),    -- peso útil em toneladas
  notas           TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fornecedor_mix (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traco_id        UUID REFERENCES traco_consumo(id) ON DELETE CASCADE,
  emissor_id      UUID REFERENCES emissores(id),
  nome_fornecedor TEXT,  -- fallback quando emissor não cadastrado ainda
  produto_tipo    TEXT NOT NULL,  -- b1 | ai | bg | b0 | pp | aq
  share_pct       NUMERIC(5,2) CHECK (share_pct BETWEEN 0 AND 100),
  periodo_tipo    TEXT,
  periodo_ref     TEXT
);

-- View: oportunidade MBV por cliente
CREATE VIEW vw_oportunidade_mbv AS
  SELECT
    c.razao_social,
    c.segmento,
    tc.periodo_ref,
    tc.producao_volume,
    tc.producao_unit,
    tc.traco_kg,
    COALESCE(SUM(fm.share_pct) FILTER (WHERE e.cnpj = '03.334.595/0001-00'), 0) AS mbv_share_total,
    100 - COALESCE(SUM(fm.share_pct) FILTER (WHERE e.cnpj = '03.334.595/0001-00'), 0) AS oportunidade_pct
  FROM traco_consumo tc
  JOIN clientes c ON c.id = tc.cliente_id
  LEFT JOIN fornecedor_mix fm ON fm.traco_id = tc.id
  LEFT JOIN emissores e ON e.id = fm.emissor_id
  GROUP BY c.razao_social, c.segmento, tc.periodo_ref, tc.producao_volume, tc.producao_unit, tc.traco_kg;
