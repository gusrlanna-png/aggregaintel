-- RPCs do módulo Financeiro (security definer; checam perfil financeiro/admin/gestor).
create or replace function fin_buscar_clientes(p_termo text)
returns table (id uuid, razao_social text, cnpj text, cpf text, municipio text, uf text)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if (select meu_perfil()) not in ('admin','gestor','financeiro') then return; end if;
  return query
    select e.id, e.razao_social, e.cnpj, e.cpf, e.municipio, e.uf
    from empresas e
    where e.eh_cliente and (
      p_termo is null or p_termo = '' or
      e.razao_social ilike '%'||p_termo||'%' or
      e.fantasia ilike '%'||p_termo||'%' or
      regexp_replace(coalesce(e.cnpj,e.cpf,''),'\D','','g') like '%'||regexp_replace(p_termo,'\D','','g')||'%'
    )
    order by e.razao_social
    limit 20;
end $$;
revoke all on function fin_buscar_clientes(text) from anon, public;
grant execute on function fin_buscar_clientes(text) to authenticated;

create or replace function fin_ficha_credito(p_empresa uuid)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare emp record; nf record; n_socios int; meses numeric; media numeric;
begin
  if (select meu_perfil()) not in ('admin','gestor','financeiro') then return null; end if;
  select id, razao_social, cnpj, cpf, municipio, uf, segmento, grupo_economico,
         situacao_cadastral, capital_social, data_fundacao, natureza_juridica, fone, email
    into emp from empresas where id = p_empresa;
  if emp.id is null then return null; end if;
  select count(*)::int into n_socios from socios s where s.cliente_id = p_empresa;
  select count(*) as nfs, coalesce(sum(quantidade_ton),0) as ton,
         coalesce(sum(coalesce(valor_total_nota,valor_total,0)),0) as fat,
         min(data_emissao) as primeira, max(data_emissao) as ultima
    into nf from notas_fiscais
    where cliente_id = p_empresa and coalesce(desconsiderada,false)=false;
  meses := greatest(1, (extract(year from age(coalesce(nf.ultima, now()), coalesce(nf.primeira, now())))*12
            + extract(month from age(coalesce(nf.ultima, now()), coalesce(nf.primeira, now())))) + 1);
  media := case when nf.fat > 0 then nf.fat / meses else 0 end;
  return jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', emp.id, 'razao_social', emp.razao_social, 'cnpj', emp.cnpj, 'cpf', emp.cpf,
      'municipio', emp.municipio, 'uf', emp.uf, 'segmento', emp.segmento,
      'grupo_economico', emp.grupo_economico, 'situacao_cadastral', emp.situacao_cadastral,
      'capital_social', emp.capital_social, 'data_fundacao', emp.data_fundacao,
      'natureza_juridica', emp.natureza_juridica, 'fone', emp.fone, 'email', emp.email),
    'socios', n_socios,
    'nf', jsonb_build_object(
      'nfs', nf.nfs, 'ton', nf.ton, 'faturamento', nf.fat,
      'ticket_medio', case when nf.nfs > 0 then nf.fat/nf.nfs else 0 end,
      'media_mensal', round(media,2), 'meses_ativos', meses,
      'primeira', nf.primeira, 'ultima', nf.ultima),
    'limite_sugerido', round(media * 1.5, 2)
  );
end $$;
revoke all on function fin_ficha_credito(uuid) from anon, public;
grant execute on function fin_ficha_credito(uuid) to authenticated;
