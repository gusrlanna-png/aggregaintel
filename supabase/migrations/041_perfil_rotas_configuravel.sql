-- Fase 2: controle de acesso por perfil CONFIGURÁVEL no banco (antes hardcoded).
create table if not exists perfil_rotas (
  perfil text not null,
  prefixo text not null,
  primary key (perfil, prefixo)
);
alter table perfil_rotas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='perfil_rotas' and policyname='pr_select') then
    create policy pr_select on perfil_rotas for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='perfil_rotas' and policyname='pr_admin') then
    create policy pr_admin on perfil_rotas for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

insert into perfil_rotas (perfil, prefixo) values
  ('vendedor','/dashboard'),
  ('vendedor','/visitas'),
  ('vendedor','/clientes'),
  ('vendedor','/pessoas'),
  ('vendedor','/inteligencia')
on conflict do nothing;

create or replace function public.pode_ver_rota(p_rota text)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_perfil text;
begin
  select perfil into v_perfil from app_usuarios where id = auth.uid() and ativo;
  if v_perfil is null then return true; end if;
  if v_perfil in ('admin','gestor') then return true; end if;
  return exists (
    select 1 from perfil_rotas
    where perfil = v_perfil and (p_rota = prefixo or p_rota like prefixo || '/%')
  );
end $function$;
revoke execute on function public.pode_ver_rota(text) from anon;
grant execute on function public.pode_ver_rota(text) to authenticated;

create or replace function public.minhas_rotas()
returns setof text language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_perfil text;
begin
  select perfil into v_perfil from app_usuarios where id = auth.uid() and ativo;
  if v_perfil is null or v_perfil in ('admin','gestor') then
    return query select '*'::text; return;
  end if;
  return query select prefixo from perfil_rotas where perfil = v_perfil;
end $function$;
revoke execute on function public.minhas_rotas() from anon;
grant execute on function public.minhas_rotas() to authenticated;
