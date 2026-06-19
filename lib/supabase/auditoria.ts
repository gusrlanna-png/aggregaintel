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
  geo_lat: number | null;
  geo_lng: number | null;
  user_agent: string | null;
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
  geo_cidade: string | null;
  geo_uf: string | null;
  geo_pais: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  email?: string | null;
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
  const lista = (data as Dispositivo[]) ?? [];
  // Resolve o e-mail/nome do dono (app_usuarios) para exibição.
  const ids = [...new Set(lista.map((d) => d.user_id).filter(Boolean))];
  if (ids.length) {
    const { data: us } = await s.from("app_usuarios").select("id, nome, email").in("id", ids);
    const mapa = new Map(
      (us ?? []).map((u: { id: string; nome: string | null; email: string | null }) => [
        u.id,
        u.nome || u.email,
      ])
    );
    for (const d of lista) d.email = mapa.get(d.user_id) ?? null;
  }
  return lista;
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
