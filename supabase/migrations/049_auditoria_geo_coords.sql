-- Coordenadas da geolocalização por IP (para link de mapa) no log e no dispositivo.
alter table auditoria_log add column if not exists geo_lat double precision;
alter table auditoria_log add column if not exists geo_lng double precision;

alter table usuario_dispositivos add column if not exists geo_cidade text;
alter table usuario_dispositivos add column if not exists geo_uf text;
alter table usuario_dispositivos add column if not exists geo_pais text;
alter table usuario_dispositivos add column if not exists geo_lat double precision;
alter table usuario_dispositivos add column if not exists geo_lng double precision;
