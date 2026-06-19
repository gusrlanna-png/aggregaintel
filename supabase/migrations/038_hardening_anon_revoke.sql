-- Hardening: remove acesso do papel anônimo a funções/matviews sensíveis.
-- (authenticated permanece — as views security_invoker dependem disso.)
revoke execute on function public.mesclar_clientes(uuid, uuid[]) from anon;
revoke execute on function public.mesclar_pessoas(uuid, uuid[]) from anon;
revoke execute on function public.sincronizar_socios_cliente(uuid, jsonb) from anon;
revoke execute on function public.sincronizar_socios(uuid, jsonb) from anon;
revoke execute on function public.nf_preco_efetivo_cliente() from anon;
revoke execute on function public.empresa_id_por_cnpj(text) from anon;

revoke select on mv_cfem_resumo from anon;
revoke select on mv_vendas_mensal from anon;

-- spatial_ref_sys (PostGIS): tenta habilitar RLS (em DO p/ não abortar se sem permissão).
do $$
begin
  begin
    execute 'alter table public.spatial_ref_sys enable row level security';
    if not exists (select 1 from pg_policies where tablename='spatial_ref_sys' and policyname='srs_read') then
      execute 'create policy srs_read on public.spatial_ref_sys for select using (true)';
    end if;
  exception when others then
    raise notice 'spatial_ref_sys inalterado: %', sqlerrm;
  end;
end $$;
