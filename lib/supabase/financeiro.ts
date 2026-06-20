import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface ClienteCredito {
  id: string;
  razao_social: string;
  cnpj: string | null;
  cpf: string | null;
  municipio: string | null;
  uf: string | null;
}

export interface FichaCredito {
  empresa: {
    id: string;
    razao_social: string;
    cnpj: string | null;
    cpf: string | null;
    municipio: string | null;
    uf: string | null;
    segmento: string | null;
    grupo_economico: string | null;
    situacao_cadastral: string | null;
    capital_social: number | null;
    data_fundacao: string | null;
    natureza_juridica: string | null;
    fone: string | null;
    email: string | null;
  };
  socios: number;
  nf: {
    nfs: number;
    ton: number;
    faturamento: number;
    ticket_medio: number;
    media_mensal: number;
    meses_ativos: number;
    primeira: string | null;
    ultima: string | null;
  };
  limite_sugerido: number;
}

export interface AnaliseCredito {
  empresa_id: string;
  status: string; // em_analise | aprovado | recusado | suspenso
  risco: string | null; // baixo | medio | alto
  limite_sugerido: number | null;
  limite_aprovado: number | null;
  observacoes: string | null;
  atualizado_em?: string | null;
}

export async function buscarClientesCredito(termo: string): Promise<ClienteCredito[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s.rpc("fin_buscar_clientes", { p_termo: termo ?? "" });
  if (error) return [];
  return (data as ClienteCredito[]) ?? [];
}

export async function getFichaCredito(empresaId: string): Promise<FichaCredito | null> {
  if (!isSupabaseConfigured() || !empresaId) return null;
  const s = createClient();
  const { data, error } = await s.rpc("fin_ficha_credito", { p_empresa: empresaId });
  if (error) throw error;
  return (data as FichaCredito) ?? null;
}

export async function getAnaliseCredito(empresaId: string): Promise<AnaliseCredito | null> {
  if (!isSupabaseConfigured() || !empresaId) return null;
  const s = createClient();
  const { data, error } = await s
    .from("fin_analise_credito")
    .select("empresa_id, status, risco, limite_sugerido, limite_aprovado, observacoes, atualizado_em")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
  return (data as AnaliseCredito) ?? null;
}

export async function salvarAnaliseCredito(
  empresaId: string,
  dados: { status: string; risco: string | null; limite_aprovado: number | null; limite_sugerido: number | null; observacoes: string | null }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("fin_analise_credito")
    .upsert(
      {
        empresa_id: empresaId,
        status: dados.status,
        risco: dados.risco,
        limite_sugerido: dados.limite_sugerido,
        limite_aprovado: dados.limite_aprovado,
        observacoes: dados.observacoes,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id" }
    );
  if (error) throw error;
}
