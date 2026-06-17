import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface SugestaoConcorrente {
  id: string;
  razao_social: string;
  municipio: string | null;
  distancia_km: number;
  ja_marcado: boolean;
}

/** Sugere concorrentes dentro de um raio (km) por proximidade geográfica. */
export async function getSugestaoConcorrentes(
  emissorId: string,
  raioKm = 60
): Promise<SugestaoConcorrente[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sugerir_concorrentes", {
    p_emissor_id: emissorId,
    p_raio_km: raioKm,
  });
  if (error) throw error;
  return ((data as SugestaoConcorrente[]) ?? []).map((r) => ({
    id: String(r.id),
    razao_social: String(r.razao_social ?? "—"),
    municipio: r.municipio ?? null,
    distancia_km: Number(r.distancia_km) || 0,
    ja_marcado: Boolean(r.ja_marcado),
  }));
}

/** Marca (vincula) um concorrente ao produtor — mútuo. */
export async function marcarConcorrente(
  emissorId: string,
  concorrenteId: string,
  distanciaKm: number,
  origem: "manual" | "auto" = "manual"
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("produtor_concorrente").upsert(
    [
      { emissor_id: emissorId, concorrente_id: concorrenteId, distancia_km: distanciaKm, origem },
      { emissor_id: concorrenteId, concorrente_id: emissorId, distancia_km: distanciaKm, origem },
    ],
    { onConflict: "emissor_id,concorrente_id" }
  );
  if (error) throw error;
}

export async function desmarcarConcorrente(
  emissorId: string,
  concorrenteId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("produtor_concorrente")
    .delete()
    .or(
      `and(emissor_id.eq.${emissorId},concorrente_id.eq.${concorrenteId}),and(emissor_id.eq.${concorrenteId},concorrente_id.eq.${emissorId})`
    );
}
