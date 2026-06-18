-- 028 — Valor líquido da NF + motorista + transportadora do cliente (MCP 2026-06-18)
-- Preço EFETIVO = valor líquido ÷ peso (reflete desconto em nota) — referência do planejamento.
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS valor_total_nota NUMERIC;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS motorista_nome TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS transportadora TEXT;
