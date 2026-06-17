import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface Brinde {
  id: string;
  nome: string;
  estoque: number;
  ativo: boolean;
}

export async function getBrindes(): Promise<Brinde[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brindes")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data as Brinde[]) ?? [];
}

export async function upsertBrinde(b: {
  id?: string;
  nome: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = b.id
    ? await supabase.from("brindes").update({ nome: b.nome }).eq("id", b.id)
    : await supabase.from("brindes").insert({ nome: b.nome });
  if (error) throw error;
}

/** Entrada de estoque (a saída acontece na entrega durante a visita). */
export async function entradaEstoque(
  brinde_id: string,
  quantidade: number,
  observacoes?: string
): Promise<void> {
  if (!isSupabaseConfigured() || quantidade <= 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("brinde_movimentos").insert({
    brinde_id,
    tipo: "entrada",
    quantidade,
    observacoes: observacoes ?? null,
  });
  if (error) throw error;
}

export interface BrindeMovimento {
  id: string;
  brinde_id: string;
  tipo: string;
  quantidade: number;
  cliente_id: string | null;
  pessoa_id: string | null;
  criado_em: string;
  brinde?: { nome: string } | null;
}

/** Histórico de brindes entregues (opcional filtro por pessoa). */
export async function getHistoricoBrindes(
  pessoaId?: string
): Promise<BrindeMovimento[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  let q = supabase
    .from("brinde_movimentos")
    .select("*, brinde:brindes(nome)")
    .eq("tipo", "saida")
    .order("criado_em", { ascending: false })
    .limit(500);
  if (pessoaId) q = q.eq("pessoa_id", pessoaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as BrindeMovimento[]) ?? [];
}
