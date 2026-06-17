-- 006_push_subscriptions.sql
-- Web Push Notifications (Fase 7)

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT,
  auth        TEXT,
  user_agent  TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Inserção feita via service role (API Route /api/push/subscribe).
-- Leitura permitida a usuários autenticados.
CREATE POLICY "Leitura para autenticados" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'authenticated');
