-- Realizado do produtor (emissor) a partir das NFs reais importadas:
-- volume (ton), faturamento, preço efetivo (R$/t) e volume por mês.
-- Substitui a estimativa por numeração quando há NFs reais da fonte oficial.
create or replace function nf_realizado_emissor(p_ano int default null)
returns table (
  emissor_id uuid,
  razao_social text,
  cnpj text,
  municipio text,
  ton numeric,
  faturamento numeric,
  preco_efetivo numeric,
  nfs bigint,
  primeira date,
  ultima date,
  por_mes jsonb
)
language sql
stable
security invoker
as $$
  with base as (
    select
      n.emissor_id,
      n.data_emissao,
      coalesce(n.quantidade_ton, 0) as ton,
      coalesce(n.valor_total_nota, n.valor_total, 0) as fat
    from notas_fiscais n
    where n.emissor_id is not null
      and coalesce(n.desconsiderada, false) = false
      and n.data_emissao is not null
      and (p_ano is null or extract(year from n.data_emissao) = p_ano)
  ),
  mensal as (
    select emissor_id, to_char(data_emissao, 'MM') as mes, sum(ton) as ton_mes
    from base
    group by emissor_id, to_char(data_emissao, 'MM')
  ),
  mensal_json as (
    select emissor_id, jsonb_object_agg(mes, ton_mes) as por_mes
    from mensal
    group by emissor_id
  ),
  tot as (
    select
      emissor_id,
      sum(ton) as ton,
      sum(fat) as fat,
      count(*) as nfs,
      min(data_emissao) as primeira,
      max(data_emissao) as ultima
    from base
    group by emissor_id
  )
  select
    t.emissor_id,
    e.razao_social,
    e.cnpj,
    e.municipio,
    t.ton,
    t.fat as faturamento,
    case when t.ton > 0 then t.fat / t.ton else null end as preco_efetivo,
    t.nfs,
    t.primeira,
    t.ultima,
    coalesce(m.por_mes, '{}'::jsonb) as por_mes
  from tot t
  join empresas e on e.id = t.emissor_id
  left join mensal_json m on m.emissor_id = t.emissor_id
  order by t.ton desc;
$$;

revoke all on function nf_realizado_emissor(int) from public, anon;
grant execute on function nf_realizado_emissor(int) to authenticated;
