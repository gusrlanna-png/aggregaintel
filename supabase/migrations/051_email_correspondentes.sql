-- Extração de correspondentes a partir do índice de e-mails (Fase 3).
-- security invoker → respeita a RLS de email_indice (usuário vê os seus;
-- admin vê todos). Agrega remetentes + destinatários com contagem e data.
create or replace function email_correspondentes()
returns table (email text, nome text, n bigint, ultima timestamptz)
language sql
stable
security invoker
as $$
  with todos as (
    select lower(de_email) as email, de_nome as nome, data
    from email_indice
    where de_email is not null and de_email <> ''
    union all
    select lower(x) as email, null::text as nome, data
    from email_indice, unnest(coalesce(para_emails, '{}')) as x
    where x is not null and x <> ''
  )
  select email, max(nome) as nome, count(*) as n, max(data) as ultima
  from todos
  group by email
  order by count(*) desc;
$$;

revoke all on function email_correspondentes() from public, anon;
grant execute on function email_correspondentes() to authenticated;
