-- Fluxo de aprovação de acesso: novo usuário entra PENDENTE (ativo=false) e só
-- acessa após um admin aprovar e definir o perfil.
alter table app_usuarios add column if not exists aprovado_em timestamptz;
alter table app_usuarios add column if not exists aprovado_por uuid;
alter table app_usuarios alter column ativo set default false;

-- Trigger: provisiona no 1º login (M365/magic link) já com nome, perfil vendedor
-- e PENDENTE. on conflict mantém o existente (não rebaixa quem já foi aprovado).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.app_usuarios (id, email, nome, perfil, ativo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'vendedor',
    false
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

-- Status do meu acesso (para o gate e a tela de "aguardando aprovação").
create or replace function public.meu_status()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when not exists (select 1 from app_usuarios where id = auth.uid()) then 'sem_cadastro'
    when exists (select 1 from app_usuarios where id = auth.uid() and ativo) then 'ativo'
    when exists (select 1 from app_usuarios where id = auth.uid() and aprovado_em is not null) then 'bloqueado'
    else 'pendente'
  end;
$function$;
revoke all on function public.meu_status() from anon, public;
grant execute on function public.meu_status() to authenticated;
