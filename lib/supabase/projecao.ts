import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { NFProjecao } from "./types";
import { localGet, localInsert, localUpsert, newId, nowIso } from "@/lib/local/store";

/** Overrides manuais de volume/peso mensal por emissor/série/ano. */
export interface ProjecaoMensalRow {
  id: string; // `${emissorId}:${serie}:${ano}`
  emissor_id: string;
  serie: string;
  ano: number;
  volumes: Record<string, number>; // { "1": 95000, "7": 130000 } (mês 1..12)
  pesos?: Record<string, number>; // peso médio (t) por mês, sobrescreve o global
}

/** Overrides carregados (volume e peso por mês). */
export interface ProjecaoMensalData {
  volumes: Record<string, number>;
  pesos: Record<string, number>;
}

function mensalId(emissorId: string, serie: string, ano: number) {
  return `${emissorId}:${serie || "-"}:${ano}`;
}

export async function getProjecaoMensal(
  emissorId: string,
  serie: string,
  ano: number
): Promise<ProjecaoMensalData> {
  const id = mensalId(emissorId, serie, ano);
  if (!isSupabaseConfigured()) {
    const row = localGet<ProjecaoMensalRow>("projecao_mensal", id);
    return { volumes: row?.volumes ?? {}, pesos: row?.pesos ?? {} };
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("projecao_mensal")
    .select("volumes,pesos")
    .eq("id", id)
    .maybeSingle();
  return {
    volumes: (data?.volumes as Record<string, number>) ?? {},
    pesos: (data?.pesos as Record<string, number>) ?? {},
  };
}

export async function saveProjecaoMensal(
  emissorId: string,
  serie: string,
  ano: number,
  volumes: Record<string, number>,
  pesos: Record<string, number> = {}
): Promise<void> {
  const id = mensalId(emissorId, serie, ano);
  if (!isSupabaseConfigured()) {
    localUpsert<ProjecaoMensalRow>("projecao_mensal", {
      id,
      emissor_id: emissorId,
      serie,
      ano,
      volumes,
      pesos,
    });
    return;
  }
  const supabase = createClient();
  await supabase
    .from("projecao_mensal")
    .upsert({ id, emissor_id: emissorId, serie, ano, volumes, pesos });
}

/** Realizado do produtor a partir das NFs reais importadas (RPC nf_realizado_emissor). */
export interface RealizadoEmissor {
  emissor_id: string;
  razao_social: string | null;
  cnpj: string | null;
  municipio: string | null;
  ton: number;
  faturamento: number;
  preco_efetivo: number | null;
  nfs: number;
  primeira: string | null;
  ultima: string | null;
  por_mes: Record<string, number>;
}

export async function getRealizadoEmissores(
  ano?: number
): Promise<RealizadoEmissor[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("nf_realizado_emissor", {
    p_ano: ano ?? null,
  });
  if (error) {
    // RPC ausente (banco sem migração 046) → não quebra a tela.
    if ((error as { code?: string }).code === "42883") return [];
    throw error;
  }
  // Postgres numeric volta como string no supabase-js → coage p/ número.
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return ((data as Record<string, unknown>[]) ?? []).map((r) => {
    const pm = (r.por_mes as Record<string, unknown>) ?? {};
    const por_mes: Record<string, number> = {};
    for (const k of Object.keys(pm)) por_mes[k] = n(pm[k]);
    return {
      emissor_id: r.emissor_id as string,
      razao_social: (r.razao_social as string) ?? null,
      cnpj: (r.cnpj as string) ?? null,
      municipio: (r.municipio as string) ?? null,
      ton: n(r.ton),
      faturamento: n(r.faturamento),
      preco_efetivo: r.preco_efetivo == null ? null : n(r.preco_efetivo),
      nfs: n(r.nfs),
      primeira: (r.primeira as string) ?? null,
      ultima: (r.ultima as string) ?? null,
      por_mes,
    };
  });
}

export async function saveProjecao(
  payload: Partial<NFProjecao> & {
    emissor_id: string;
    periodo_inicio: string;
    periodo_fim: string;
  }
): Promise<NFProjecao> {
  if (!isSupabaseConfigured()) {
    const row = {
      id: newId(),
      criado_em: nowIso(),
      ...payload,
    } as NFProjecao;
    return localInsert<NFProjecao>("nf_projecao", row);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nf_projecao")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as NFProjecao;
}
