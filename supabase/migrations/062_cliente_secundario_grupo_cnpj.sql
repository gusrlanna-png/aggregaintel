-- Estrutura grupo (CNPJ) e cliente secundário que vinham só em cliente_fonte_raw.
alter table empresas add column if not exists grupo_cnpj text;
alter table empresas add column if not exists cliente_secundario_cnpj text;
alter table empresas add column if not exists cliente_secundario_nome text;

update empresas set
  grupo_cnpj = nullif(nullif(cliente_fonte_raw->>'CLICNPJCPF_GRUPO',''),'NULL'),
  cliente_secundario_cnpj = nullif(nullif(cliente_fonte_raw->>'CLICNPJCPF_SECUNDARIO',''),'NULL'),
  cliente_secundario_nome = nullif(nullif(cliente_fonte_raw->>'CLINOME_SECUNDARIO',''),'NULL')
where cliente_fonte_raw is not null;
