-- RLS por LINHA em notas_fiscais e pessoas (complementa o escopo de empresas).
-- admin/gestor veem tudo; escrita permanece permissiva (import/OCR/criação).
drop policy if exists acesso_auth on notas_fiscais;
create policy nf_select on notas_fiscais for select to authenticated
  using ((select meu_perfil()) in ('admin','gestor') or empresa_no_escopo(cliente_id));
create policy nf_insert on notas_fiscais for insert to authenticated with check (true);
create policy nf_update on notas_fiscais for update to authenticated using (true) with check (true);
create policy nf_delete on notas_fiscais for delete to authenticated using (true);

drop policy if exists pessoas_auth on pessoas;
create policy pe_select on pessoas for select to authenticated
  using (
    (select meu_perfil()) in ('admin','gestor')
    or exists (select 1 from cliente_pessoas cp where cp.pessoa_id = pessoas.id and empresa_no_escopo(cp.cliente_id))
    or exists (select 1 from socios s where s.pessoa_id = pessoas.id and (empresa_no_escopo(s.emissor_id) or empresa_no_escopo(s.cliente_id)))
    or exists (select 1 from pessoa_identidades pi where pi.pessoa_id = pessoas.id and pi.criado_por = auth.uid())
  );
create policy pe_insert on pessoas for insert to authenticated with check (true);
create policy pe_update on pessoas for update to authenticated using (true) with check (true);
create policy pe_delete on pessoas for delete to authenticated using (true);
