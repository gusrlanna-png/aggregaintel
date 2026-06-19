-- Impede duplicidade de CNPJ no cadastro único de empresas (dígitos normalizados).
-- Parcial: ignora cadastros sem CNPJ (obras/avulsos).
create unique index if not exists idx_empresas_cnpj_unico
  on empresas (regexp_replace(cnpj, '\D', '', 'g'))
  where cnpj is not null and regexp_replace(cnpj, '\D', '', 'g') <> '';
