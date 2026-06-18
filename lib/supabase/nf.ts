import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { Emissor, Cliente, NotaFiscal } from "./types";
import {
  localGet,
  localInsert,
  localList,
  localUpdate,
  newId,
  nowIso,
} from "@/lib/local/store";

export interface NFFilters {
  emissor_id?: string;
  produto_tipo?: string;
  data_inicio?: string;
  data_fim?: string;
  revisado?: boolean;
  excluirDesconsideradas?: boolean;
  page?: number;
  pageSize?: number;
}

/** Erro de NF duplicada (mesma chave de acesso ou mesmo número/série/emissor). */
export class DuplicateNFError extends Error {
  constructor(public existing: NotaFiscal) {
    super("NF duplicada");
    this.name = "DuplicateNFError";
  }
}

function hydrate(nf: NotaFiscal): NotaFiscal {
  if (nf.emissor && nf.cliente) return nf;
  const emissor = nf.emissor_id
    ? localGet<Emissor>("emissores", nf.emissor_id)
    : null;
  const cliente = nf.cliente_id
    ? localGet<Cliente>("clientes", nf.cliente_id)
    : null;
  return {
    ...nf,
    emissor: emissor
      ? { id: emissor.id, razao_social: emissor.razao_social, municipio: emissor.municipio }
      : nf.emissor ?? null,
    cliente: cliente
      ? { id: cliente.id, razao_social: cliente.razao_social, segmento: cliente.segmento }
      : nf.cliente ?? null,
  };
}

export async function getNFs(filters: NFFilters = {}): Promise<{
  data: NotaFiscal[];
  count: number;
}> {
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page ?? 0;

  if (!isSupabaseConfigured()) {
    let rows = localList<NotaFiscal>("notas_fiscais").map(hydrate);
    if (filters.emissor_id)
      rows = rows.filter((n) => n.emissor_id === filters.emissor_id);
    if (filters.produto_tipo)
      rows = rows.filter((n) => n.produto_tipo === filters.produto_tipo);
    if (filters.data_inicio)
      rows = rows.filter((n) => n.data_emissao >= filters.data_inicio!);
    if (filters.data_fim)
      rows = rows.filter((n) => n.data_emissao <= filters.data_fim!);
    if (filters.revisado !== undefined)
      rows = rows.filter((n) => Boolean(n.revisado) === filters.revisado);
    if (filters.excluirDesconsideradas)
      rows = rows.filter((n) => !n.desconsiderada);
    rows.sort((a, b) => (a.data_emissao < b.data_emissao ? 1 : -1));
    return { data: rows, count: rows.length };
  }

  const supabase = createClient();
  let query = supabase
    .from("notas_fiscais")
    .select(
      "*, emissor:emissores(id, razao_social, municipio), cliente:clientes(id, razao_social, segmento)",
      { count: "exact" }
    )
    .order("data_emissao", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.emissor_id) query = query.eq("emissor_id", filters.emissor_id);
  if (filters.produto_tipo)
    query = query.eq("produto_tipo", filters.produto_tipo);
  if (filters.data_inicio) query = query.gte("data_emissao", filters.data_inicio);
  if (filters.data_fim) query = query.lte("data_emissao", filters.data_fim);
  if (filters.revisado !== undefined)
    query = query.eq("revisado", filters.revisado);
  if (filters.excluirDesconsideradas)
    query = query.not("desconsiderada", "eq", true);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as NotaFiscal[], count: count ?? 0 };
}

/**
 * NFs em que o cliente é o destinatário — histórico/volume CONFIRMADO (real).
 * Exclui NFs desconsideradas. Serve de fonte verdadeira para o planejamento.
 */
export async function getNFsCliente(clienteId: string): Promise<NotaFiscal[]> {
  if (!clienteId) return [];
  if (!isSupabaseConfigured()) {
    return localList<NotaFiscal>("notas_fiscais")
      .filter((n) => n.cliente_id === clienteId && !n.desconsiderada)
      .map(hydrate)
      .sort((a, b) => (a.data_emissao < b.data_emissao ? 1 : -1));
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select(
      "*, emissor:emissores(id, razao_social, municipio), cliente:clientes(id, razao_social, segmento)"
    )
    .eq("cliente_id", clienteId)
    .not("desconsiderada", "eq", true)
    .order("data_emissao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotaFiscal[];
}

export async function getNFById(id: string): Promise<NotaFiscal | null> {
  if (!isSupabaseConfigured()) {
    const nf = localGet<NotaFiscal>("notas_fiscais", id);
    return nf ? hydrate(nf) : null;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select(
      "*, emissor:emissores(id, razao_social, municipio), cliente:clientes(id, razao_social, segmento)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as NotaFiscal | null;
}

/**
 * Localiza uma NF duplicada: mesma chave de acesso OU mesmo
 * número + série + emissor. Ignora o registro com id === excludeId (edição).
 */
export async function findDuplicateNF(
  payload: Pick<
    NotaFiscal,
    "numero_nf" | "serie" | "emissor_id" | "chave_acesso"
  >,
  excludeId?: string
): Promise<NotaFiscal | null> {
  const chave = payload.chave_acesso?.trim() || null;

  if (!isSupabaseConfigured()) {
    const rows = localList<NotaFiscal>("notas_fiscais").filter(
      (n) => n.id !== excludeId
    );
    if (chave) return rows.find((n) => n.chave_acesso === chave) ?? null;
    return (
      rows.find(
        (n) =>
          n.numero_nf === payload.numero_nf &&
          (n.serie ?? null) === (payload.serie ?? null) &&
          (n.emissor_id ?? null) === (payload.emissor_id ?? null)
      ) ?? null
    );
  }

  const supabase = createClient();
  if (chave) {
    let cq = supabase
      .from("notas_fiscais")
      .select("*")
      .eq("chave_acesso", chave);
    if (excludeId) cq = cq.neq("id", excludeId);
    const { data } = await cq.maybeSingle();
    return (data as NotaFiscal) ?? null;
  }
  let q = supabase
    .from("notas_fiscais")
    .select("*")
    .eq("numero_nf", payload.numero_nf);
  q = payload.serie ? q.eq("serie", payload.serie) : q.is("serie", null);
  q = payload.emissor_id
    ? q.eq("emissor_id", payload.emissor_id)
    : q.is("emissor_id", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.maybeSingle();
  return (data as NotaFiscal) ?? null;
}

/**
 * Salva a NF. Rejeita duplicidade (DuplicateNFError) pelo número da NF.
 */
export async function saveNF(
  payload: Partial<NotaFiscal> & {
    numero_nf: number;
    quantidade_ton: number;
    data_emissao: string;
  }
): Promise<NotaFiscal> {
  const dup = await findDuplicateNF({
    numero_nf: payload.numero_nf,
    serie: payload.serie ?? null,
    emissor_id: payload.emissor_id ?? null,
    chave_acesso: payload.chave_acesso ?? null,
  });
  if (dup) throw new DuplicateNFError(hydrate(dup));

  if (!isSupabaseConfigured()) {
    const row = { id: newId(), criado_em: nowIso(), ...payload } as NotaFiscal;
    return hydrate(localInsert<NotaFiscal>("notas_fiscais", row));
  }

  const supabase = createClient();
  const { data: nf, error } = await supabase
    .from("notas_fiscais")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (payload.emissor_id) {
    await upsertSerie(
      payload.emissor_id,
      payload.serie ?? null,
      payload.numero_nf,
      payload.data_emissao
    );
  }
  return nf as NotaFiscal;
}

/** Atualiza uma NF existente (edição). Mantém a verificação de duplicidade. */
export async function updateNF(
  id: string,
  payload: Partial<NotaFiscal>
): Promise<NotaFiscal> {
  if (payload.numero_nf != null) {
    const dup = await findDuplicateNF(
      {
        numero_nf: payload.numero_nf,
        serie: payload.serie ?? null,
        emissor_id: payload.emissor_id ?? null,
        chave_acesso: payload.chave_acesso ?? null,
      },
      id
    );
    if (dup) throw new DuplicateNFError(hydrate(dup));
  }

  if (!isSupabaseConfigured()) {
    const updated = localUpdate<NotaFiscal>("notas_fiscais", id, payload);
    if (!updated) throw new Error("NF não encontrada.");
    return hydrate(updated);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notas_fiscais")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as NotaFiscal;
}

async function upsertSerie(
  emissor_id: string,
  serie: string | null,
  numero_nf: number,
  data_emissao: string
) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("nf_series")
    .select("*")
    .eq("emissor_id", emissor_id)
    .eq("serie", serie ?? "")
    .maybeSingle();

  if (!existing) {
    await supabase.from("nf_series").insert({
      emissor_id,
      serie,
      nf_min: numero_nf,
      nf_max: numero_nf,
      count_obs: 1,
      ultima_data: data_emissao,
    });
  } else {
    await supabase
      .from("nf_series")
      .update({
        nf_min: Math.min(existing.nf_min ?? numero_nf, numero_nf),
        nf_max: Math.max(existing.nf_max ?? numero_nf, numero_nf),
        count_obs: (existing.count_obs ?? 0) + 1,
        ultima_data:
          !existing.ultima_data || data_emissao > existing.ultima_data
            ? data_emissao
            : existing.ultima_data,
      })
      .eq("id", existing.id);
  }
}

/**
 * Busca NFs para a pesquisa global. Por número (dígitos) ou nome do emissor.
 * Retorna no máximo `limite` resultados, mais recentes primeiro.
 */
export async function searchNFs(
  termo: string,
  limite = 8
): Promise<NotaFiscal[]> {
  const q = (termo ?? "").trim();
  const dig = q.replace(/\D/g, "");
  if (!q) return [];

  if (!isSupabaseConfigured()) {
    const rows = localList<NotaFiscal>("notas_fiscais").map(hydrate);
    return rows
      .filter(
        (n) =>
          (dig && String(n.numero_nf).includes(dig)) ||
          (n.emissor?.razao_social ?? "")
            .toLowerCase()
            .includes(q.toLowerCase())
      )
      .slice(0, limite);
  }

  const supabase = createClient();
  const select =
    "*, emissor:emissores(id, razao_social, municipio), cliente:clientes(id, razao_social, segmento)";

  // Por número exato (uso mais comum no balcão).
  if (dig) {
    const { data } = await supabase
      .from("notas_fiscais")
      .select(select)
      .eq("numero_nf", Number(dig))
      .order("data_emissao", { ascending: false })
      .limit(limite);
    return (data ?? []) as NotaFiscal[];
  }

  // Por nome do emissor (texto): resolve emissores e busca NFs deles.
  const { data: ems } = await supabase
    .from("emissores")
    .select("id")
    .ilike("razao_social", `%${q}%`)
    .limit(5);
  const ids = (ems ?? []).map((e) => e.id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("notas_fiscais")
    .select(select)
    .in("emissor_id", ids)
    .order("data_emissao", { ascending: false })
    .limit(limite);
  return (data ?? []) as NotaFiscal[];
}

/** Marca (ou desmarca) uma NF como desconsiderada — excluída de todos os cálculos. */
export async function toggleDesconsiderada(id: string, valor: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    localUpdate<NotaFiscal>("notas_fiscais", id, { desconsiderada: valor });
    return;
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("notas_fiscais")
    .update({ desconsiderada: valor })
    .eq("id", id);
  if (error) throw error;
}

export async function countNFsMesAtual(): Promise<number> {
  const inicio = new Date();
  inicio.setDate(1);
  const inicioStr = inicio.toISOString().slice(0, 10);
  if (!isSupabaseConfigured()) {
    return localList<NotaFiscal>("notas_fiscais").filter(
      (n) => n.data_emissao >= inicioStr
    ).length;
  }
  const supabase = createClient();
  const { count } = await supabase
    .from("notas_fiscais")
    .select("id", { count: "exact", head: true })
    .gte("data_emissao", inicioStr);
  return count ?? 0;
}
