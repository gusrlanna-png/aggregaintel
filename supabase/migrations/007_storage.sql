-- 007_storage.sql
-- Políticas de acesso ao bucket privado "notas-fiscais" (Seção 10.1).
-- IMPORTANTE: crie o bucket antes pelo Dashboard ou via CLI:
--   Supabase Dashboard → Storage → New Bucket
--     Nome: notas-fiscais | Público: NÃO | Máx: 50MB
--     Tipos: image/jpeg, image/png, image/webp, application/pdf

CREATE POLICY "Usuários autenticados podem fazer upload"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'notas-fiscais');

CREATE POLICY "Usuários autenticados podem ler"
  ON storage.objects FOR SELECT
  USING (auth.role() = 'authenticated' AND bucket_id = 'notas-fiscais');

CREATE POLICY "Usuários autenticados podem atualizar"
  ON storage.objects FOR UPDATE
  USING (auth.role() = 'authenticated' AND bucket_id = 'notas-fiscais');
