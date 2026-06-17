import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

/** Última sincronização registrada pela Edge Function sync-sistema. */
export interface SyncLog {
  id: number;
  iniciado_em: string;
  concluido_em: string | null;
  origem: string | null; // 'cron' | 'manual'
  status: string | null; // 'ok' | 'erro' | 'parcial'
  totais: Record<string, number> | null;
  erro: string | null;
}

/** Rótulos amigáveis das tabelas-espelho. */
export const SISTEMA_TABELAS_LABEL: Record<string, string> = {
  sistema_empresas: "Empresas",
  sistema_segmentos: "Segmentos",
  sistema_clientes: "Clientes",
  sistema_produtos: "Produtos",
  sistema_concorrentes: "Concorrentes",
  sistema_representantes: "Representantes",
  sistema_tipo_veiculos: "Tipos de veículo",
  sistema_status_proposta: "Status de proposta",
  sistema_tipo_atividades: "Tipos de atividade",
  sistema_tipo_atividade_respostas: "Respostas de atividade",
  sistema_propostas: "Propostas",
  sistema_proposta_aditivos: "Aditivos",
  sistema_proposta_produtos: "Produtos por proposta",
  sistema_proposta_fretes: "Fretes",
  sistema_proposta_atividades: "Atividades",
};

/** Apelidos das empresas (id da API → sigla). */
export const EMPRESA_APELIDO: Record<number, string> = {
  1: "ML",
  2: "MBV",
  3: "TCL",
  4: "Avalon",
};

export interface SistemaConcorrente {
  id: number;
  nome: string;
}

/** Concorrentes cadastrados no sistema comercial (sincronizados). */
export async function getSistemaConcorrentes(): Promise<SistemaConcorrente[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("sistema_concorrentes")
    .select("id, data")
    .order("id");
  return ((data as { id: number; data: Record<string, unknown> }[]) ?? []).map(
    (r) => ({ id: r.id, nome: (r.data?.nome_concorrente as string) ?? "—" })
  );
}

export async function getUltimaSync(): Promise<SyncLog | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("sistema_sync_log")
    .select("*")
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SyncLog) ?? null;
}

/** Dispara a sincronização sob demanda (Edge Function). Pode levar ~1–2 min. */
export async function dispararSync(): Promise<{
  ok: boolean;
  totais?: Record<string, number>;
  erro?: string;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-sistema");
  if (error) return { ok: false, erro: error.message };
  return {
    ok: data?.status === "ok",
    totais: data?.totais,
    erro: data?.erro ?? undefined,
  };
}

export interface VendaMensal {
  empresa_id: number;
  empresa_nome: string;
  segmento_id: number;
  segmento_nome: string;
  ano: number;
  mes: number;
  ton: number;
  valor: number;
  linhas: number;
}

/** Vendas mensais (proposta → aditivo atual → produtos), opcionalmente por ano. */
export async function getVendasMensais(ano?: number): Promise<VendaMensal[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  let q = supabase.from("mv_vendas_mensal").select("*");
  if (ano) q = q.eq("ano", ano);
  const { data } = await q;
  return ((data as VendaMensal[]) ?? []).map((r) => ({
    ...r,
    ton: Number(r.ton) || 0,
    valor: Number(r.valor) || 0,
  }));
}

/** Anos com vendas disponíveis (desc). */
export async function getAnosVendas(): Promise<number[]> {
  const todas = await getVendasMensais();
  return Array.from(new Set(todas.map((v) => v.ano)))
    .filter((a) => a && a > 2000)
    .sort((a, b) => b - a);
}

/**
 * Converte linhas mensais (mes 1..12 → ton) em 12 frações que somam 1.
 * Base da sazonalidade derivada das vendas reais.
 */
export function fracoesPorMes(linhas: { mes: number; ton: number }[]): number[] {
  const meses = new Array(12).fill(0);
  for (const l of linhas) {
    if (l.mes >= 1 && l.mes <= 12) meses[l.mes - 1] += l.ton || 0;
  }
  const total = meses.reduce((s, v) => s + v, 0);
  if (total <= 0) return new Array(12).fill(1 / 12);
  return meses.map((v) => v / total);
}
