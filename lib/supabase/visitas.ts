import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface VisitaMotivo {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface VisitaCategoria {
  id: string;
  nome: string;
  ordem: number;
  exige_brinde: boolean;
  ativo: boolean;
}

export interface VisitaConcorrenteInput {
  emissor_id?: string | null;
  concorrente_nome?: string | null;
  produto?: string | null;
  volume?: number | null;
  preco?: number | null;
  frete_valor?: number | null; // R$/t
  distancia_km?: number | null;
}

export interface VisitaPessoaInput {
  pessoa_id?: string | null;
  pessoa_nome?: string | null;
  cargo?: string | null;
}

export interface BrindeEntregaInput {
  brinde_id: string;
  quantidade: number;
  cliente_id?: string | null;
  pessoa_id?: string | null;
}

export interface NovaVisita {
  cliente_id?: string | null;
  cliente_secundario_id?: string | null;
  cliente_nome_livre?: string | null;
  pessoa_id?: string | null;
  pessoa_nome?: string | null;
  motivo_id?: string | null;
  categoria_id?: string | null;
  segmento?: string | null;
  lat?: number | null;
  lng?: number | null;
  distancia_m?: number | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
  avulsa?: boolean;
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

export async function getCategorias(): Promise<VisitaCategoria[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("visita_categorias")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  if (error) throw error;
  return (data as VisitaCategoria[]) ?? [];
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

export interface VisitaPessoaRow {
  id: string;
  pessoa_id: string | null;
  pessoa_nome: string | null;
  cargo: string | null;
}
export interface VisitaBrindeRow {
  id: string;
  quantidade: number;
  brinde?: { nome: string } | null;
}

export async function getVisitaById(id: string): Promise<{
  visita: Visita & { categoria?: { nome: string } | null };
  concorrentes: VisitaConcorrente[];
  pessoas: VisitaPessoaRow[];
  brindes: VisitaBrindeRow[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const [{ data: v }, { data: cs }, { data: ps }, { data: bs }] =
    await Promise.all([
      supabase
        .from("visitas")
        .select(
          "*, cliente:clientes!visitas_cliente_id_fkey(razao_social), motivo:visita_motivos(nome), categoria:visita_categorias(nome)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("visita_concorrentes").select("*").eq("visita_id", id),
      supabase.from("visita_pessoas").select("*").eq("visita_id", id),
      supabase
        .from("brinde_movimentos")
        .select("id, quantidade, brinde:brindes(nome)")
        .eq("visita_id", id),
    ]);
  if (!v) return null;
  return {
    visita: v as Visita & { categoria?: { nome: string } | null },
    concorrentes: (cs as VisitaConcorrente[]) ?? [],
    pessoas: (ps as VisitaPessoaRow[]) ?? [],
    brindes: (bs as unknown as VisitaBrindeRow[]) ?? [],
  };
}

/** Cria a visita com pessoas, detalhamento comercial (R$/t/km) e brindes entregues. */
export async function criarVisita(
  v: NovaVisita,
  opts: {
    pessoas?: VisitaPessoaInput[];
    concorrentes?: VisitaConcorrenteInput[];
    brindes?: BrindeEntregaInput[];
  } = {}
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

  const pessoas = (opts.pessoas ?? [])
    .filter((p) => p.pessoa_id || (p.pessoa_nome && p.pessoa_nome.trim()))
    .map((p) => ({
      visita_id: visitaId,
      pessoa_id: p.pessoa_id || null,
      pessoa_nome: p.pessoa_nome || null,
      cargo: p.cargo || null,
    }));
  if (pessoas.length) {
    const { error: ep } = await supabase.from("visita_pessoas").insert(pessoas);
    if (ep) throw ep;
  }

  const linhas = (opts.concorrentes ?? [])
    .filter(
      (c) =>
        c.emissor_id ||
        c.concorrente_nome ||
        c.produto ||
        c.preco != null ||
        c.volume != null
    )
    .map((c) => ({
      visita_id: visitaId,
      emissor_id: c.emissor_id || null,
      concorrente_nome: c.concorrente_nome || null,
      produto: c.produto || null,
      volume: c.volume ?? null,
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

  const movs = (opts.brindes ?? [])
    .filter((b) => b.brinde_id && b.quantidade > 0)
    .map((b) => ({
      brinde_id: b.brinde_id,
      tipo: "saida",
      quantidade: b.quantidade,
      visita_id: visitaId,
      cliente_id: b.cliente_id ?? v.cliente_id ?? null,
      pessoa_id: b.pessoa_id ?? null,
    }));
  if (movs.length) {
    const { error: e3 } = await supabase
      .from("brinde_movimentos")
      .insert(movs);
    if (e3) throw e3;
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
