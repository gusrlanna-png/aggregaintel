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
  // vendedor (ou perfil desconhecido) → allowlist restrita
  return ROTAS_VENDEDOR.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}
