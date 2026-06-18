-- 025 — Backlog de desenvolvimento (chat → análise crítica + plano; aplicado via MCP 2026-06-18)
CREATE TABLE IF NOT EXISTS dev_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), titulo TEXT, pedido TEXT NOT NULL, plano TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_aprovacao', prioridade INT NOT NULL DEFAULT 0,
  provedor TEXT, contexto JSONB, criado_por UUID DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_status ON dev_tasks(status, prioridade DESC, criado_em DESC);
ALTER TABLE dev_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dev_tasks_auth ON dev_tasks;
CREATE POLICY dev_tasks_auth ON dev_tasks FOR ALL USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
