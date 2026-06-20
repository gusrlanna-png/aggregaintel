-- IDM (analista_inteligencia) enxerga NFs de mercado; Comercial segue carteira.
drop policy if exists nf_select on notas_fiscais;
create policy nf_select on notas_fiscais for select to authenticated
  using (
    (select meu_perfil()) in ('admin','gestor','analista_inteligencia')
    or cliente_no_escopo(cliente_id)
  );
