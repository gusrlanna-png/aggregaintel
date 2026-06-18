-- 023 — Campos de transporte faltantes na NF (aplicado via MCP 2026-06-18)
-- Código ANTT, CNPJ e IE do transportador (DANFE). Mapeados pela IA (PROMPT_OCR),
-- preenchidos no salvamento e exibidos no detalhe da NF.
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS codigo_antt TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS transportador_doc TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS transportador_ie TEXT;
