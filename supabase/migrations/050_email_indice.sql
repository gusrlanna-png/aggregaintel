-- Índice de e-mails M365 por usuário: SÓ metadados + trecho (sem corpo completo).
-- LGPD: o conteúdo integral continua sendo lido ao vivo via Graph (/me).
-- RLS: cada usuário vê apenas os seus; admin (visão master) vê todos.
create table if not exists email_indice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message_id text not null,            -- id do e-mail no Graph
  conversation_id text,
  assunto text,
  preview text,                        -- trecho curto (bodyPreview), não o corpo
  de_nome text,
  de_email text,
  para_emails text[],
  data timestamptz,
  web_link text,
  contato_email text,                  -- e-mail do contato pelo qual foi indexado
  pessoa_id uuid references pessoas(id) on delete set null,
  empresa_id uuid references empresas(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists idx_email_indice_user on email_indice(user_id);
create index if not exists idx_email_indice_pessoa on email_indice(pessoa_id);
create index if not exists idx_email_indice_contato on email_indice(lower(contato_email));
create index if not exists idx_email_indice_data on email_indice(data desc);

alter table email_indice enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='email_indice' and policyname='ei_select') then
    create policy ei_select on email_indice for select to authenticated
      using (user_id = auth.uid() or is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='email_indice' and policyname='ei_insert') then
    create policy ei_insert on email_indice for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='email_indice' and policyname='ei_update') then
    create policy ei_update on email_indice for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='email_indice' and policyname='ei_delete') then
    create policy ei_delete on email_indice for delete to authenticated
      using (user_id = auth.uid() or is_admin());
  end if;
end $$;

revoke all on email_indice from anon, public;
grant select, insert, update, delete on email_indice to authenticated;
