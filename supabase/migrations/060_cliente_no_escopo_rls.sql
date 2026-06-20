-- Escopo SÓ por cliente da carteira (sem "mercado") para dados comerciais.
create or replace function cliente_no_escopo(p_empresa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists(
    select 1 from empresas e
    where e.id = p_empresa and e.eh_cliente and (
      e.dono_vendedor_id = auth.uid()
      or exists (select 1 from carteiras k where k.ativo and k.vendedor_id = auth.uid()
        and (k.segmento is null or k.segmento = e.segmento)
        and (cardinality(k.regioes) = 0 or e.regiao_id = any(k.regioes))
        and (cardinality(k.portes) = 0 or e.porte = any(k.portes))))
  );
$function$;
revoke all on function cliente_no_escopo(uuid) from anon, public;
grant execute on function cliente_no_escopo(uuid) to authenticated;

drop policy if exists nf_select on notas_fiscais;
create policy nf_select on notas_fiscais for select to authenticated
  using ((select meu_perfil()) in ('admin','gestor') or cliente_no_escopo(cliente_id));

drop policy if exists pe_select on pessoas;
create policy pe_select on pessoas for select to authenticated
  using (
    (select meu_perfil()) in ('admin','gestor')
    or exists (select 1 from cliente_pessoas cp where cp.pessoa_id = pessoas.id and cliente_no_escopo(cp.cliente_id))
    or exists (select 1 from socios s where s.pessoa_id = pessoas.id and cliente_no_escopo(s.cliente_id))
    or exists (select 1 from socios s where s.pessoa_id = pessoas.id and empresa_no_escopo(s.emissor_id))
    or exists (select 1 from pessoa_identidades pi where pi.pessoa_id = pessoas.id and pi.criado_por = auth.uid())
  );
