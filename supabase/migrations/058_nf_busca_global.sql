-- Busca em TODOS os campos da NF (atuais e futuros, via to_jsonb) + nomes de
-- emissor e cliente. Coluna `busca` mantida por trigger; índice trigram p/ ilike.
create extension if not exists pg_trgm;
alter table notas_fiscais add column if not exists busca text;

create or replace function nf_montar_busca(n notas_fiscais)
returns text language sql stable as $$
  select lower(
    coalesce((
      select string_agg(value, ' ')
      from jsonb_each_text(to_jsonb(n))
      where key not in ('xml_nf','fonte_raw','busca','id','emissor_id','cliente_id','endereco_id','fonte_id','criado_em')
    ), '')
    || ' ' || coalesce((select razao_social from empresas where id = n.emissor_id), '')
    || ' ' || coalesce((select fantasia    from empresas where id = n.emissor_id), '')
    || ' ' || coalesce((select razao_social from empresas where id = n.cliente_id), '')
    || ' ' || coalesce((select fantasia    from empresas where id = n.cliente_id), '')
  );
$$;

create or replace function nf_trg_busca() returns trigger language plpgsql as $$
begin
  new.busca := nf_montar_busca(new);
  return new;
end $$;

drop trigger if exists trg_nf_busca on notas_fiscais;
create trigger trg_nf_busca before insert or update on notas_fiscais
  for each row execute function nf_trg_busca();

update notas_fiscais set busca = null;
create index if not exists idx_nf_busca_trgm on notas_fiscais using gin (busca gin_trgm_ops);
