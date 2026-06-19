-- Endereços de obras/usinas/fábricas de um cliente (mesmo CNPJ, vários locais de
-- entrega). Cada endereço pode ter segmento próprio (ex.: matriz = concreto,
-- obra = premoldado). Origem da fonte externa preservada (externo_id/fonte_raw).
create table if not exists cliente_enderecos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text,                       -- nome da obra/usina/fábrica
  tipo text,                       -- obra | usina | fabrica | matriz | outro
  segmento text,                   -- concreto | asfalto | premoldado | varejo | outro
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  cep text,
  lat double precision,
  lng double precision,
  ativo boolean not null default true,
  externo_id text,                 -- id do registro na fonte (tb_cliente_enderecos)
  fonte_id uuid references fontes_dados(id),
  fonte_raw jsonb,                 -- linha bruta da fonte (nada fica sem mapear)
  criado_em timestamptz not null default now()
);
create index if not exists idx_cliente_enderecos_empresa on cliente_enderecos(empresa_id);
create unique index if not exists uq_cliente_enderecos_externo
  on cliente_enderecos(fonte_id, externo_id) where externo_id is not null;

alter table cliente_enderecos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cliente_enderecos' and policyname='ce_auth') then
    create policy ce_auth on cliente_enderecos for all
      using ((select auth.role()) = 'authenticated')
      with check ((select auth.role()) = 'authenticated');
  end if;
end $$;

revoke all on cliente_enderecos from anon, public;
grant select, insert, update, delete on cliente_enderecos to authenticated;

-- Vínculo opcional da visita ao endereço/obra atendido.
alter table visitas add column if not exists endereco_id uuid references cliente_enderecos(id);
