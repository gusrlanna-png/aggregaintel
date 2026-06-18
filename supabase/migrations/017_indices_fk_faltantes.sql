-- 017 — Índices em foreign keys sem cobertura (aplicado via Supabase MCP em 2026-06-17)
-- Origem: Supabase Performance Advisor (lint 0001 unindexed_foreign_keys).
-- FK sem índice = scan na tabela filha em joins/ON DELETE. Adiciona índice em cada uma.
CREATE INDEX IF NOT EXISTS idx_brinde_movimentos_cliente_id ON public.brinde_movimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cliente_principal_id ON public.clientes(cliente_principal_id);
CREATE INDEX IF NOT EXISTS idx_clientes_regiao_id ON public.clientes(regiao_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_mix_emissor_id ON public.fornecedor_mix(emissor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_mix_traco_id ON public.fornecedor_mix(traco_id);
CREATE INDEX IF NOT EXISTS idx_inteligencia_mercado_cliente_id ON public.inteligencia_mercado(cliente_id);
CREATE INDEX IF NOT EXISTS idx_inteligencia_mercado_emissor_id ON public.inteligencia_mercado(emissor_id);
CREATE INDEX IF NOT EXISTS idx_nf_projecao_emissor_id ON public.nf_projecao(emissor_id);
CREATE INDEX IF NOT EXISTS idx_pessoa_sociedades_emissor_id ON public.pessoa_sociedades(emissor_id);
CREATE INDEX IF NOT EXISTS idx_produtor_concorrente_concorrente_id ON public.produtor_concorrente(concorrente_id);
CREATE INDEX IF NOT EXISTS idx_projecao_mensal_emissor_id ON public.projecao_mensal(emissor_id);
CREATE INDEX IF NOT EXISTS idx_traco_consumo_cliente_id ON public.traco_consumo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_visita_concorrentes_emissor_id ON public.visita_concorrentes(emissor_id);
CREATE INDEX IF NOT EXISTS idx_visita_pessoas_pessoa_id ON public.visita_pessoas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_visitas_categoria_id ON public.visitas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_visitas_cliente_secundario_id ON public.visitas(cliente_secundario_id);
CREATE INDEX IF NOT EXISTS idx_visitas_motivo_id ON public.visitas(motivo_id);
CREATE INDEX IF NOT EXISTS idx_visitas_pessoa_id ON public.visitas(pessoa_id);
