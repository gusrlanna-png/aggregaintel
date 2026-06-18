-- 024 — Chat dos agentes + base de aprendizado (aplicado via MCP 2026-06-18)
CREATE TABLE IF NOT EXISTS chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  papel TEXT NOT NULL, conteudo TEXT NOT NULL, contexto JSONB, acao JSONB, provedor TEXT,
  criado_por UUID DEFAULT auth.uid(), criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_user ON chat_mensagens(criado_por, criado_em DESC);
ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_msg_auth ON chat_mensagens;
CREATE POLICY chat_msg_auth ON chat_mensagens FOR ALL USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
CREATE TABLE IF NOT EXISTS agente_aprendizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), chave_agente TEXT, contexto TEXT,
  problema TEXT NOT NULL, solucao TEXT, sucesso BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aprend_agente ON agente_aprendizados(chave_agente, criado_em DESC);
ALTER TABLE agente_aprendizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aprend_auth ON agente_aprendizados;
CREATE POLICY aprend_auth ON agente_aprendizados FOR ALL USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
