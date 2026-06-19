-- Campos restantes da fonte (conhecimento de transporte/CT-e, doc de entrega,
-- doc frete cliente, tipo doc, erro CIOT) + linha bruta da fonte (rede de
-- segurança: nada da planilha fica sem mapeamento).
alter table notas_fiscais add column if not exists tipo_doc_origem text;
alter table notas_fiscais add column if not exists ct_tipo text;
alter table notas_fiscais add column if not exists ct_numero text;
alter table notas_fiscais add column if not exists ct_data date;
alter table notas_fiscais add column if not exists ct_status text;
alter table notas_fiscais add column if not exists doc_frete_cli_numero text;
alter table notas_fiscais add column if not exists doc_frete_cli_data date;
alter table notas_fiscais add column if not exists doc_frete_cli_status text;
alter table notas_fiscais add column if not exists doc_entrega_numero text;
alter table notas_fiscais add column if not exists doc_entrega_data date;
alter table notas_fiscais add column if not exists doc_entrega_ref date;
alter table notas_fiscais add column if not exists doc_entrega_status text;
alter table notas_fiscais add column if not exists ciot_erro text;
alter table notas_fiscais add column if not exists fonte_criado_em timestamptz;
alter table notas_fiscais add column if not exists fonte_raw jsonb;
