import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface AcessoLog {
  id: string;
  user_id: string | null;
  email: string | null;
  tipo: string;
  recurso: string | null;
  acao: string | null;
  detalhe: unknown;
  dispositivo_id: string | null;
  ip: string | null;
  geo_cidade: string | null;
  geo_uf: string | null;
  geo_pais: string | null;
  criado_em: string;
}

export interface Dispositivo {
  id: string;
  user_id: string;
  device_id: string;
  label: string | null;
  user_agent: string | null;
  ip: string | null;
  status: "pendente" | "aprovado" | "bloqueado";
  n_acessos: number;
  primeiro_acesso: string;
  ultimo_acesso: string;
}

export async function getAcessosRecentes(limite = 200): Promise<AcessoLog[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("auditoria_log")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as AcessoLog[]) ?? [];
}

export async function getDispositivos(): Promise<Dispositivo[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("usuario_dispositivos")
    .select("*")
    .order("ultimo_acesso", { ascending: false });
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Dispositivo[]) ?? [];
}

export async function setStatusDispositivo(
  id: string,
  status: Dispositivo["status"]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("usuario_dispositivos")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}
