import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface MercadoMembro {
  id: string;
  tipo: "grupo" | "produtor";
  valor: string; // nome do grupo OU id do emissor
}
export interface Mercado {
  id: string;
  nome: string;
  descricao: string | null;
  membros: MercadoMembro[];
}

export async function getMercados(): Promise<Mercado[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .select("id, nome, descricao, mercado_membros(id, tipo, valor)")
    .order("nome");
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((m) => ({
    id: String(m.id),
    nome: String(m.nome),
    descricao: (m.descricao as string) ?? null,
    membros: ((m.mercado_membros as MercadoMembro[]) ?? []).map((x) => ({
      id: String(x.id),
      tipo: x.tipo,
      valor: String(x.valor),
    })),
  }));
}

export async function criarMercado(
  nome: string,
  descricao?: string
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .insert({ nome: nome.trim(), descricao: descricao?.trim() || null })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function excluirMercado(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mercados").delete().eq("id", id);
  if (error) throw error;
}

export async function addMembro(
  mercadoId: string,
  tipo: MercadoMembro["tipo"],
  valor: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("mercado_membros")
    .upsert(
      { mercado_id: mercadoId, tipo, valor },
      { onConflict: "mercado_id,tipo,valor", ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Propaga a renomeação de um grupo para os membros de mercados. */
export async function renomearGrupoNosMercados(
  antigo: string,
  novo: string
): Promise<void> {
  if (!novo.trim() || antigo === novo.trim()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("mercado_membros")
    .update({ valor: novo.trim() })
    .eq("tipo", "grupo")
    .eq("valor", antigo);
  if (error) throw error;
}

export async function removeMembro(membroId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("mercado_membros")
    .delete()
    .eq("id", membroId);
  if (error) throw error;
}

/** Conjunto de ids de emissores que pertencem ao mercado (por grupo ou direto). */
export function emissoresDoMercado(
  mercado: Mercado | null,
  produtores: { id: string; grupo_economico: string | null }[]
): Set<string> | null {
  if (!mercado) return null;
  const grupos = new Set(
    mercado.membros.filter((m) => m.tipo === "grupo").map((m) => m.valor)
  );
  const ids = new Set(
    mercado.membros.filter((m) => m.tipo === "produtor").map((m) => m.valor)
  );
  const out = new Set<string>();
  for (const p of produtores) {
    if (ids.has(p.id) || (p.grupo_economico && grupos.has(p.grupo_economico)))
      out.add(p.id);
  }
  return out;
}
