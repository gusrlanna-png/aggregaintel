-- Aplica perfil a partir do grupo do Entra (chamado no callback do login).
-- SEGURANÇA: só perfis OPERACIONAIS (sem service_role, não auto-escala para
-- admin/gestor — esses seguem manuais). Auto-aprova; nunca rebaixa admin/gestor.
create or replace function aplicar_perfil_entra(p_perfil text)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_perfil not in ('vendedor','analista_inteligencia','financeiro') then return; end if;
  update app_usuarios
    set perfil = p_perfil, ativo = true,
        aprovado_em = coalesce(aprovado_em, now()), atualizado_em = now()
  where id = auth.uid() and perfil not in ('admin','gestor');
end $$;
revoke all on function aplicar_perfil_entra(text) from anon, public;
grant execute on function aplicar_perfil_entra(text) to authenticated;
