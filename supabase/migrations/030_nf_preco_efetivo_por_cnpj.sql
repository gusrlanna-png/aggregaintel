-- Preço efetivo médio (R$/t) das NFs recebidas, por CNPJ de cliente, ponderado
-- pelo volume. Reflete o desconto em nota (valor líquido ÷ toneladas). Usado na
-- tela de projeção como "realidade" frente ao valor projetado do BI.
create or replace function public.nf_preco_efetivo_cliente()
returns table(cnpj_digitos text, preco_efetivo numeric, ton numeric, nfs integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') as cnpj_digitos,
    round(
      sum(
        coalesce(nullif(nf.valor_total_nota, 0), nullif(nf.valor_total, 0),
                 coalesce(nf.valor_unitario, 0) * nf.quantidade_ton)
      ) / nullif(sum(nf.quantidade_ton), 0), 2
    ) as preco_efetivo,
    round(sum(nf.quantidade_ton), 2) as ton,
    count(*)::int as nfs
  from notas_fiscais nf
  join clientes c on c.id = nf.cliente_id
  where nf.desconsiderada is not true
    and nf.quantidade_ton > 0
    and regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') <> ''
  group by 1;
$function$;
