import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface Regiao {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Carteira {
  id: string;
  nome: string;
  segmento: string | null;
  vendedor_id: string | null;
  regioes: string[];
  portes: string[];
  ativo: boolean;
}

export const PORTES: { v: string; label: string }[] = [
  { v: "P", label: "Pequeno" },
  { v: "M", label: "Médio" },
  { v: "G", label: "Grande" },
];

export async function getRegioes(): Promise<Regiao[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("regioes")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data as Regiao[]) ?? [];
}

export async function upsertRegiao(r: {
  id?: string;
  nome: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = r.id
    ? await supabase.from("regioes").update({ nome: r.nome }).eq("id", r.id)
    : await supabase.from("regioes").insert({ nome: r.nome });
  if (error) throw error;
}

export async function getCarteiras(): Promise<Carteira[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("carteiras")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data as Carteira[]) ?? [];
}

export async function upsertCarteira(
  c: Partial<Carteira> & { nome: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const payload = {
    nome: c.nome,
    segmento: c.segmento ?? null,
    vendedor_id: c.vendedor_id ?? null,
    regioes: c.regioes ?? [],
    portes: c.portes ?? [],
    ativo: c.ativo ?? true,
  };
  const { error } = c.id
    ? await supabase.from("carteiras").update(payload).eq("id", c.id)
    : await supabase.from("carteiras").insert(payload);
  if (error) throw error;
}

export async function deleteCarteira(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase.from("carteiras").delete().eq("id", id);
  if (error) throw error;
}

/** Segmentos distintos presentes nos clientes (para definir a carteira). */
export async function getSegmentosClientes(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("segmento")
    .not("segmento", "is", null)
    .limit(5000);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) if (r.segmento) set.add(r.segmento as string);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
