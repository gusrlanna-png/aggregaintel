import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface VisitaMotivo {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface VisitaConcorrenteInput {
  emissor_id?: string | null;
  concorrente_nome?: string | null;
  produto?: string | null;
  preco?: number | null;
  frete_valor?: number | null; // R$/t
  distancia_km?: number | null;
}

export interface NovaVisita {
  cliente_id?: string | null;
  cliente_secundario_id?: string | null;
  cliente_nome_livre?: string | null;
  pessoa_id?: string | null;
  pessoa_nome?: string | null;
  motivo_id?: string | null;
  segmento?: string | null;
  lat?: number | null;
  lng?: number | null;
  distancia_m?: number | null;
  perda_venda?: boolean;
  observacoes?: string | null;
}

export interface Visita extends NovaVisita {
  id: string;
  vendedor_id: string;
  checkin_at: string;
  criado_em: string;
  cliente?: { razao_social: string } | null;
  motivo?: { nome: string } | null;
}

/** Distância em metros entre dois pontos (Haversine). */
export function distanciaMetros(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export async function getMotivos(): Promise<VisitaMotivo[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visita_motivos")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  if (error) throw error;
  return (data as VisitaMotivo[]) ?? [];
}

export async function getVisitas(): Promise<Visita[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visitas")
    .select(
      "*, cliente:clientes!visitas_cliente_id_fkey(razao_social), motivo:visita_motivos(nome)"
    )
    .order("checkin_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as Visita[]) ?? [];
}

export interface VisitaConcorrente extends VisitaConcorrenteInput {
  id: string;
  rs_ton_km: number | null;
}

export async function getVisitaById(
  id: string
): Promise<{ visita: Visita; concorrentes: VisitaConcorrente[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const [{ data: v }, { data: cs }] = await Promise.all([
    supabase
      .from("visitas")
      .select(
        "*, cliente:clientes!visitas_cliente_id_fkey(razao_social), motivo:visita_motivos(nome)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("visita_concorrentes").select("*").eq("visita_id", id),
  ]);
  if (!v) return null;
  return {
    visita: v as Visita,
    concorrentes: (cs as VisitaConcorrente[]) ?? [],
  };
}

/** Cria a visita e os concorrentes citados (calcula R$/t/km). */
export async function criarVisita(
  v: NovaVisita,
  concorrentes: VisitaConcorrenteInput[] = []
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visitas")
    .insert(v)
    .select("id")
    .single();
  if (error) throw error;
  const visitaId = (data as { id: string }).id;

  const linhas = concorrentes
    .filter(
      (c) => c.emissor_id || c.concorrente_nome || c.produto || c.preco != null
    )
    .map((c) => ({
      visita_id: visitaId,
      emissor_id: c.emissor_id || null,
      concorrente_nome: c.concorrente_nome || null,
      produto: c.produto || null,
      preco: c.preco ?? null,
      frete_valor: c.frete_valor ?? null,
      distancia_km: c.distancia_km ?? null,
      rs_ton_km:
        c.frete_valor != null && c.distancia_km
          ? Number((c.frete_valor / c.distancia_km).toFixed(4))
          : null,
    }));
  if (linhas.length) {
    const { error: e2 } = await supabase
      .from("visita_concorrentes")
      .insert(linhas);
    if (e2) throw e2;
  }
  return visitaId;
}

/** Cadastra um cliente novo a partir do campo (fica pendente de validação). */
export async function cadastrarClientePendente(d: {
  razao_social: string;
  segmento?: string | null;
  municipio?: string | null;
  uf?: string | null;
  lat?: number | null;
  lng?: number | null;
  cliente_principal_id?: string | null;
  dono_vendedor_id?: string | null;
}): Promise<{ id: string; razao_social: string }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      razao_social: d.razao_social,
      segmento: d.segmento ?? "outro",
      municipio: d.municipio ?? null,
      uf: d.uf ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      cliente_principal_id: d.cliente_principal_id ?? null,
      dono_vendedor_id: d.dono_vendedor_id ?? null,
      status_validacao: "pendente",
      status: "ativo",
    })
    .select("id, razao_social")
    .single();
  if (error) throw error;
  return data as { id: string; razao_social: string };
}
