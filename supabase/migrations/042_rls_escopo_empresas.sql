-- Fase 3: escopo por linha em empresas. admin/gestor veem tudo; vendedor vê
-- produtores/fornecedores/transportadores (mercado) + clientes da sua carteira
-- (dono_vendedor_id ou regra de carteira). Validado via simulação (rollback).
-- Zero impacto nos usuários atuais (todos admin → cláusula admin = true).

create or replace function public.empresa_no_escopo(p_empresa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists(
    select 1 from empresas e
    where e.id = p_empresa and (e.eh_produtor or e.eh_fornecedor or e.eh_transportador)
  )
  or exists(
    select 1 from empresas e
    where e.id = p_empresa and e.eh_cliente and (
      e.dono_vendedor_id = auth.uid()
      or exists (
        select 1 from carteiras k
        where k.ativo and k.vendedor_id = auth.uid()
          and (k.segmento is null or k.segmento = e.segmento)
          and (cardinality(k.regioes) = 0 or e.regiao_id = any(k.regioes))
          and (cardinality(k.portes) = 0 or e.porte = any(k.portes))
      )
    )
  );
$fn$;
revoke execute on function public.empresa_no_escopo(uuid) from anon;
grant execute on function public.empresa_no_escopo(uuid) to authenticated;

drop policy if exists acesso_auth on empresas;
drop policy if exists emp_select on empresas;
drop policy if exists emp_insert on empresas;
drop policy if exists emp_update on empresas;
drop policy if exists emp_delete on empresas;
create policy emp_select on empresas for select to authenticated
  using (coalesce(meu_perfil(), 'admin') in ('admin','gestor') or empresa_no_escopo(id));
create policy emp_insert on empresas for insert to authenticated with check (true);
create policy emp_update on empresas for update to authenticated using (true) with check (true);
create policy emp_delete on empresas for delete to authenticated using (true);
