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
