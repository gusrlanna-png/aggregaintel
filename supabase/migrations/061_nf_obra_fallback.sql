-- Melhora o casamento NF→obra: por bairro (único) + FALLBACK quando o cliente
-- tem exatamente UMA obra cadastrada.
create or replace function vincular_nf_obras()
returns int language plpgsql security invoker as $$
declare v1 int; v2 int;
begin
  with cand as (
    select n.id as nf_id, ce.id as end_id
    from notas_fiscais n
    join cliente_enderecos ce on ce.empresa_id = n.cliente_id
    where n.end_entrega is not null and n.end_entrega <> ''
      and ce.bairro is not null and length(ce.bairro) >= 4
      and upper(translate(n.end_entrega, 'ÁÀÃÂÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC'))
          like '%' || upper(translate(ce.bairro, 'ÁÀÃÂÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC')) || '%'
  ),
  unicos as (
    select nf_id, (array_agg(end_id))[1] as end_id
    from cand group by nf_id having count(distinct end_id) = 1
  )
  update notas_fiscais n set endereco_id = u.end_id
  from unicos u where u.nf_id = n.id and n.endereco_id is distinct from u.end_id;
  get diagnostics v1 = row_count;

  with um as (
    select empresa_id, (array_agg(id))[1] as end_id
    from cliente_enderecos group by empresa_id having count(*) = 1
  )
  update notas_fiscais n set endereco_id = um.end_id
  from um where n.cliente_id = um.empresa_id and n.endereco_id is null;
  get diagnostics v2 = row_count;

  return v1 + v2;
end $$;
