-- 019 — Bucket de storage das NFs (aplicado via Supabase MCP em 2026-06-17)
-- O bucket "notas-fiscais" nunca tinha sido criado (a 007 só definia policies e
-- pedia criação manual, que não ocorreu). Aqui criamos o bucket privado e as
-- policies de acesso (somente authenticated), com auth.role() em (SELECT ...)
-- para initplan-otimização. Substitui as policies da 007.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notas-fiscais', 'notas-fiscais', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

DROP POLICY IF EXISTS nf_obj_insert ON storage.objects;
CREATE POLICY nf_obj_insert ON storage.objects FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'authenticated' AND bucket_id = 'notas-fiscais');

DROP POLICY IF EXISTS nf_obj_select ON storage.objects;
CREATE POLICY nf_obj_select ON storage.objects FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated' AND bucket_id = 'notas-fiscais');

DROP POLICY IF EXISTS nf_obj_update ON storage.objects;
CREATE POLICY nf_obj_update ON storage.objects FOR UPDATE
  USING ((SELECT auth.role()) = 'authenticated' AND bucket_id = 'notas-fiscais');

DROP POLICY IF EXISTS nf_obj_delete ON storage.objects;
CREATE POLICY nf_obj_delete ON storage.objects FOR DELETE
  USING ((SELECT auth.role()) = 'authenticated' AND bucket_id = 'notas-fiscais');
