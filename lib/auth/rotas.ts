/**
 * Controle de acesso por perfil (RBAC) — organizado por MÓDULOS de negócio.
 * - admin / gestor: acesso total (todos os módulos).
 * - vendedor / gerente: módulo Comercial (campo, clientes, visitas).
 * - analista_inteligencia: módulo Inteligência de Mercado (IDM).
 * - financeiro: módulo Financeiro.
 * Importável pelo middleware (sem dependências de cliente). O banco
 * (perfil_rotas + pode_ver_rota) é a fonte da verdade; isto é o fallback.
 */
export type Perfil =
  | "admin"
  | "gestor"
  | "vendedor"
  | "analista_inteligencia"
  | "financeiro";

/** Comercial — vendedor/gerente em campo. */
export const ROTAS_VENDEDOR = [
  "/dashboard",
  "/visitas",
  "/clientes",
  "/pessoas",
  "/inteligencia",
];

/** Inteligência de Mercado (IDM). */
export const ROTAS_ANALISTA = [
  "/dashboard",
  "/mapa",
  "/concorrentes",
  "/mercados",
  "/mercado",
  "/inteligencia",
  "/projecao",
  "/ranking",
  "/cfem",
  "/produtos",
  "/nf",
  "/grupos",
];

/** Financeiro. */
export const ROTAS_FINANCEIRO = ["/dashboard", "/financeiro"];

const ALLOWLIST: Record<string, string[]> = {
  vendedor: ROTAS_VENDEDOR,
  analista_inteligencia: ROTAS_ANALISTA,
  financeiro: ROTAS_FINANCEIRO,
};

export function podeAcessar(perfil: Perfil | null, pathname: string): boolean {
  if (perfil === "admin" || perfil === "gestor") return true;
  const lista = perfil ? ALLOWLIST[perfil] : null;
  if (lista) {
    return lista.some((r) => pathname === r || pathname.startsWith(r + "/"));
  }
  // Perfil indeterminado (ex.: meu_perfil() falhou transitoriamente): NÃO
  // derruba o usuário autenticado — os dados seguem protegidos por RLS.
  return true;
}
