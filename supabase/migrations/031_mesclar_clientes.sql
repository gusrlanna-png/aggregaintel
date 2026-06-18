-- Mescla clientes duplicados num único "mestre": repointa todos os dados
-- históricos para o mestre, completa campos vazios e remove os duplicados.
create or replace function public.mesclar_clientes(p_master uuid, p_dups uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_dups uuid[];
begin
  v_dups := array_remove(p_dups, p_master);
  if v_dups is null or array_length(v_dups, 1) is null then return; end if;

  -- Repointa dados históricos do(s) duplicado(s) para o mestre.
  update notas_fiscais   set cliente_id = p_master where cliente_id = any(v_dups);
  update visitas         set cliente_id = p_master where cliente_id = any(v_dups);
  update visitas         set cliente_secundario_id = p_master where cliente_secundario_id = any(v_dups);
  update brinde_movimentos set cliente_id = p_master where cliente_id = any(v_dups);
  update inteligencia_mercado set cliente_id = p_master where cliente_id = any(v_dups);
  update traco_consumo   set cliente_id = p_master where cliente_id = any(v_dups);
  -- Obras/secundários que apontavam para um duplicado passam a apontar ao mestre.
  update clientes set cliente_principal_id = p_master where cliente_principal_id = any(v_dups);

  -- Contatos: move os que o mestre ainda não tem (evita violar (cliente_id, pessoa_id)).
  update cliente_pessoas cp set cliente_id = p_master
   where cp.cliente_id = any(v_dups)
     and not exists (
       select 1 from cliente_pessoas m
        where m.cliente_id = p_master and m.pessoa_id = cp.pessoa_id
     );

  -- Completa campos vazios do mestre com os do duplicado mais recente.
  update clientes m set
    cnpj            = coalesce(m.cnpj, d.cnpj),
    cpf             = coalesce(m.cpf, d.cpf),
    fantasia        = coalesce(nullif(m.fantasia, ''), d.fantasia),
    fone            = coalesce(nullif(m.fone, ''), d.fone),
    logradouro      = coalesce(nullif(m.logradouro, ''), d.logradouro),
    bairro          = coalesce(nullif(m.bairro, ''), d.bairro),
    municipio       = coalesce(nullif(m.municipio, ''), d.municipio),
    uf              = coalesce(nullif(m.uf, ''), d.uf),
    cep             = coalesce(nullif(m.cep, ''), d.cep),
    lat             = coalesce(m.lat, d.lat),
    lng             = coalesce(m.lng, d.lng),
    transportadora  = coalesce(nullif(m.transportadora, ''), d.transportadora),
    grupo_economico = coalesce(nullif(m.grupo_economico, ''), d.grupo_economico)
  from (
    select * from clientes where id = any(v_dups)
    order by atualizado_em desc nulls last limit 1
  ) d
  where m.id = p_master;

  -- Remove os duplicados (cascata cuida de contatos/sócios/traço remanescentes).
  delete from clientes where id = any(v_dups);
end $function$;
