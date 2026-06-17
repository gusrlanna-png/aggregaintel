import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface ProcessoJuridico {
  id: string;
  numero: string | null;
  orgao: string | null;
  tipo: string | null;
  status: string | null;
  risco: string | null;
  descricao: string | null;
  fonte_url: string | null;
  data_ref: string | null;
}
export interface ProcessoAmbiental {
  id: string;
  numero: string | null;
  orgao: string | null;
  tipo: string | null;
  classe: string | null;
  status: string | null;
  descricao: string | null;
  fonte_url: string | null;
  data_ref: string | null;
}
export interface LinkEmpresa {
  id: string;
  tipo: string;
  url: string;
  label: string | null;
}

export async function getProcessosJuridicos(emissorId: string): Promise<ProcessoJuridico[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("processos_juridicos")
    .select("*")
    .eq("emissor_id", emissorId)
    .order("data_ref", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as ProcessoJuridico[]) ?? [];
}

export async function getProcessosAmbientais(emissorId: string): Promise<ProcessoAmbiental[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("processos_ambientais")
    .select("*")
    .eq("emissor_id", emissorId)
    .order("data_ref", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as ProcessoAmbiental[]) ?? [];
}

export async function getLinksEmpresa(emissorId: string): Promise<LinkEmpresa[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("links_empresa")
    .select("id, tipo, url, label")
    .eq("emissor_id", emissorId)
    .order("tipo");
  if (error) throw error;
  return (data as LinkEmpresa[]) ?? [];
}

export async function addProcessoJuridico(
  emissorId: string,
  p: Partial<Omit<ProcessoJuridico, "id">>
): Promise<void> {
  const s = createClient();
  const { error } = await s.from("processos_juridicos").insert({ emissor_id: emissorId, ...p });
  if (error) throw error;
}
export async function addProcessoAmbiental(
  emissorId: string,
  p: Partial<Omit<ProcessoAmbiental, "id">>
): Promise<void> {
  const s = createClient();
  const { error } = await s.from("processos_ambientais").insert({ emissor_id: emissorId, ...p });
  if (error) throw error;
}
export async function addLinkEmpresa(
  emissorId: string,
  tipo: string,
  url: string,
  label?: string
): Promise<void> {
  const s = createClient();
  const { error } = await s
    .from("links_empresa")
    .upsert(
      { emissor_id: emissorId, tipo, url, label: label ?? null },
      { onConflict: "emissor_id,url", ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Substitui (refresh) os processos jurídicos do emissor. */
export async function salvarProcessosJuridicos(
  emissorId: string,
  lista: Partial<Omit<ProcessoJuridico, "id">>[]
): Promise<void> {
  const s = createClient();
  await s.from("processos_juridicos").delete().eq("emissor_id", emissorId);
  if (lista.length === 0) return;
  const { error } = await s
    .from("processos_juridicos")
    .insert(lista.map((p) => ({ emissor_id: emissorId, ...p })));
  if (error) throw error;
}

/** Substitui (refresh) os processos ambientais do emissor. */
export async function salvarProcessosAmbientais(
  emissorId: string,
  lista: Partial<Omit<ProcessoAmbiental, "id">>[]
): Promise<void> {
  const s = createClient();
  await s.from("processos_ambientais").delete().eq("emissor_id", emissorId);
  if (lista.length === 0) return;
  const { error } = await s
    .from("processos_ambientais")
    .insert(lista.map((p) => ({ emissor_id: emissorId, ...p })));
  if (error) throw error;
}

/** Substitui (refresh) os links/presença digital do emissor. */
export async function salvarLinks(
  emissorId: string,
  lista: { tipo: string; url: string; label?: string | null }[]
): Promise<void> {
  const s = createClient();
  await s.from("links_empresa").delete().eq("emissor_id", emissorId);
  const limpos = lista.filter((l) => l.url && l.url.trim());
  if (limpos.length === 0) return;
  const { error } = await s.from("links_empresa").insert(
    limpos.map((l) => ({
      emissor_id: emissorId,
      tipo: l.tipo || "outro",
      url: l.url.trim(),
      label: l.label ?? null,
    }))
  );
  if (error) throw error;
}

export async function removerRegistro(
  tabela: "processos_juridicos" | "processos_ambientais" | "links_empresa",
  id: string
): Promise<void> {
  const s = createClient();
  const { error } = await s.from(tabela).delete().eq("id", id);
  if (error) throw error;
}
