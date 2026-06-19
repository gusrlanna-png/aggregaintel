import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface Fonte {
  id: string;
  nome: string;
  tipo: string;
  url: string | null;
  tabela: string | null;
  ativo: boolean;
  validado: boolean;
  ultima_sync: string | null;
  ultimo_resultado: { total?: number; criadas?: number; atualizadas?: number; erros?: number } | null;
  criado_em: string;
}

export async function getFontes(): Promise<Fonte[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("fontes_dados")
    .select("id, nome, tipo, url, tabela, ativo, validado, ultima_sync, ultimo_resultado, criado_em")
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Fonte[]) ?? [];
}

export async function setFonteAtiva(id: string, ativo: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("fontes_dados").update({ ativo }).eq("id", id);
  if (error) throw error;
}

/** Dispara a sincronização da fonte (importa as NFs para notas_fiscais). */
export async function sincronizarFonte(id: string): Promise<{ total: number; criadas: number; atualizadas: number; erros: number }> {
  const res = await fetch(`/api/fontes/${id}/sync`, { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha na sincronização.");
  return json;
}
