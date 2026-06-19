-- Duas coordenadas por cadastro:
--  • endereco_lat/lng = referencial geocodificado do endereço (CEP+endereço)
--  • lat/lng          = coordenada EFETIVA (usada em cálculos/mapa de decisão)
--  • coord_manual     = true quando o usuário salvou o ponteiro → o geocode NÃO
--                       sobrescreve lat/lng (a coordenada salva prevalece).
alter table empresas add column if not exists endereco_lat double precision;
alter table empresas add column if not exists endereco_lng double precision;
alter table empresas add column if not exists coord_manual boolean not null default false;

-- Marca como manual os cadastros que JÁ têm lat/lng (vieram de ajuste/saved),
-- para o geocode futuro não sobrescrever o que já existe.
update empresas set coord_manual = true where lat is not null and lng is not null and coord_manual = false;
