-- Restaura o hardening: views recriadas no fold passam a security_invoker
-- (respeitam a RLS de quem consulta, como o restante do projeto).
alter view emissores set (security_invoker = on);
alter view clientes set (security_invoker = on);
alter view vw_produtores_mercado set (security_invoker = on);
alter view vw_oportunidade_mbv set (security_invoker = on);
alter view vw_producao_emissores set (security_invoker = on);
alter view vw_cliente_carteira set (security_invoker = on);
alter view vw_cliente_mapa set (security_invoker = on);

-- Backup clientes_legacy fora da API: habilita RLS sem policy (bloqueia anon/auth).
alter table clientes_legacy enable row level security;
