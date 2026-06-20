-- Busca da NF sem acento (translate) — fuzzy igual ao matchBusca do cliente.
create or replace function nf_montar_busca(n notas_fiscais)
returns text language sql stable as $$
  select translate(
    lower(
      coalesce((
        select string_agg(value, ' ')
        from jsonb_each_text(to_jsonb(n))
        where key not in ('xml_nf','fonte_raw','busca','id','emissor_id','cliente_id','endereco_id','fonte_id','criado_em')
      ), '')
      || ' ' || coalesce((select razao_social from empresas where id = n.emissor_id), '')
      || ' ' || coalesce((select fantasia    from empresas where id = n.emissor_id), '')
      || ' ' || coalesce((select razao_social from empresas where id = n.cliente_id), '')
      || ' ' || coalesce((select fantasia    from empresas where id = n.cliente_id), '')
    ),
    'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'
  );
$$;
update notas_fiscais set busca = null;
