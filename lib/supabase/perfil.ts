import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { Perfil } from "@/lib/auth/rotas";

export interface AppUsuario {
  id: string;
  nome: string | null;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
  criado_em: string;
}

/** Perfil do usuário logado. Em modo demo (sem Supabase) libera tudo (admin). */
export async function getMeuPerfil(): Promise<Perfil | null> {
  if (!isSupabaseConfigured()) return "admin";
  const supabase = createClient();
  const { data } = await supabase.rpc("meu_perfil");
  return (data as Perfil) ?? null;
}

/** Prefixos de rota liberados ao usuário atual ('*' = todas). Config no banco. */
export async function getMinhasRotas(): Promise<string[]> {
  if (!isSupabaseConfigured()) return ["*"];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("minhas_rotas");
  if (error) return ["*"]; // fail-open: não esconde o menu por erro transitório
  const arr = (data as string[] | null) ?? [];
  return arr.length ? arr : ["*"];
}

/** Decide se uma rota está liberada dada a lista de prefixos ('*' = tudo). */
export function rotaLiberada(rotas: string[], href: string): boolean {
  if (rotas.includes("*")) return true;
  return rotas.some((r) => href === r || href.startsWith(r + "/"));
}

/** Permissões de página/recurso por perfil (matriz admin). */
export interface PerfilRota {
  perfil: string;
  prefixo: string;
}

export async function getPerfilRotas(): Promise<PerfilRota[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("perfil_rotas").select("perfil, prefixo");
  if (error) throw error;
  return (data as PerfilRota[]) ?? [];
}

export async function setPerfilRota(
  perfil: string,
  prefixo: string,
  liberado: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (liberado) {
    const { error } = await supabase
      .from("perfil_rotas")
      .upsert({ perfil, prefixo }, { onConflict: "perfil,prefixo" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("perfil_rotas")
      .delete()
      .eq("perfil", perfil)
      .eq("prefixo", prefixo);
    if (error) throw error;
  }
}

/** Lista de usuários do sistema (visível só para admin, via RLS). */
export async function getUsuarios(): Promise<AppUsuario[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("app_usuarios")
    .select("*")
    .order("perfil")
    .order("email");
  if (error) throw error;
  return (data as AppUsuario[]) ?? [];
}

export async function atualizarUsuario(
  id: string,
  patch: Partial<Pick<AppUsuario, "perfil" | "ativo" | "nome">>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("app_usuarios")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
