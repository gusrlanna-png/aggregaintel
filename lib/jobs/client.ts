import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type JobStatus =
  | "pendente"
  | "processando"
  | "concluido"
  | "parcial"
  | "erro"
  | "cancelado";

export interface Job {
  id: string;
  tipo: string;
  status: JobStatus;
  titulo: string | null;
  progresso: number;
  etapa: string | null;
  erro: string | null;
  resultado: Record<string, unknown> | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  criado_em: string;
  concluido_em: string | null;
}

export interface EnqueueParams {
  tipo: string;
  titulo?: string;
  payload?: Record<string, unknown>;
  entidade_tipo?: string;
  entidade_id?: string;
}

/** Enfileira uma tarefa para rodar em segundo plano no servidor. */
export async function enqueueJob(params: EnqueueParams): Promise<{ jobId: string }> {
  const res = await fetch("/api/jobs/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao enfileirar a tarefa.");
  return json as { jobId: string };
}

/** Jobs recentes (ativos ou concluídos nas últimas horas) do usuário. */
export async function getJobsRecentes(): Promise<Job[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const desde = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await s
    .from("jobs")
    .select("*")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(30);
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Job[]) ?? [];
}

/** Um job específico (para acompanhamento pontual). */
export async function getJob(id: string): Promise<Job | null> {
  if (!isSupabaseConfigured()) return null;
  const s = createClient();
  const { data } = await s.from("jobs").select("*").eq("id", id).maybeSingle();
  return (data as Job) ?? null;
}
