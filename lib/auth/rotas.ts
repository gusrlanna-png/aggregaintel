/**
 * Controle de acesso por perfil (RBAC).
 * - admin / gestor: acesso total.
 * - vendedor: apenas as rotas da allowlist (campo + entrada de informação).
 * Importável pelo middleware (sem dependências de cliente).
 */
export type Perfil = "admin" | "gestor" | "vendedor";

/** Prefixos de rota liberados para o perfil "vendedor". */
export const ROTAS_VENDEDOR = [
  "/dashboard",
  "/visitas",
  "/clientes",
  "/pessoas",
  "/inteligencia",
];

export function podeAcessar(perfil: Perfil | null, pathname: string): boolean {
  if (perfil === "admin" || perfil === "gestor") return true;
  // Apenas o perfil "vendedor" confirmado fica restrito à allowlist.
  if (perfil === "vendedor") {
    return ROTAS_VENDEDOR.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    );
  }
  // Perfil indeterminado (ex.: meu_perfil() falhou transitoriamente): NÃO
  // derruba o usuário autenticado para o dashboard — os dados seguem
  // protegidos por RLS. Evita o bounce indevido de admins em /configuracoes/*.
  return true;
}
