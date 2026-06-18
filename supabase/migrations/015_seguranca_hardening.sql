-- 015 — Hardening de segurança (aplicado via Supabase MCP em 2026-06-17)
-- Origem: Supabase Security Advisor (database linter).
--
-- A) Funções SECURITY DEFINER deixam de ser executáveis por `anon`
--    (qualquer um com a anon key chamaria RPCs que ignoram a RLS).
--    Mantém `authenticated` (como o app as usa). handle_new_user é trigger
--    interno -> revoga de todos (não deve ser RPC).
-- B) Views convertidas de SECURITY DEFINER para SECURITY INVOKER -> passam a
--    respeitar a RLS de quem consulta; visitante sem login fica bloqueado.
-- C) Materialized views removidas do alcance do papel `anon`.

-- A) Funções
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname AS nome
    FROM pg_proc p JOIN pg_roles o ON o.oid = p.proowner
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND o.rolname = 'postgres'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    IF r.nome = 'handle_new_user' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- B) Views -> security_invoker
ALTER VIEW public.vw_cliente_carteira   SET (security_invoker = on);
ALTER VIEW public.vw_producao_emissores SET (security_invoker = on);
ALTER VIEW public.vw_oportunidade_mbv   SET (security_invoker = on);
ALTER VIEW public.vw_pessoas            SET (security_invoker = on);
ALTER VIEW public.vw_cfem_projecao      SET (security_invoker = on);
ALTER VIEW public.vw_cfem_titulos       SET (security_invoker = on);
ALTER VIEW public.vw_projecao_cliente   SET (security_invoker = on);
ALTER VIEW public.vw_produtores_mercado SET (security_invoker = on);
ALTER VIEW public.vw_cliente_mapa       SET (security_invoker = on);

-- C) Materialized views
REVOKE SELECT ON public.mv_vendas_mensal FROM PUBLIC;
REVOKE SELECT ON public.mv_vendas_mensal FROM anon;
GRANT  SELECT ON public.mv_vendas_mensal TO authenticated;
REVOKE SELECT ON public.mv_cfem_resumo FROM PUBLIC;
REVOKE SELECT ON public.mv_cfem_resumo FROM anon;
GRANT  SELECT ON public.mv_cfem_resumo TO authenticated;
