-- Localiza uma empresa pelo CNPJ (dígitos normalizados) — base do find-or-create
-- nas escritas, para não duplicar CNPJ (e não violar o índice único).
create or replace function public.empresa_id_por_cnpj(p_cnpj text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select id from empresas
  where regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g')
    and regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g') <> ''
  order by eh_produtor desc, atualizado_em desc nulls last
  limit 1;
$function$;
