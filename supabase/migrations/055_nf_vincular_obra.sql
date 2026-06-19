-- Vínculo NF → obra/usina de entrega (cliente_enderecos). A NF traz só texto
-- livre (end_entrega); casamos pelo BAIRRO da obra, e só quando há UMA única
-- obra do cliente que casa (conservador — evita vínculo errado).
alter table notas_fiscais add column if not exists endereco_id uuid references cliente_enderecos(id);
create index if not exists idx_nf_endereco on notas_fiscais(endereco_id);

create or replace function vincular_nf_obras()
returns int
language plpgsql
security invoker
as $$
declare v int;
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
    from cand
    group by nf_id
    having count(distinct end_id) = 1
  )
  update notas_fiscais n
  set endereco_id = u.end_id
  from unicos u
  where u.nf_id = n.id and n.endereco_id is distinct from u.end_id;
  get diagnostics v = row_count;
  return v;
end $$;

revoke all on function vincular_nf_obras() from public, anon;
grant execute on function vincular_nf_obras() to authenticated;
