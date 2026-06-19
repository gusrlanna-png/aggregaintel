-- Casamento por CNPJ OU CPF (para a sync não duplicar PF após mover o CPF).
create or replace function public.empresa_id_por_cnpj(p_cnpj text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select id from empresas
  where regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g') <> ''
    and (
      regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g')
      or regexp_replace(coalesce(cpf,''), '\D', '', 'g') = regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g')
    )
  order by eh_produtor desc, atualizado_em desc nulls last
  limit 1;
$function$;

-- Move CPFs (11 dígitos) do campo cnpj para o campo cpf (padrão de análise).
update empresas
set cpf = regexp_replace(cnpj, '\D', '', 'g'), cnpj = null
where cnpj is not null
  and length(regexp_replace(cnpj, '\D', '', 'g')) = 11
  and (cpf is null or cpf = '');
