-- 021 — Fila de tarefas em segundo plano (aplicado via MCP 2026-06-17)
-- Base para análises/importações/atualizações que rodam no servidor e continuam
-- mesmo que o usuário saia da página. O usuário enfileira (INSERT); o worker
-- (service_role) processa e atualiza progresso/resultado; a UI acompanha.
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | processando | concluido | erro | cancelado
  titulo TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado JSONB,
  progresso INT NOT NULL DEFAULT 0,
  etapa TEXT,
  erro TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  criado_por UUID DEFAULT auth.uid(),
  tentativas INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_pendentes ON jobs(criado_em) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_jobs_entidade ON jobs(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_jobs_criado_por ON jobs(criado_por, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, criado_em DESC);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jobs_auth ON jobs;
CREATE POLICY jobs_auth ON jobs FOR ALL
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
