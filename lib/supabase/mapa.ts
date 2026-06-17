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

/** Salva coordenadas ajustadas manualmente (cliente ou produtor). */
export async function salvarCoordenadas(
  tabela: "clientes" | "emissores",
  id: string,
  lat: number,
  lng: number
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from(tabela)
    .update({ lat, lng })
    .eq("id", id);
  if (error) throw error;
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
