-- 002_notas_fiscais.sql

CREATE TABLE notas_fiscais (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emissor_id       UUID REFERENCES emissores(id),
  cliente_id       UUID REFERENCES clientes(id),
  numero_nf        BIGINT NOT NULL,
  serie            TEXT,
  chave_acesso     CHAR(44) UNIQUE,
  data_emissao     DATE NOT NULL,
  hora_saida       TIME,
  protocolo_sefaz  TEXT,
  cfop             TEXT,
  natureza_op      TEXT,
  -- Produto
  produto_desc     TEXT,
  produto_ncm      TEXT,
  produto_codigo   TEXT,
  produto_tipo     TEXT, -- b1 | b2 | bg | ai | aq | pp | b0 | outro
  -- Quantidades e valores
  quantidade_ton   NUMERIC(12,4) NOT NULL, -- peso líquido (toneladas)
  valor_unitario   NUMERIC(10,4),
  valor_total      NUMERIC(12,2),
  desconto         NUMERIC(10,2) DEFAULT 0,
  -- Impostos
  icms_base        NUMERIC(12,2) DEFAULT 0,
  icms_valor       NUMERIC(12,2) DEFAULT 0,
  icms_aliquota    NUMERIC(6,4) DEFAULT 0,
  icms_isento      BOOLEAN DEFAULT TRUE,
  icms_fundamento  TEXT,   -- "item 189 RICMS", etc.
  ipi_valor        NUMERIC(12,2) DEFAULT 0,
  pis_valor        NUMERIC(10,4) DEFAULT 0,
  cofins_valor     NUMERIC(10,4) DEFAULT 0,
  -- Frete e transporte
  frete_por_conta  TEXT,   -- emitente | destinatario | terceiros
  frete_valor      NUMERIC(10,2) DEFAULT 0,
  transportador    TEXT,
  placa_veiculo    TEXT,
  uf_veiculo       TEXT,
  peso_bruto       NUMERIC(10,4),
  peso_liquido     NUMERIC(10,4),
  especie_carga    TEXT,   -- granel | carga | tonelada
  -- Captura
  arquivo_url      TEXT,   -- URL no Supabase Storage
  ocr_raw          JSONB,  -- resposta bruta do Claude Vision
  ocr_confianca    NUMERIC(4,2), -- 0.00 a 1.00
  revisado         BOOLEAN DEFAULT FALSE,
  revisado_por     TEXT,
  revisado_em      TIMESTAMPTZ,
  -- Dados adicionais
  dados_adicionais TEXT,
  motorista_cpf    TEXT,
  pedido_ref       TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- Séries para o motor de projeção
CREATE TABLE nf_series (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emissor_id    UUID REFERENCES emissores(id) ON DELETE CASCADE,
  serie         TEXT,       -- NULL quando emissor não usa série
  nf_min        BIGINT,     -- menor NF observada nesta série
  nf_max        BIGINT,     -- maior NF observada nesta serie
  count_obs     INTEGER DEFAULT 1,  -- quantas NFs desta série foram capturadas
  ultima_data   DATE,
  UNIQUE(emissor_id, serie)
);

CREATE INDEX idx_nf_emissor ON notas_fiscais(emissor_id);
CREATE INDEX idx_nf_cliente ON notas_fiscais(cliente_id);
CREATE INDEX idx_nf_data ON notas_fiscais(data_emissao);
CREATE INDEX idx_nf_placa ON notas_fiscais(placa_veiculo);
CREATE INDEX idx_nf_produto ON notas_fiscais(produto_tipo);
