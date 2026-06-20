-- Módulo Financeiro (Fase 4): análise/ficha de crédito por cliente.
create table if not exists fin_analise_credito (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade unique,
  status text not null default 'em_analise',
  risco text,
  limite_sugerido numeric,
  limite_aprovado numeric,
  observacoes text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_fin_credito_empresa on fin_analise_credito(empresa_id);
alter table fin_analise_credito enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='fin_analise_credito' and policyname='fin_select') then
    create policy fin_select on fin_analise_credito for select to authenticated
      using ((select meu_perfil()) in ('admin','gestor','financeiro'));
  end if;
  if not exists (select 1 from pg_policies where tablename='fin_analise_credito' and policyname='fin_write') then
    create policy fin_write on fin_analise_credito for all to authenticated
      using ((select meu_perfil()) in ('admin','gestor','financeiro'))
      with check ((select meu_perfil()) in ('admin','gestor','financeiro'));
  end if;
end $$;
revoke all on fin_analise_credito from anon, public;
grant select, insert, update, delete on fin_analise_credito to authenticated;
