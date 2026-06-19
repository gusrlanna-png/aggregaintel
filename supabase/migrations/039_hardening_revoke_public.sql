-- Remove EXECUTE do papel público/anônimo nas funções novas (mantém authenticated).
do $$
declare f text;
begin
  foreach f in array array[
    'public.empresa_id_por_cnpj(text)',
    'public.mesclar_clientes(uuid, uuid[])',
    'public.mesclar_pessoas(uuid, uuid[])',
    'public.nf_preco_efetivo_cliente()',
    'public.sincronizar_socios_cliente(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('revoke execute on function %s from anon', f);
    execute format('grant execute on function %s to authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke select on mv_cfem_resumo from public;
revoke select on mv_cfem_resumo from anon;
grant select on mv_cfem_resumo to authenticated;
revoke select on mv_vendas_mensal from public;
revoke select on mv_vendas_mensal from anon;
grant select on mv_vendas_mensal to authenticated;
