-- FASE 1 / Passo 2: FOLD — clientes viram parte da tabela única de empresas.
-- Estratégia: renomear emissores->empresas (preserva FKs/dados de produtor =
-- origem do sistema), dobrar os clientes dentro, repointar FKs de cliente, e
-- expor emissores/clientes como VIEWS de compatibilidade filtradas por papel
-- (assim leituras .from("emissores")/.from("clientes") e as 5 views analíticas
-- continuam corretas). Transacional: qualquer erro faz rollback.

-- Backup persistente da tabela original (para reversão manual se preciso).
create table if not exists clientes_legacy as table clientes;

-- De-para cliente_id -> empresa_id (dura a transação).
create temporary table _depara (cliente_id uuid primary key, empresa_id uuid not null) on commit drop;

-- 1) Drop das 5 views analíticas (recriadas verbatim ao final, religando às views de papel).
drop view if exists vw_produtores_mercado;
drop view if exists vw_oportunidade_mbv;
drop view if exists vw_producao_emissores;
drop view if exists vw_cliente_carteira;
drop view if exists vw_cliente_mapa;

-- 2) emissores -> empresas (FKs e dados de produtor seguem intactos).
alter table emissores rename to empresas;

-- 3) De-para: overlaps por CNPJ (cliente que já é empresa) + novos ids.
insert into _depara (cliente_id, empresa_id)
select c.id, e.id from clientes c
join empresas e on regexp_replace(coalesce(c.cnpj,''),'\D','','g') = regexp_replace(coalesce(e.cnpj,''),'\D','','g')
where regexp_replace(coalesce(c.cnpj,''),'\D','','g') <> '';
insert into _depara (cliente_id, empresa_id)
select c.id, gen_random_uuid() from clientes c
where c.id not in (select cliente_id from _depara);

-- 4) Overlaps: marca eh_cliente e completa campos vazios da empresa existente.
update empresas e set
  eh_cliente = true,
  fantasia = coalesce(e.fantasia, c.fantasia),
  cpf = coalesce(e.cpf, c.cpf),
  bairro = coalesce(e.bairro, c.bairro),
  segmento = coalesce(e.segmento, c.segmento),
  porte = coalesce(e.porte, c.porte),
  regiao_id = coalesce(e.regiao_id, c.regiao_id),
  dono_vendedor_id = coalesce(e.dono_vendedor_id, c.dono_vendedor_id),
  status_validacao = coalesce(e.status_validacao, c.status_validacao),
  transportadora = coalesce(e.transportadora, c.transportadora),
  contatos = coalesce(e.contatos, c.contatos),
  contato_nome = coalesce(e.contato_nome, c.contato_nome),
  status = coalesce(e.status, c.status),
  geocode_tentado = coalesce(e.geocode_tentado, c.geocode_tentado)
from clientes c join _depara d on d.cliente_id = c.id
where e.id = d.empresa_id and exists (select 1 from empresas pe where pe.id = d.empresa_id and pe.eh_produtor);

-- 5) Novos clientes -> novas linhas de empresa (eh_cliente).
insert into empresas (
  id, razao_social, cnpj, fantasia, cpf, fone, logradouro, bairro, municipio, uf, cep,
  lat, lng, grupo_economico, notas, criado_em, atualizado_em, monitorar,
  eh_produtor, eh_cliente, segmento, porte, regiao_id, dono_vendedor_id,
  status_validacao, transportadora, contatos, contato_nome, status, geocode_tentado
)
select d.empresa_id, c.razao_social, c.cnpj, c.fantasia, c.cpf, c.fone, c.logradouro, c.bairro,
  c.municipio, c.uf, c.cep, c.lat, c.lng, c.grupo_economico, c.notas, c.criado_em, c.atualizado_em, false,
  false, true, c.segmento, c.porte, c.regiao_id, c.dono_vendedor_id,
  c.status_validacao, c.transportadora, c.contatos, c.contato_nome, c.status, c.geocode_tentado
from clientes c join _depara d on d.cliente_id = c.id
where not exists (select 1 from empresas e where e.id = d.empresa_id);

-- 5b) empresa_principal_id (obras/secundários) mapeado via de-para.
update empresas e set empresa_principal_id = d2.empresa_id
from clientes c
join _depara d on d.cliente_id = c.id
join _depara d2 on d2.cliente_id = c.cliente_principal_id
where e.id = d.empresa_id and c.cliente_principal_id is not null;

-- 6) Repontar FKs de cliente: drop FK->clientes, update via de-para, add FK->empresas.
alter table notas_fiscais drop constraint notas_fiscais_cliente_id_fkey;
update notas_fiscais t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table notas_fiscais add constraint notas_fiscais_cliente_id_fkey foreign key (cliente_id) references empresas(id);

alter table brinde_movimentos drop constraint brinde_movimentos_cliente_id_fkey;
update brinde_movimentos t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table brinde_movimentos add constraint brinde_movimentos_cliente_id_fkey foreign key (cliente_id) references empresas(id);

alter table inteligencia_mercado drop constraint inteligencia_mercado_cliente_id_fkey;
update inteligencia_mercado t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table inteligencia_mercado add constraint inteligencia_mercado_cliente_id_fkey foreign key (cliente_id) references empresas(id);

alter table traco_consumo drop constraint traco_consumo_cliente_id_fkey;
update traco_consumo t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table traco_consumo add constraint traco_consumo_cliente_id_fkey foreign key (cliente_id) references empresas(id) on delete cascade;

alter table cliente_pessoas drop constraint cliente_pessoas_cliente_id_fkey;
update cliente_pessoas t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table cliente_pessoas add constraint cliente_pessoas_cliente_id_fkey foreign key (cliente_id) references empresas(id) on delete cascade;

alter table socios drop constraint socios_cliente_id_fkey;
update socios t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table socios add constraint socios_cliente_id_fkey foreign key (cliente_id) references empresas(id) on delete cascade;

alter table visitas drop constraint visitas_cliente_id_fkey;
update visitas t set cliente_id = d.empresa_id from _depara d where t.cliente_id = d.cliente_id;
alter table visitas add constraint visitas_cliente_id_fkey foreign key (cliente_id) references empresas(id);

alter table visitas drop constraint visitas_cliente_secundario_id_fkey;
update visitas t set cliente_secundario_id = d.empresa_id from _depara d where t.cliente_secundario_id = d.cliente_id;
alter table visitas add constraint visitas_cliente_secundario_id_fkey foreign key (cliente_secundario_id) references empresas(id);

-- 7) Remove a tabela clientes (backup em clientes_legacy) e cria views de papel.
drop table clientes;

create view emissores as select * from empresas where eh_produtor;

create view clientes as
  select id, razao_social, fantasia, cnpj, cpf, segmento, logradouro, bairro, municipio,
    uf, cep, lat, lng, fone, transportadora, contato_nome, contatos, grupo_economico,
    status, notas, porte, regiao_id, dono_vendedor_id, status_validacao,
    empresa_principal_id as cliente_principal_id, geocode_tentado, criado_em, atualizado_em
  from empresas where eh_cliente;

-- 8) Recria as 5 views analíticas VERBATIM (religam às views emissores/clientes).
create view vw_produtores_mercado as
 SELECT e.id, e.razao_social, e.cnpj, e.municipio, e.uf, e.grupo_economico, e.eh_mbv,
    e.lat, e.lng, e.tipo, e.status_legal, r.substancias,
    COALESCE(r.cfem_12m, 0::numeric) AS cfem_12m,
    COALESCE(r.cfem_total, 0::numeric) AS cfem_total, r.ultimo_mes,
    COALESCE(r.cfem_12m, 0::numeric) > 0::numeric AS ativo,
    (EXISTS ( SELECT 1 FROM clientes c
       WHERE regexp_replace(c.cnpj, '\D'::text, ''::text, 'g'::text) = regexp_replace(e.cnpj, '\D'::text, ''::text, 'g'::text))) AS tambem_cliente
   FROM emissores e
     LEFT JOIN mv_cfem_resumo r ON r.raiz = "substring"(regexp_replace(e.cnpj, '\D'::text, ''::text, 'g'::text), 1, 8);

create view vw_oportunidade_mbv as
 SELECT c.razao_social, c.segmento, tc.periodo_ref, tc.producao_volume, tc.producao_unit, tc.traco_kg,
    COALESCE(sum(fm.share_pct) FILTER (WHERE e.cnpj = '03.334.595/0001-00'::text), 0::numeric) AS mbv_share_total,
    100::numeric - COALESCE(sum(fm.share_pct) FILTER (WHERE e.cnpj = '03.334.595/0001-00'::text), 0::numeric) AS oportunidade_pct
   FROM traco_consumo tc
     JOIN clientes c ON c.id = tc.cliente_id
     LEFT JOIN fornecedor_mix fm ON fm.traco_id = tc.id
     LEFT JOIN emissores e ON e.id = fm.emissor_id
  GROUP BY c.razao_social, c.segmento, tc.periodo_ref, tc.producao_volume, tc.producao_unit, tc.traco_kg;

create view vw_producao_emissores as
 SELECT e.razao_social, e.municipio, p.periodo_inicio, p.periodo_fim,
    p.volume_est_med AS volume_ton, p.ic_pct, p.peso_medio_ton
   FROM nf_projecao p JOIN emissores e ON e.id = p.emissor_id
  ORDER BY p.volume_est_med DESC;

create view vw_cliente_carteira as
 SELECT c.id AS cliente_id, c.razao_social, c.segmento, c.regiao_id, c.porte, c.dono_vendedor_id,
    cart.id AS carteira_id, cart.nome AS carteira_nome, cart.vendedor_id AS carteira_vendedor,
    COALESCE(c.dono_vendedor_id, cart.vendedor_id) AS vendedor_efetivo
   FROM clientes c
     LEFT JOIN LATERAL ( SELECT k.id, k.nome, k.segmento, k.vendedor_id, k.regioes, k.portes, k.ativo, k.criado_em
           FROM carteiras k
          WHERE k.ativo AND (k.segmento IS NULL OR k.segmento = c.segmento)
            AND (cardinality(k.regioes) = 0 OR (c.regiao_id = ANY (k.regioes)))
            AND (cardinality(k.portes) = 0 OR (c.porte = ANY (k.portes)))
          ORDER BY (CASE WHEN k.segmento IS NOT NULL THEN 1 ELSE 0 END
                  + CASE WHEN cardinality(k.regioes) > 0 THEN 1 ELSE 0 END
                  + CASE WHEN cardinality(k.portes) > 0 THEN 1 ELSE 0 END) DESC
         LIMIT 1) cart ON true;

create view vw_cliente_mapa as
 WITH v AS (
    SELECT vendas_meta.cnpj_secundario AS cnpj, max(vendas_meta.nome_secundario) AS nome,
       max(COALESCE(NULLIF(vendas_meta.fantasia_secundario, '********'::text), vendas_meta.nome_secundario)) AS fantasia,
       (array_agg(vendas_meta.segmento ORDER BY vendas_meta.peso_meta DESC NULLS LAST))[1] AS segmento,
       sum(vendas_meta.peso_2025) AS peso_2025, sum(vendas_meta.peso_meta) AS peso_meta
      FROM vendas_meta
     WHERE vendas_meta.fonte_ano = 2026 AND vendas_meta.cnpj_secundario IS NOT NULL
     GROUP BY vendas_meta.cnpj_secundario)
 SELECT c.id, c.razao_social, c.lat, c.lng, v.fantasia, v.segmento,
    round(COALESCE(v.peso_2025, 0::numeric)) AS peso_2025,
    round(COALESCE(v.peso_meta, 0::numeric)) AS peso_meta,
    CASE WHEN COALESCE(v.peso_2025, 0::numeric) = 0::numeric AND COALESCE(v.peso_meta, 0::numeric) > 0::numeric THEN 'novo'::text
         WHEN v.peso_meta > (v.peso_2025 * 1.15) THEN 'oportunidade'::text
         WHEN v.peso_meta < (v.peso_2025 * 0.85) THEN 'queda'::text
         ELSE 'atendido'::text END AS status
   FROM clientes c
     JOIN v ON regexp_replace(c.cnpj, '\D'::text, ''::text, 'g'::text) = regexp_replace(v.cnpj, '\D'::text, ''::text, 'g'::text)
  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL;

-- 9) mesclar_clientes opera agora sobre empresas (clientes é view).
create or replace function public.mesclar_clientes(p_master uuid, p_dups uuid[])
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_dups uuid[];
begin
  v_dups := array_remove(p_dups, p_master);
  if v_dups is null or array_length(v_dups, 1) is null then return; end if;
  update notas_fiscais set cliente_id = p_master where cliente_id = any(v_dups);
  update visitas set cliente_id = p_master where cliente_id = any(v_dups);
  update visitas set cliente_secundario_id = p_master where cliente_secundario_id = any(v_dups);
  update brinde_movimentos set cliente_id = p_master where cliente_id = any(v_dups);
  update inteligencia_mercado set cliente_id = p_master where cliente_id = any(v_dups);
  update traco_consumo set cliente_id = p_master where cliente_id = any(v_dups);
  update empresas set empresa_principal_id = p_master where empresa_principal_id = any(v_dups);
  update cliente_pessoas cp set cliente_id = p_master
   where cp.cliente_id = any(v_dups)
     and not exists (select 1 from cliente_pessoas m where m.cliente_id = p_master and m.pessoa_id = cp.pessoa_id);
  -- some o papel de cliente dos duplicados; remove os que ficarem sem papel.
  update empresas set eh_cliente = false where id = any(v_dups);
  delete from empresas where id = any(v_dups)
    and not eh_produtor and not eh_cliente and not eh_fornecedor and not eh_transportador;
end $function$;

-- 10) Verificações (abortam a transação se algo estiver errado).
do $$
declare n_emp int; n_cli int; n_prod int; n_nf_orfas int;
begin
  select count(*) into n_emp from empresas;
  select count(*) into n_cli from empresas where eh_cliente;
  select count(*) into n_prod from empresas where eh_produtor;
  select count(*) into n_nf_orfas from notas_fiscais nf
    where nf.cliente_id is not null and not exists (select 1 from empresas e where e.id = nf.cliente_id);
  if n_prod < 1289 then raise exception 'produtores caiu para %, esperado >= 1289', n_prod; end if;
  if n_cli < 2900 then raise exception 'clientes folded = %, esperado ~2934', n_cli; end if;
  if n_nf_orfas > 0 then raise exception 'NFs com cliente_id órfão: %', n_nf_orfas; end if;
  raise notice 'fold ok: empresas=% produtores=% clientes=%', n_emp, n_prod, n_cli;
end $$;
