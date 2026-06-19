-- Mapeia domínio de e-mail → empresa, para casar correspondentes de e-mail com
-- clientes. Ignora provedores genéricos e o domínio interno (não identificam
-- empresa). security invoker → respeita RLS de empresas.
create or replace function empresas_por_dominio()
returns table (dominio text, empresa_id uuid, razao_social text, n int)
language sql
stable
security invoker
as $$
  with base as (
    select id, razao_social, lower(split_part(email, '@', 2)) as dom
    from empresas
    where email is not null and email like '%@%'
  )
  select
    dom,
    (array_agg(id order by id))[1] as empresa_id,
    (array_agg(razao_social order by id))[1] as razao_social,
    count(*)::int as n
  from base
  where dom <> ''
    and dom not in (
      'gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.com.br',
      'live.com','icloud.com','bol.com.br','uol.com.br','terra.com.br',
      'msn.com','globo.com','ig.com.br','martinslanna.com.br'
    )
  group by dom;
$$;

revoke all on function empresas_por_dominio() from public, anon;
grant execute on function empresas_por_dominio() to authenticated;
