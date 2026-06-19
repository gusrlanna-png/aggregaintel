-- Expande a denylist de provedores genéricos (inclui variantes .com.br e mais).
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
      'gmail.com','gmail.com.br','googlemail.com',
      'hotmail.com','hotmail.com.br','outlook.com','outlook.com.br',
      'live.com','live.com.br','msn.com',
      'yahoo.com','yahoo.com.br','ymail.com',
      'icloud.com','me.com',
      'bol.com.br','uol.com.br','terra.com.br','ig.com.br','globo.com',
      'globomail.com','oi.com.br','r7.com','zipmail.com.br',
      'martinslanna.com.br'
    )
  group by dom;
$$;
