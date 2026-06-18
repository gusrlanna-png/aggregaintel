-- 020 — Correção de colunas de contato + endereços múltiplos (aplicado via MCP 2026-06-17)
-- BUG: getPessoaTelefones/getPessoaEmails ordenam por `principal`, coluna que a
-- migration 014 não criou -> SELECT falha com 42703 e a lista nunca carrega
-- (o item é inserido mas "não aparece"). Aqui alinhamos o schema ao código.
ALTER TABLE pessoa_telefones ADD COLUMN IF NOT EXISTS pais_codigo TEXT;
ALTER TABLE pessoa_telefones ADD COLUMN IF NOT EXISTS rotulo TEXT;
ALTER TABLE pessoa_telefones ADD COLUMN IF NOT EXISTS principal BOOLEAN DEFAULT FALSE;

ALTER TABLE pessoa_emails ADD COLUMN IF NOT EXISTS principal BOOLEAN DEFAULT FALSE;

ALTER TABLE cliente_pessoas ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE cliente_pessoas ADD COLUMN IF NOT EXISTS principal BOOLEAN DEFAULT FALSE;

-- Endereços múltiplos (mesmo padrão de telefones/e-mails).
CREATE TABLE IF NOT EXISTS pessoa_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  rotulo TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  cep TEXT,
  principal BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pessoa_enderecos_pessoa ON pessoa_enderecos(pessoa_id);
ALTER TABLE pessoa_enderecos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pen_auth ON pessoa_enderecos;
CREATE POLICY pen_auth ON pessoa_enderecos FOR ALL
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
