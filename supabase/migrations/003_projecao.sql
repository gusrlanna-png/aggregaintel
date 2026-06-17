-- 003_projecao.sql

CREATE TABLE nf_projecao (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emissor_id       UUID REFERENCES emissores(id),
  serie            TEXT,
  periodo_inicio   DATE NOT NULL,
  periodo_fim      DATE NOT NULL,
  nf_inicio        BIGINT,
  nf_fim           BIGINT,
  delta_nf         BIGINT,        -- nf_fim - nf_inicio
  fator_cobertura  NUMERIC(5,4),  -- amostras capturadas / delta (ex: 0.35)
  peso_medio_ton   NUMERIC(8,4),  -- toneladas por NF estimadas
  peso_medio_fonte TEXT,          -- "historico_nf" | "manual" | "ia_sugestao"
  volume_est_min   NUMERIC(14,2), -- toneladas mínimas no período
  volume_est_med   NUMERIC(14,2), -- toneladas estimadas (central)
  volume_est_max   NUMERIC(14,2), -- toneladas máximas
  ic_pct           NUMERIC(5,2),  -- intervalo de confiança em %
  produto_tipo     TEXT,
  notas            TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- View: resumo de produção por emissor
CREATE VIEW vw_producao_emissores AS
  SELECT
    e.razao_social,
    e.municipio,
    p.periodo_inicio,
    p.periodo_fim,
    p.volume_est_med AS volume_ton,
    p.ic_pct,
    p.peso_medio_ton
  FROM nf_projecao p
  JOIN emissores e ON e.id = p.emissor_id
  ORDER BY p.volume_est_med DESC;
