import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { Job } from "@/lib/jobs/client";

export interface Agente {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  ativo: boolean;
  regras: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

export interface JobEvento {
  id: string;
  job_id: string | null;
  agente_chave: string | null;
  nivel: "info" | "sucesso" | "aviso" | "erro";
  mensagem: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
}

export async function getAgentes(): Promise<Agente[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s.from("agentes").select("*").order("nome");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Agente[]) ?? [];
}

export async function toggleAgente(id: string, ativo: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("agentes")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function salvarAgente(a: {
  id?: string;
  chave: string;
  nome: string;
  descricao?: string | null;
  tipo?: string;
  regras?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const payload = {
    chave: a.chave,
    nome: a.nome,
    descricao: a.descricao ?? null,
    tipo: a.tipo ?? "tarefa",
    regras: a.regras ?? {},
    atualizado_em: new Date().toISOString(),
  };
  const { error } = a.id
    ? await s.from("agentes").update(payload).eq("id", a.id)
    : await s.from("agentes").insert(payload);
  if (error) throw error;
}

/** Execuções (jobs) recentes, opcionalmente de um agente específico. */
export async function getExecucoes(agenteChave?: string, limite = 50): Promise<Job[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  let q = s.from("jobs").select("*").order("criado_em", { ascending: false }).limit(limite);
  if (agenteChave) q = q.eq("tipo", agenteChave);
  const { data, error } = await q;
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Job[]) ?? [];
}

/** Log de ações de uma execução. */
export async function getEventos(jobId: string): Promise<JobEvento[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("job_eventos")
    .select("*")
    .eq("job_id", jobId)
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as JobEvento[]) ?? [];
}

/** Métricas por agente para o painel. */
export interface AgenteMetricas {
  total: number;
  concluidos: number;
  erros: number;
  ativos: number;
  ultima: string | null;
}

export async function getMetricasAgente(chave: string): Promise<AgenteMetricas> {
  const execs = await getExecucoes(chave, 200);
  return {
    total: execs.length,
    concluidos: execs.filter((e) => e.status === "concluido").length,
    erros: execs.filter((e) => e.status === "erro").length,
    ativos: execs.filter((e) => e.status === "pendente" || e.status === "processando").length,
    ultima: execs[0]?.criado_em ?? null,
  };
}
