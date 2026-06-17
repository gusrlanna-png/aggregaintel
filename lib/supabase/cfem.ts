import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { CfemAnm } from "./types";
import { localList } from "@/lib/local/store";

export async function getCfem(): Promise<CfemAnm[]> {
  if (!isSupabaseConfigured()) {
    return localList<CfemAnm>("cfem_anm");
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cfem_anm")
    .select("*")
    .order("cfem_acumulado", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CfemAnm[];
}

const soDigitos = (s?: string | null) => (s ?? "").replace(/\D/g, "");

export interface CfemTitulo {
  cnpj_digitos: string;
  cpf_cnpj: string;
  processo: string;
  substancia: string;
  uf: string | null;
  municipio: string | null;
  lancamentos: number;
  cfem_total: number;
  ultimo_mes: string | null;
}

export interface CfemProjMes {
  ano: number;
  mes: number;
  cfem: number;
  faturamento: number;
  toneladas: number | null;
}

/** Títulos/processos CFEM do produtor (casa pela RAIZ do CNPJ — 8 dígitos). */
export async function getCfemTitulos(cnpj?: string | null): Promise<CfemTitulo[]> {
  const raiz = soDigitos(cnpj).slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vw_cfem_titulos")
    .select("*")
    .like("cnpj_digitos", `${raiz}%`)
    .order("cfem_total", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CfemTitulo[];
}

/** Projeção mensal (CFEM, faturamento estimado e toneladas) do produtor. */
export async function getCfemProjecao(
  cnpj?: string | null,
  preco = 50
): Promise<CfemProjMes[]> {
  const raiz = soDigitos(cnpj).slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cfem_projecao_mensal", {
    p_cnpj: raiz,
    p_preco: preco,
  });
  if (error) throw error;
  return ((data as CfemProjMes[]) ?? []).map((r) => ({
    ano: Number(r.ano),
    mes: Number(r.mes),
    cfem: Number(r.cfem) || 0,
    faturamento: Number(r.faturamento) || 0,
    toneladas: r.toneladas != null ? Number(r.toneladas) : null,
  }));
}

export interface TituloMinerario {
  numero: number;
  ano: number;
  processo: string | null;
  fase: string | null;
  substancia: string | null;
  uso: string | null;
  area_ha: number | null;
  uf: string | null;
  titular_nome: string | null;
  ult_evento: string | null;
}

/** Títulos minerários (SIGMINE/ANM) do produtor, por raiz do CNPJ. */
export async function getTitulosMinerarios(
  cnpj?: string | null
): Promise<TituloMinerario[]> {
  const raiz = soDigitos(cnpj).slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("titulos_minerarios")
    .select("*")
    .like("cnpj", `${raiz}%`)
    .order("ano", { ascending: false });
  if (error) throw error;
  return (data as TituloMinerario[]) ?? [];
}

export interface CfemTituloMes {
  processo: string;
  substancia: string;
  ano: number;
  mes: number;
  valor: number;
}

/** Abertura mensal do CFEM por título (processo) do produtor. */
export async function getCfemTituloMensal(
  cnpj?: string | null
): Promise<CfemTituloMes[]> {
  const raiz = soDigitos(cnpj).slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cfem_titulo_mensal", {
    p_cnpj: raiz,
  });
  if (error) throw error;
  return ((data as CfemTituloMes[]) ?? []).map((r) => ({
    processo: String(r.processo),
    substancia: String(r.substancia ?? ""),
    ano: Number(r.ano),
    mes: Number(r.mes),
    valor: Number(r.valor) || 0,
  }));
}

/** Liga/desliga o monitoramento mensal ANM deste produtor. */
export async function setMonitorarAnm(
  emissorId: string,
  valor: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("emissores")
    .update({ monitorar: valor })
    .eq("id", emissorId);
  if (error) throw error;
}

export interface ResumoSyncAnm {
  ok: boolean;
  titulos_upsert?: number;
  produtores_renomeados?: number;
  ms?: number;
  erro?: string;
}

/** Dispara o agente ANM/SIGMINE sob demanda (Edge Function sync-anm). */
export async function sincronizarAnm(): Promise<ResumoSyncAnm> {
  if (!isSupabaseConfigured()) return { ok: false, erro: "Supabase não configurado" };
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-anm");
  if (error) throw error;
  return data as ResumoSyncAnm;
}

/** Preço médio de mercado (R$/t) a partir do planejamento (vendas_meta). */
export async function getPrecoMercado(): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase.rpc("preco_medio_mercado");
  return data != null ? Number(data) : null;
}
