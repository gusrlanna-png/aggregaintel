-- Migration 014: Pessoas v2 — múltiplos telefones, e-mails, vínculos; contatos de clientes

-- Campo aniversário na pessoa
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS aniversario DATE;

-- Múltiplos telefones por pessoa
CREATE TABLE IF NOT EXISTS pessoa_telefones (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id   UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'celular'
              CHECK (tipo IN ('celular', 'fixo', 'whatsapp', 'comercial')),
  numero      TEXT NOT NULL,
  pais_codigo TEXT DEFAULT '+55',
  rotulo      TEXT,
  principal   BOOLEAN DEFAULT FALSE,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_telefones_pessoa ON pessoa_telefones(pessoa_id);

-- Múltiplos e-mails por pessoa
CREATE TABLE IF NOT EXISTS pessoa_emails (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  rotulo    TEXT,
  principal BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_emails_pessoa ON pessoa_emails(pessoa_id);

-- Vínculos entre pessoas (pai, cônjuge, sócio, amigo, etc.)
CREATE TABLE IF NOT EXISTS pessoa_vinculos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id_a  UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  pessoa_id_b  UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  tipo_vinculo TEXT NOT NULL DEFAULT 'outro',
  descricao    TEXT,
  criado_em    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pessoa_vinculos_unique UNIQUE (pessoa_id_a, pessoa_id_b),
  CONSTRAINT pessoa_vinculos_no_self CHECK (pessoa_id_a <> pessoa_id_b)
);
CREATE INDEX IF NOT EXISTS idx_pessoa_vinculos_a ON pessoa_vinculos(pessoa_id_a);
CREATE INDEX IF NOT EXISTS idx_pessoa_vinculos_b ON pessoa_vinculos(pessoa_id_b);

-- Contatos vinculados a clientes (com cargo/departamento)
CREATE TABLE IF NOT EXISTS cliente_pessoas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pessoa_id   UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  cargo       TEXT,
  departamento TEXT,
  principal   BOOLEAN DEFAULT FALSE,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cliente_pessoas_unique UNIQUE (cliente_id, pessoa_id)
);
CREATE INDEX IF NOT EXISTS idx_cliente_pessoas_cliente ON cliente_pessoas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_pessoas_pessoa  ON cliente_pessoas(pessoa_id);

-- Seed: motivos de visita (só insere se a tabela estiver vazia)
INSERT INTO visita_motivos (nome, ordem, ativo)
SELECT nome, ordem::int, ativo::boolean FROM (VALUES
  ('Prospecção',   1, true),
  ('Negociação',   2, true),
  ('Pós-venda',    3, true),
  ('Cobrança',     4, true),
  ('Visita técnica', 5, true),
  ('Entrega',      6, true),
  ('Outro',       99, true)
) AS v(nome, ordem, ativo)
WHERE NOT EXISTS (SELECT 1 FROM visita_motivos);

-- Seed: categorias de visita (só insere se a tabela estiver vazia)
INSERT INTO visita_categorias (nome, ordem, exige_brinde, ativo)
SELECT nome, ordem::int, exige_brinde::boolean, ativo::boolean FROM (VALUES
  ('Visita simples',   1, false, true),
  ('Brinde / presente', 2, true, true),
  ('Evento',           3, false, true)
) AS v(nome, ordem, exige_brinde, ativo)
WHERE NOT EXISTS (SELECT 1 FROM visita_categorias);
