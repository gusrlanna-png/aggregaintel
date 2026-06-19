import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { buscarTudo } from "./paginate";

export interface ClienteMapa {
  id: string;
  razao_social: string;
  fantasia: string | null;
  segmento: string | null;
  lat: number | null;
  lng: number | null;
  peso_2025: number;
  peso_meta: number;
  status: "oportunidade" | "atendido" | "queda" | "novo";
}

export const STATUS_CLIENTE: Record<
  ClienteMapa["status"],
  { label: string; cor: string }
> = {
  oportunidade: { label: "Oportunidade (meta > realizado)", cor: "#16a34a" },
  atendido: { label: "Atendido / estável", cor: "#2563eb" },
  queda: { label: "Queda / risco", cor: "#dc2626" },
  novo: { label: "Novo (sem 2025)", cor: "#f59e0b" },
};

/** Salva a coordenada DO MAPA (ajuste manual do ponteiro). Vira coord_manual
 *  = a coordenada salva prevalece sobre a do endereço. Grava na empresa. */
export async function salvarCoordenadas(
  _tabela: "clientes" | "emissores",
  id: string,
  lat: number,
  lng: number
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ lat, lng, coord_manual: true })
    .eq("id", id);
  if (error) throw error;
}

export interface CoordsCadastro {
  lat: number | null;
  lng: number | null;
  endereco_lat: number | null;
  endereco_lng: number | null;
  coord_manual: boolean;
}

/** Lê as duas coordenadas (efetiva e do endereço) de um cadastro (empresa). */
export async function getCoordsCadastro(id: string): Promise<CoordsCadastro | null> {
  if (!isSupabaseConfigured() || !id) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("lat, lng, endereco_lat, endereco_lng, coord_manual")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as CoordsCadastro) ?? null;
}

/**
 * Geocodifica o endereço do cadastro e salva como coordenada referencial
 * (endereco_lat/lng). Se ainda não houver coordenada manual salva, também
 * aplica em lat/lng (a efetiva). Chamar ao atualizar o cadastro.
 */
export async function geocodarCadastro(
  id: string,
  addr: {
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    municipio?: string | null;
    uf?: string | null;
    cep?: string | null;
  }
): Promise<{ lat: number; lng: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addr),
  });
  if (!res.ok) {
    // registra a tentativa para não reprocessar à toa
    try {
      const s = createClient();
      await s.from("empresas").update({ geocode_tentado: new Date().toISOString() }).eq("id", id);
    } catch {}
    return null;
  }
  const { lat, lng } = (await res.json()) as { lat: number; lng: number };
  const supabase = createClient();
  // Lê se a coordenada efetiva é manual (não sobrescrever).
  const { data: atual } = await supabase
    .from("empresas")
    .select("coord_manual")
    .eq("id", id)
    .maybeSingle();
  const patch: Record<string, unknown> = {
    endereco_lat: lat,
    endereco_lng: lng,
    geocode_tentado: new Date().toISOString(),
  };
  if (!(atual as { coord_manual?: boolean } | null)?.coord_manual) {
    patch.lat = lat;
    patch.lng = lng;
  }
  const { error } = await supabase.from("empresas").update(patch).eq("id", id);
  if (error) throw error;
  return { lat, lng };
}

export async function getClientesMapa(): Promise<ClienteMapa[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  return buscarTudo<ClienteMapa>((from, to) =>
    supabase.from("vw_cliente_mapa").select("*").range(from, to)
  ).then((rows) =>
    rows.map((r) => ({
      ...r,
      peso_2025: Number(r.peso_2025) || 0,
      peso_meta: Number(r.peso_meta) || 0,
    }))
  );
}
