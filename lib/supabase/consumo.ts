import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { FornecedorMix, TracoConsumo } from "./types";
import { MBV } from "@/lib/utils/agregados";
import {
  localInsert,
  localList,
  localRemoveWhere,
  newId,
  nowIso,
} from "@/lib/local/store";

export async function getTracosByCliente(
  clienteId: string
): Promise<TracoConsumo[]> {
  if (!isSupabaseConfigured()) {
    return localList<TracoConsumo>("traco_consumo")
      .filter((t) => t.cliente_id === clienteId)
      .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("traco_consumo")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TracoConsumo[];
}

export async function saveTraco(
  payload: Partial<TracoConsumo> & {
    cliente_id: string;
    segmento: string;
    periodo_tipo: string;
    traco_kg: Record<string, number>;
  }
): Promise<TracoConsumo> {
  if (!isSupabaseConfigured()) {
    const row = {
      id: newId(),
      criado_em: nowIso(),
      ...payload,
    } as TracoConsumo;
    return localInsert<TracoConsumo>("traco_consumo", row);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("traco_consumo")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as TracoConsumo;
}

/** Conjunto de cliente_ids que já possuem ao menos um traço salvo. */
export async function getClienteIdsComTraco(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) {
    return new Set(
      localList<TracoConsumo>("traco_consumo").map((t) => t.cliente_id)
    );
  }
  const supabase = createClient();
  const { data } = await supabase.from("traco_consumo").select("cliente_id");
  return new Set((data ?? []).map((r) => r.cliente_id as string));
}

export async function getFornecedorMix(
  tracoId: string
): Promise<FornecedorMix[]> {
  if (!isSupabaseConfigured()) {
    return localList<FornecedorMix>("fornecedor_mix").filter(
      (m) => m.traco_id === tracoId
    );
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fornecedor_mix")
    .select("*")
    .eq("traco_id", tracoId);
  if (error) throw error;
  return (data ?? []) as FornecedorMix[];
}

export async function saveFornecedorMix(
  tracoId: string,
  rows: Omit<FornecedorMix, "id" | "traco_id">[]
): Promise<void> {
  if (!isSupabaseConfigured()) {
    localRemoveWhere<FornecedorMix>(
      "fornecedor_mix",
      (m) => m.traco_id === tracoId
    );
    for (const r of rows) {
      localInsert<FornecedorMix>("fornecedor_mix", {
        ...r,
        id: newId(),
        traco_id: tracoId,
      } as FornecedorMix);
    }
    return;
  }
  const supabase = createClient();
  await supabase.from("fornecedor_mix").delete().eq("traco_id", tracoId);
  if (rows.length) {
    const { error } = await supabase
      .from("fornecedor_mix")
      .insert(rows.map((r) => ({ ...r, traco_id: tracoId })));
    if (error) throw error;
  }
}

/**
 * Calcula a participação total da MBV em um conjunto de fornecedores,
 * por produto. Retorna { produto: { mbv_pct, oportunidade_pct } }.
 */
export function calcOportunidade(mix: FornecedorMix[]) {
  const porProduto = new Map<string, { mbv: number; total: number }>();
  for (const m of mix) {
    const cur = porProduto.get(m.produto_tipo) ?? { mbv: 0, total: 0 };
    cur.total += m.share_pct;
    const isMbv =
      m.nome_fornecedor?.toLowerCase().includes("mbv") ||
      m.nome_fornecedor === MBV.razao;
    if (isMbv) cur.mbv += m.share_pct;
    porProduto.set(m.produto_tipo, cur);
  }
  const result: Record<string, { mbv_pct: number; oportunidade_pct: number }> =
    {};
  for (const [prod, v] of Array.from(porProduto)) {
    result[prod] = {
      mbv_pct: v.mbv,
      oportunidade_pct: Math.max(0, 100 - v.mbv),
    };
  }
  return result;
}
