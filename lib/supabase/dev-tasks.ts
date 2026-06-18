import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface DevTask {
  id: string;
  titulo: string | null;
  pedido: string;
  plano: string | null;
  status: "aguardando_aprovacao" | "aprovado" | "recusado" | "concluido";
  prioridade: number;
  provedor: string | null;
  contexto: Record<string, unknown> | null;
  criado_em: string;
}

export async function getDevTasks(): Promise<DevTask[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("dev_tasks")
    .select("*")
    .order("status")
    .order("prioridade", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as DevTask[]) ?? [];
}

export async function setDevTaskStatus(
  id: string,
  status: DevTask["status"]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("dev_tasks")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setDevTaskPrioridade(id: string, prioridade: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("dev_tasks")
    .update({ prioridade, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDevTask(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("dev_tasks").delete().eq("id", id);
  if (error) throw error;
}
