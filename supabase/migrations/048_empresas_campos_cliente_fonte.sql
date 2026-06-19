-- Campos para receber a importação de tb_clientes (fonte externa) sem perder
-- nada: e-mail, classificação de segmento original da fonte e rastreio de origem.
alter table empresas add column if not exists email text;
alter table empresas add column if not exists segmento_origem text; -- classificação da fonte (CONSUMIDOR FINAL, EDIFICACAO, …)
alter table empresas add column if not exists cliente_externo_cod text; -- CLICOD na fonte
alter table empresas add column if not exists cliente_fonte_id uuid references fontes_dados(id);
alter table empresas add column if not exists cliente_fonte_raw jsonb; -- linha bruta da fonte

-- Resultado da última sincronização de clientes (separado do de NFs).
alter table fontes_dados add column if not exists ultima_sync_clientes timestamptz;
alter table fontes_dados add column if not exists ultimo_resultado_clientes jsonb;
