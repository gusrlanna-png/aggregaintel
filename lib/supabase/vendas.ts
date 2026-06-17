import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

/** Dimensões disponíveis para agrupar/organizar o planejamento de vendas. */
export type Dim = "seg" | "prim" | "sec" | "prod" | "grupo" | "mes" | "forn";

/** Coluna real (vendas_meta) usada como filtro de cada dimensão. */
export const DIM_COL: Record<Dim, string> = {
  seg: "segmento",
  prim: "cnpj_primario",
  sec: "cnpj_secundario",
  prod: "produto",
  grupo: "grupo_produto",
  mes: "mes",
  forn: "fornecedor",
};

export const DIM_LABEL: Record<Dim, string> = {
  seg: "Segmento",
  prim: "Cliente",
  sec: "Unidade/Usina",
  prod: "Produto",
  grupo: "Grupo de produto",
  mes: "Mês",
  forn: "Produtor/Fornecedor",
};

/** Ordens (hierarquias) prontas de agrupamento. */
export const ORDENS: Record<string, { label: string; dims: Dim[] }> = {
  cliente: { label: "Cliente → Unidade → Produto → Mês", dims: ["prim", "sec", "prod", "mes"] },
  segmento: { label: "Segmento → Cliente → Produto → Mês", dims: ["seg", "prim", "prod", "mes"] },
  produto: { label: "Produto → Cliente → Mês", dims: ["prod", "prim", "mes"] },
  mes: { label: "Mês → Cliente → Produto", dims: ["mes", "prim", "prod"] },
  produtor: { label: "Produtor → Cliente → Produto", dims: ["forn", "prim", "prod"] },
};

export interface NivelRow {
  chave: string;
  rotulo: string;
  peso_2024: number;
  peso_2025: number;
  peso_meta: number;
  preco_2024: number | null;
  preco_2025: number | null;
  preco_meta: number | null;
}

/** Edita Peso Meta e/ou Preço Meta (persistência em vendas_meta). */
export async function editarMeta(
  fonte: number,
  filtros: Record<string, string>,
  mes: number | null,
  peso: number | null,
  preco: number | null
): Promise<number> {
  const s = createClient();
  const { data, error } = await s.rpc("editar_meta", {
    p_fonte: fonte,
    p_filtros: filtros,
    p_mes: mes,
    p_peso: peso,
    p_preco: preco,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export async function getVendasNivel(
  fonte: number,
  dim: Dim,
  filtros: Record<string, string> = {}
): Promise<NivelRow[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s.rpc("vendas_nivel", {
    p_fonte: fonte,
    p_dim: dim,
    p_filtros: filtros,
  });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    chave: String(r.chave ?? ""),
    rotulo: String(r.rotulo ?? "—"),
    peso_2024: Number(r.peso_2024) || 0,
    peso_2025: Number(r.peso_2025) || 0,
    peso_meta: Number(r.peso_meta) || 0,
    preco_2024: r.preco_2024 != null ? Number(r.preco_2024) : null,
    preco_2025: r.preco_2025 != null ? Number(r.preco_2025) : null,
    preco_meta: r.preco_meta != null ? Number(r.preco_meta) : null,
  }));
}
