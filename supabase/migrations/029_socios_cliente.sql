-- Estende o quadro societário para clientes (antes só emissores/produtores).
alter table socios alter column emissor_id drop not null;
alter table socios add column if not exists cliente_id uuid references clientes(id) on delete cascade;
create index if not exists idx_socios_cliente on socios(cliente_id);

-- Garante que cada sócio pertença a um emissor OU a um cliente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'socios_dono_chk'
  ) then
    alter table socios add constraint socios_dono_chk
      check (emissor_id is not null or cliente_id is not null);
  end if;
end $$;

-- Sincroniza o quadro societário de um CLIENTE (espelho de sincronizar_socios).
create or replace function public.sincronizar_socios_cliente(p_cliente uuid, p_socios jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare s jsonb; v_nome text;
begin
  delete from socios where cliente_id = p_cliente;
  for s in select * from jsonb_array_elements(coalesce(p_socios, '[]'::jsonb)) loop
    v_nome := trim(s->>'nome');
    if v_nome is null or v_nome = '' then continue; end if;
    insert into pessoas(nome) values (v_nome) on conflict (nome) do nothing;
    insert into socios(cliente_id, nome, qualificacao, faixa_etaria, desde, pessoa_id)
      values (p_cliente, v_nome, s->>'qualificacao', s->>'faixa_etaria',
              nullif(s->>'desde','')::date,
              (select id from pessoas where nome = v_nome));
  end loop;
end $function$;
