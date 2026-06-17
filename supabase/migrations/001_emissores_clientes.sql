-- 001_emissores_clientes.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis; -- para funções de distância geoespacial

-- Tabela de emissores (concorrentes / fornecedores identificados nas NFs)
CREATE TABLE emissores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  cnpj            TEXT UNIQUE,
  inscricao_est   TEXT,
  logradouro      TEXT,
  municipio       TEXT,
  uf              TEXT DEFAULT 'MG',
  cep             TEXT,
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  fone            TEXT,
  tipo            TEXT DEFAULT 'concorrente', -- concorrente | fornecedor | ambos
  produtos        JSONB,  -- {"b1":true,"areia":true}
  capacidade_ton_mes NUMERIC,
  status_legal    TEXT,  -- ativo | rec_judicial | falido | inativo
  grupo_economico TEXT,
  notas           TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de clientes (concreteiras, usinas, depósitos...)
CREATE TABLE clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  cnpj            TEXT,
  cpf             TEXT,
  segmento        TEXT NOT NULL, -- concreto | asfalto | premoldado | varejo | outro
  logradouro      TEXT,
  bairro          TEXT,
  municipio       TEXT,
  uf              TEXT DEFAULT 'MG',
  cep             TEXT,
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  fone            TEXT,
  contato_nome    TEXT,
  status          TEXT DEFAULT 'ativo',
  notas           TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emissores_cnpj ON emissores(cnpj);
CREATE INDEX idx_emissores_municipio ON emissores(municipio);
CREATE INDEX idx_clientes_segmento ON clientes(segmento);
CREATE INDEX idx_clientes_municipio ON clientes(municipio);
