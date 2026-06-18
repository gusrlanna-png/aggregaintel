-- 026 — Anexos de visitas: bucket + tabela (aplicado via MCP 2026-06-18)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visita-anexos','visita-anexos',false,104857600,NULL)
ON CONFLICT (id) DO UPDATE SET file_size_limit=EXCLUDED.file_size_limit;
DROP POLICY IF EXISTS va_obj_insert ON storage.objects;
CREATE POLICY va_obj_insert ON storage.objects FOR INSERT WITH CHECK ((SELECT auth.role())='authenticated' AND bucket_id='visita-anexos');
DROP POLICY IF EXISTS va_obj_select ON storage.objects;
CREATE POLICY va_obj_select ON storage.objects FOR SELECT USING ((SELECT auth.role())='authenticated' AND bucket_id='visita-anexos');
DROP POLICY IF EXISTS va_obj_delete ON storage.objects;
CREATE POLICY va_obj_delete ON storage.objects FOR DELETE USING ((SELECT auth.role())='authenticated' AND bucket_id='visita-anexos');
CREATE TABLE IF NOT EXISTS visita_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visita_id UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'documento', nome TEXT, arquivo_url TEXT, url TEXT, mime TEXT, tamanho BIGINT,
  criado_por UUID DEFAULT auth.uid(), criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visita_anexos_visita ON visita_anexos(visita_id, criado_em);
ALTER TABLE visita_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visita_anexos_auth ON visita_anexos;
CREATE POLICY visita_anexos_auth ON visita_anexos FOR ALL USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
