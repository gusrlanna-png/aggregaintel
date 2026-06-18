import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface ProjecaoCliente {
  cnpj_digitos: string;
  cnpj: string | null;
  nome: string | null;
  segmento: string | null;
  cidade: string | null;
  valor_realizado: number;
  peso_realizado: number;
  valor_projetado: number;
  peso_projetado: number;
  valor_previsto_ano: number;
  peso_previsto_ano: number;
}

/** Projeção de vendas por cliente (realizado + projetado + previsto do ano). */
export async function getProjecaoClientes(): Promise<ProjecaoCliente[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vw_projecao_cliente")
    .select("*")
    .order("valor_previsto_ano", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data as ProjecaoCliente[]) ?? [];
}

export interface PrecoEfetivoCnpj {
  cnpj_digitos: string;
  preco_efetivo: number;
  ton: number;
  nfs: number;
}

/**
 * Preço efetivo real das NFs por CNPJ (valor líquido ÷ toneladas, ponderado).
 * Devolve um mapa cnpj_digitos → dados, para cruzar com a projeção do BI.
 */
export async function getPrecoEfetivoPorCnpj(): Promise<Map<string, PrecoEfetivoCnpj>> {
  const mapa = new Map<string, PrecoEfetivoCnpj>();
  if (!isSupabaseConfigured()) return mapa;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("nf_preco_efetivo_cliente");
  if (error) throw error;
  for (const r of (data as PrecoEfetivoCnpj[]) ?? []) {
    if (r.cnpj_digitos) mapa.set(r.cnpj_digitos, r);
  }
  return mapa;
}
