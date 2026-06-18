-- 018 — Otimização das RLS policies (aplicado via Supabase MCP em 2026-06-17)
-- Origem: Supabase Performance Advisor (lint 0003 auth_rls_initplan).
-- Chamadas auth.role()/auth.uid()/meu_perfil() dentro de USING/WITH CHECK eram
-- reavaliadas POR LINHA. Envolvê-las em (SELECT ...) faz o Postgres avaliar uma
-- vez por query (initPlan). Ganho relevante em tabelas grandes (cfem_historico,
-- vendas_meta, projecao_base, sistema_proposta_*).
-- Usa ALTER POLICY (altera só a expressão; mantém cmd/roles/tipo da policy).
DO $$
DECLARE
  r record;
  nq text;
  nc text;
  stmt text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( qual ~ '(auth\.(role|uid|jwt|email)\(\)|meu_perfil\(\))'
         OR with_check ~ '(auth\.(role|uid|jwt|email)\(\)|meu_perfil\(\))' )
  LOOP
    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      nq := regexp_replace(r.qual, '(auth\.(role|uid|jwt|email)\(\)|meu_perfil\(\))', '(SELECT \1)', 'g');
      stmt := stmt || format(' USING (%s)', nq);
    END IF;
    IF r.with_check IS NOT NULL THEN
      nc := regexp_replace(r.with_check, '(auth\.(role|uid|jwt|email)\(\)|meu_perfil\(\))', '(SELECT \1)', 'g');
      stmt := stmt || format(' WITH CHECK (%s)', nc);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
