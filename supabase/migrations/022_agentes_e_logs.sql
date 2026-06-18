-- 022 — Registro de agentes + log de ações (aplicado via MCP 2026-06-17)
-- Base para o painel de monitoramento/criação/regras de agentes e auditoria de
-- tudo que cada agente executa.
CREATE TABLE IF NOT EXISTS agentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'tarefa',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentes_auth ON agentes;
CREATE POLICY agentes_auth ON agentes FOR ALL
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

CREATE TABLE IF NOT EXISTS job_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  agente_chave TEXT,
  nivel TEXT NOT NULL DEFAULT 'info',
  mensagem TEXT NOT NULL,
  dados JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_eventos_job ON job_eventos(job_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_job_eventos_agente ON job_eventos(agente_chave, criado_em DESC);
ALTER TABLE job_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_eventos_auth ON job_eventos;
CREATE POLICY job_eventos_auth ON job_eventos FOR ALL
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS agente_chave TEXT;

INSERT INTO agentes (chave, nome, descricao, tipo, ativo, regras)
VALUES (
  'person_analysis',
  'Enriquecimento de Contato',
  'Pesquisa na web dados de uma pessoa (CPF, contatos, redes e sociedades) e atualiza o cadastro.',
  'enriquecimento', TRUE, '{}'::jsonb
)
ON CONFLICT (chave) DO NOTHING;
