import { createClient } from "./client";

const BUCKET = "notas-fiscais";

/**
 * Faz upload do arquivo da NF para o bucket privado "notas-fiscais".
 * Retorna o caminho (path) no storage.
 */
export async function uploadNF(file: File, nfId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${nfId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

/**
 * Gera uma URL assinada (temporária) para visualizar a NF.
 * O bucket é privado, então usamos signed URL em vez de pública.
 */
export async function getNFUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
