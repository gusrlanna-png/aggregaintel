-- Fase 1 da governança de acessos: auditoria de acessos/ações + registro de dispositivos.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $function$ select exists(select 1 from app_usuarios where id = auth.uid() and perfil = 'admin' and ativo) $function$;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists auditoria_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  tipo text not null default 'acesso',
  recurso text,
  acao text,
  detalhe jsonb,
  dispositivo_id text,
  ip text,
  user_agent text,
  geo_cidade text,
  geo_uf text,
  geo_pais text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_auditoria_user_ts on auditoria_log(user_id, criado_em desc);
create index if not exists idx_auditoria_ts on auditoria_log(criado_em desc);
alter table auditoria_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='auditoria_log' and policyname='audit_insert_own') then
    create policy audit_insert_own on auditoria_log for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='auditoria_log' and policyname='audit_select_admin') then
    create policy audit_select_admin on auditoria_log for select to authenticated using (is_admin());
  end if;
end $$;

create table if not exists usuario_dispositivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text,
  user_agent text,
  ip text,
  status text not null default 'pendente',
  n_acessos integer not null default 1,
  primeiro_acesso timestamptz not null default now(),
  ultimo_acesso timestamptz not null default now(),
  aprovado_por uuid,
  unique (user_id, device_id)
);
create index if not exists idx_dispositivos_user on usuario_dispositivos(user_id);
alter table usuario_dispositivos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='usuario_dispositivos' and policyname='disp_select') then
    create policy disp_select on usuario_dispositivos for select to authenticated using (user_id = auth.uid() or is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='usuario_dispositivos' and policyname='disp_insert_own') then
    create policy disp_insert_own on usuario_dispositivos for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='usuario_dispositivos' and policyname='disp_update') then
    create policy disp_update on usuario_dispositivos for update to authenticated
      using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
  end if;
end $$;
