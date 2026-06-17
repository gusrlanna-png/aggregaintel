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
