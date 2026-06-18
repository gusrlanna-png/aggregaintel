-- Cadastro único de pessoas: vínculos de identidade de múltiplas fontes
-- (m365, 365/"três meia cinco", contrato, linkedin, instagram, whatsapp,
-- receita_qsa, …), cada uma com seu id de origem, apontando para uma pessoa.
create table if not exists pessoa_identidades (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  fonte text not null,
  external_id text,
  handle text,
  url text,
  raw jsonb,
  criado_em timestamptz not null default now(),
  unique (fonte, external_id)
);
create index if not exists idx_pessoa_identidades_pessoa on pessoa_identidades(pessoa_id);

alter table pessoa_identidades enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='pessoa_identidades' and policyname='pi_auth') then
    create policy pi_auth on pessoa_identidades for all
      using ((select auth.role()) = 'authenticated')
      with check ((select auth.role()) = 'authenticated');
  end if;
end $$;

-- Mescla pessoas duplicadas num "mestre": move todos os vínculos e remove os
-- duplicados. Só repointa pessoa_id entre pessoas válidas (sem mexer em FKs).
create or replace function public.mesclar_pessoas(p_master uuid, p_dups uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_dups uuid[];
begin
  v_dups := array_remove(p_dups, p_master);
  if v_dups is null or array_length(v_dups, 1) is null then return; end if;

  update brinde_movimentos set pessoa_id = p_master where pessoa_id = any(v_dups);
  update visita_pessoas     set pessoa_id = p_master where pessoa_id = any(v_dups);
  update visitas            set pessoa_id = p_master where pessoa_id = any(v_dups);
  update socios             set pessoa_id = p_master where pessoa_id = any(v_dups);
  update pessoa_telefones   set pessoa_id = p_master where pessoa_id = any(v_dups);
  update pessoa_emails      set pessoa_id = p_master where pessoa_id = any(v_dups);
  update pessoa_enderecos   set pessoa_id = p_master where pessoa_id = any(v_dups);
  update pessoa_links       set pessoa_id = p_master where pessoa_id = any(v_dups);
  update pessoa_sociedades  set pessoa_id = p_master where pessoa_id = any(v_dups);

  -- Identidades: move as que o mestre ainda não tem (respeita unique fonte/external_id).
  update pessoa_identidades pi set pessoa_id = p_master
   where pi.pessoa_id = any(v_dups)
     and not exists (
       select 1 from pessoa_identidades m
        where m.pessoa_id = p_master and m.fonte = pi.fonte
          and coalesce(m.external_id,'') = coalesce(pi.external_id,'')
     );

  -- Vínculos cliente↔pessoa: move os não conflitantes.
  update cliente_pessoas cp set pessoa_id = p_master
   where cp.pessoa_id = any(v_dups)
     and not exists (
       select 1 from cliente_pessoas m
        where m.pessoa_id = p_master and m.cliente_id = cp.cliente_id
     );

  -- Vínculos pessoa↔pessoa: repointa e remove auto-vínculos resultantes.
  update pessoa_vinculos set pessoa_a = p_master where pessoa_a = any(v_dups);
  update pessoa_vinculos set pessoa_b = p_master where pessoa_b = any(v_dups);
  delete from pessoa_vinculos where pessoa_a = pessoa_b;

  -- Completa campos vazios do mestre com o duplicado mais recente.
  update pessoas m set
    cpf         = coalesce(m.cpf, d.cpf),
    email       = coalesce(nullif(m.email, ''), d.email),
    fone        = coalesce(nullif(m.fone, ''), d.fone),
    aniversario = coalesce(m.aniversario, d.aniversario),
    logradouro  = coalesce(nullif(m.logradouro, ''), d.logradouro),
    municipio   = coalesce(nullif(m.municipio, ''), d.municipio),
    uf          = coalesce(nullif(m.uf, ''), d.uf),
    cep         = coalesce(nullif(m.cep, ''), d.cep),
    notas       = coalesce(nullif(m.notas, ''), d.notas)
  from (select * from pessoas where id = any(v_dups) order by atualizado_em desc nulls last limit 1) d
  where m.id = p_master;

  delete from pessoas where id = any(v_dups);
end $function$;
