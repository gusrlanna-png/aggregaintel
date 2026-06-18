import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { compressImageForStorage } from "@/lib/utils/image-compress";

const BUCKET = "visita-anexos";

export interface VisitaAnexo {
  id: string;
  visita_id: string;
  tipo: "foto" | "video" | "audio" | "documento" | "link";
  nome: string | null;
  arquivo_url: string | null;
  url: string | null;
  mime: string | null;
  tamanho: number | null;
  criado_em: string;
}

function tipoPorMime(mime: string): VisitaAnexo["tipo"] {
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

export async function getAnexosVisita(visitaId: string): Promise<VisitaAnexo[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("visita_anexos")
    .select("*")
    .eq("visita_id", visitaId)
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as VisitaAnexo[]) ?? [];
}

/** Faz upload de um arquivo (comprime se for foto) e registra o anexo. */
export async function addAnexoArquivo(visitaId: string, file: File): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const arquivo = file.type.startsWith("image/")
    ? await compressImageForStorage(file)
    : file;
  const ext = arquivo.name.split(".").pop() || "bin";
  const path = `${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await s.storage.from(BUCKET).upload(path, arquivo, {
    cacheControl: "3600",
    upsert: false,
    contentType: arquivo.type || undefined,
  });
  if (upErr) throw upErr;
  const { error } = await s.from("visita_anexos").insert({
    visita_id: visitaId,
    tipo: tipoPorMime(arquivo.type),
    nome: file.name,
    arquivo_url: path,
    mime: arquivo.type || null,
    tamanho: arquivo.size,
  });
  if (error) throw error;
}

export async function addAnexoLink(
  visitaId: string,
  url: string,
  nome?: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { error } = await s.from("visita_anexos").insert({
    visita_id: visitaId,
    tipo: "link",
    nome: nome || url,
    url,
  });
  if (error) throw error;
}

export async function deleteAnexoVisita(anexo: VisitaAnexo): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  if (anexo.arquivo_url) {
    await s.storage.from(BUCKET).remove([anexo.arquivo_url]);
  }
  const { error } = await s.from("visita_anexos").delete().eq("id", anexo.id);
  if (error) throw error;
}

/** URL assinada (temporária) para abrir/baixar o anexo do bucket privado. */
export async function getAnexoUrlVisita(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!path || !isSupabaseConfigured()) return null;
  const s = createClient();
  const { data } = await s.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
