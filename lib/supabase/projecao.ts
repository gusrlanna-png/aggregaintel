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
