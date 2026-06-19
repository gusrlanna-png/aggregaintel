import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { findEmpresaIdByCnpj } from "./empresas";
import type {
  CfemAnm,
  Emissor,
  NFProjecao,
  NFSerie,
  NotaFiscal,
} from "./types";
import {
  localGet,
  localList,
  localUpsert,
  newId,
  nowIso,
} from "@/lib/local/store";
import { buscarTudo } from "./paginate";

export interface EmissorFilters {
  municipio?: string;
  produto?: string;
  status_legal?: string;
  busca?: string;
}

function matchFilters(e: Emissor, filters: EmissorFilters): boolean {
  if (filters.municipio && e.municipio !== filters.municipio) return false;
  if (filters.status_legal && e.status_legal !== filters.status_legal)
    return false;
  if (filters.produto && !(e.produtos?.[filters.produto] ?? false))
    return false;
  if (
    filters.busca &&
    !e.razao_social.toLowerCase().includes(filters.busca.toLowerCase())
  )
    return false;
  return true;
}

export async function getEmissores(
  filters: EmissorFilters = {}
): Promise<Emissor[]> {
  if (!isSupabaseConfigured()) {
    return localList<Emissor>("emissores")
      .filter((e) => matchFilters(e, filters))
      .sort((a, b) => a.razao_social.localeCompare(b.razao_social));
  }

  const supabase = createClient();
  return buscarTudo<Emissor>((from, to) => {
    let query = supabase
      .from("emissores")
      .select("*")
      .order("razao_social")
      .range(from, to);
    if (filters.municipio) query = query.eq("municipio", filters.municipio);
    if (filters.status_legal)
      query = query.eq("status_legal", filters.status_legal);
    if (filters.busca) query = query.ilike("razao_social", `%${filters.busca}%`);
    return query;
  });
}

export interface ProdutorMercado {
  id: string;
  razao_social: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  grupo_economico: string | null;
  eh_mbv: boolean | null;
  lat: number | null;
  lng: number | null;
  substancias: string | null;
  cfem_12m: number;
  cfem_total: number;
  ultimo_mes: string | null;
  ativo: boolean;
  tambem_cliente: boolean;
}

/** Produtores enriquecidos com CFEM (substância, valor 12m, status ativo). */
export async function getProdutoresMercado(): Promise<ProdutorMercado[]> {
  if (!isSupabaseConfigured()) {
    return localList<Emissor>("emissores").map((e) => ({
      id: e.id,
      razao_social: e.razao_social,
      cnpj: e.cnpj,
      municipio: e.municipio,
      uf: e.uf,
      grupo_economico: e.grupo_economico,
      eh_mbv: e.eh_mbv ?? false,
      lat: e.lat,
      lng: e.lng,
      substancias: null,
      cfem_12m: 0,
      cfem_total: 0,
      ultimo_mes: null,
      ativo: true,
      tambem_cliente: false,
    }));
  }
  const supabase = createClient();
  return buscarTudo<ProdutorMercado>((from, to) =>
    supabase
      .from("vw_produtores_mercado")
      .select("*")
      .order("razao_social")
      .order("cnpj", { nullsFirst: false })
      .range(from, to)
  );
}

/** Renomeia um produtor (razão social). */
export async function renomearEmissor(id: string, nome: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("emissores")
    .update({ razao_social: nome })
    .eq("id", id);
  if (error) throw error;
}

/** Define (ou limpa) o grupo econômico de um ou vários produtores. */
export async function definirGrupoEmissores(
  ids: string[],
  grupo: string | null
): Promise<void> {
  if (!isSupabaseConfigured() || ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("emissores")
    .update({ grupo_economico: grupo && grupo.trim() ? grupo.trim() : null })
    .in("id", ids);
  if (error) throw error;
}

/** Atualiza campos cadastrais (ex.: vindos da Receita Federal/BrasilAPI). */
export async function atualizarCadastralEmissor(
  id: string,
  dados: Partial<{
    razao_social: string;
    cnpj: string;
    logradouro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
    fone: string | null;
    data_fundacao: string | null;
    situacao_cadastral: string | null;
    atividade_principal: string | null;
    capital_social: number | null;
    natureza_juridica: string | null;
    matriz_filial: string | null;
  }>,
  client?: ReturnType<typeof createClient>
): Promise<void> {
  if (!client && !isSupabaseConfigured()) return;
  const supabase = client ?? createClient();
  const { error } = await supabase.from("emissores").update(dados).eq("id", id);
  if (error) throw error;
}

export interface Socio {
  id: string;
  nome: string;
  qualificacao: string | null;
  faixa_etaria: string | null;
  desde: string | null;
  pessoa_id: string | null;
}

export async function getSocios(emissorId: string): Promise<Socio[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id, nome, qualificacao, faixa_etaria, desde, pessoa_id")
    .eq("emissor_id", emissorId)
    .order("nome");
  if (error) throw error;
  return (data as Socio[]) ?? [];
}

/** Substitui o quadro societário do emissor (e garante o cadastro de Pessoa). */
export async function salvarSocios(
  emissorId: string,
  socios: { nome: string | null; qualificacao?: string | null; faixa_etaria?: string | null; desde?: string | null }[],
  client?: ReturnType<typeof createClient>
): Promise<void> {
  if (!client && !isSupabaseConfigured()) return;
  const supabase = client ?? createClient();
  const limpos = socios
    .filter((s): s is typeof s & { nome: string } => Boolean(s.nome && s.nome.trim()))
    .map((s) => ({
      nome: s.nome.trim(),
      qualificacao: s.qualificacao ?? null,
      faixa_etaria: s.faixa_etaria ?? null,
      desde: s.desde || null,
    }));
  const { error } = await supabase.rpc("sincronizar_socios", {
    p_emissor: emissorId,
    p_socios: limpos,
  });
  if (error) throw error;
}

/** Outras unidades (filiais/matriz) com a mesma raiz de CNPJ (8 dígitos). */
export async function getUnidadesPorRaiz(
  cnpj?: string | null,
  excluirId?: string
): Promise<ProdutorMercado[]> {
  const raiz = (cnpj ?? "").replace(/\D/g, "").slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vw_produtores_mercado")
    .select("*")
    .like("cnpj", `%${raiz.slice(0, 2)}.${raiz.slice(2, 5)}.${raiz.slice(5, 8)}%`);
  if (error) throw error;
  return ((data as ProdutorMercado[]) ?? []).filter((e) => e.id !== excluirId);
}

/** Renomeia um grupo econômico (afeta todos os produtores do grupo). */
export async function renomearGrupo(
  antigo: string,
  novo: string
): Promise<void> {
  if (!isSupabaseConfigured() || !novo.trim() || antigo === novo.trim()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("emissores")
    .update({ grupo_economico: novo.trim() })
    .eq("grupo_economico", antigo);
  if (error) throw error;
}

export async function getEmissorByCNPJ(cnpj: string): Promise<Emissor | null> {
  if (!isSupabaseConfigured()) {
    return (
      localList<Emissor>("emissores").find((e) => e.cnpj === cnpj) ?? null
    );
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("emissores")
    .select("*")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (error) throw error;
  return data as Emissor | null;
}

export async function getEmissorById(id: string): Promise<Emissor | null> {
  if (!isSupabaseConfigured()) {
    return localGet<Emissor>("emissores", id);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("emissores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Emissor | null;
}

export interface EmissorComNFs {
  emissor: Emissor;
  nfs: NotaFiscal[];
  series: NFSerie[];
  projecoes: NFProjecao[];
  cfem: CfemAnm[];
  grupo: Emissor[]; // outras empresas do mesmo grupo econômico
}

export async function getEmissorComNFs(
  id: string
): Promise<EmissorComNFs | null> {
  if (!isSupabaseConfigured()) {
    const emissor = localGet<Emissor>("emissores", id);
    if (!emissor) return null;
    const nfs = localList<NotaFiscal>("notas_fiscais").filter(
      (n) => n.emissor_id === id
    );
    const projecoes = localList<NFProjecao>("nf_projecao").filter(
      (p) => p.emissor_id === id
    );
    const cfem = localList<CfemAnm>("cfem_anm").filter(
      (c) => c.emissor_id === id
    );
    const grupo = emissor.grupo_economico
      ? localList<Emissor>("emissores").filter(
          (e) => e.id !== id && e.grupo_economico === emissor.grupo_economico
        )
      : [];
    return { emissor, nfs, series: buildSeriesFromNfs(id, nfs), projecoes, cfem, grupo };
  }

  const supabase = createClient();
  const [
    { data: emissor },
    { data: nfs },
    { data: series },
    { data: projecoes },
    { data: cfem },
  ] = await Promise.all([
    supabase.from("emissores").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("notas_fiscais")
      .select("*")
      .eq("emissor_id", id)
      .order("numero_nf"),
    supabase.from("nf_series").select("*").eq("emissor_id", id),
    supabase
      .from("nf_projecao")
      .select("*")
      .eq("emissor_id", id)
      .order("criado_em", { ascending: false }),
    supabase.from("cfem_anm").select("*").eq("emissor_id", id),
  ]);
  if (!emissor) return null;
  const em = emissor as Emissor;
  let grupo: Emissor[] = [];
  if (em.grupo_economico) {
    const { data: g } = await supabase
      .from("emissores")
      .select("*")
      .eq("grupo_economico", em.grupo_economico)
      .neq("id", id);
    grupo = (g ?? []) as Emissor[];
  }
  return {
    emissor: em,
    nfs: (nfs ?? []) as NotaFiscal[],
    series: (series ?? []) as NFSerie[],
    projecoes: (projecoes ?? []) as NFProjecao[],
    cfem: (cfem ?? []) as CfemAnm[],
    grupo,
  };
}

function buildSeriesFromNfs(emissorId: string, nfs: NotaFiscal[]): NFSerie[] {
  const map = new Map<string, NFSerie>();
  for (const nf of nfs) {
    const key = nf.serie ?? "";
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        id: `${emissorId}-${key}`,
        emissor_id: emissorId,
        serie: nf.serie,
        nf_min: nf.numero_nf,
        nf_max: nf.numero_nf,
        count_obs: 1,
        ultima_data: nf.data_emissao,
      });
    } else {
      cur.nf_min = Math.min(cur.nf_min ?? nf.numero_nf, nf.numero_nf);
      cur.nf_max = Math.max(cur.nf_max ?? nf.numero_nf, nf.numero_nf);
      cur.count_obs += 1;
      if (!cur.ultima_data || nf.data_emissao > cur.ultima_data)
        cur.ultima_data = nf.data_emissao;
    }
  }
  return Array.from(map.values());
}

export async function upsertEmissor(
  data: Partial<Emissor> & { razao_social: string }
): Promise<Emissor> {
  if (!isSupabaseConfigured()) {
    const row: Emissor = {
      id: data.id ?? newId(),
      razao_social: data.razao_social,
      cnpj: data.cnpj ?? null,
      inscricao_est: data.inscricao_est ?? null,
      logradouro: data.logradouro ?? null,
      municipio: data.municipio ?? null,
      uf: data.uf ?? "MG",
      cep: data.cep ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      fone: data.fone ?? null,
      tipo: data.tipo ?? "concorrente",
      produtos: data.produtos ?? null,
      capacidade_ton_mes: data.capacidade_ton_mes ?? null,
      status_legal: data.status_legal ?? "ativo",
      grupo_economico: data.grupo_economico ?? null,
      eh_mbv: data.eh_mbv ?? false,
      notas: data.notas ?? null,
      criado_em: data.criado_em ?? nowIso(),
      atualizado_em: nowIso(),
    };
    return localUpsert<Emissor>("emissores", row);
  }
  const supabase = createClient();
  // Cadastro único: produtores vivem na tabela `empresas` com eh_produtor=true.
  const payload: Record<string, unknown> = {
    ...data,
    eh_produtor: true,
    atualizado_em: new Date().toISOString(),
  };
  // Registro existente: atualiza por id.
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data: row, error } = await supabase
      .from("empresas")
      .update(rest)
      .eq("id", id as string)
      .select()
      .single();
    if (error) throw error;
    return row as Emissor;
  }
  // Find-or-create: se o CNPJ já existe (ex.: cadastrado como cliente), atualiza
  // esse cadastro marcando eh_produtor (evita duplicar CNPJ / violar o índice único).
  const existenteId = await findEmpresaIdByCnpj(data.cnpj);
  if (existenteId) {
    const { id, ...rest } = payload;
    void id;
    const { data: row, error } = await supabase
      .from("empresas")
      .update(rest)
      .eq("id", existenteId)
      .select()
      .single();
    if (error) throw error;
    return row as Emissor;
  }
  const { data: row, error } = await supabase
    .from("empresas")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return row as Emissor;
}

/**
 * Localiza um emissor por CNPJ (dígitos) ou razão social e cria/atualiza
 * a partir dos dados de uma NF. Retorna o id. Usado ao salvar NFs para
 * popular automaticamente o módulo Mercado.
 */
export async function findOrCreateEmissor(d: {
  razao_social?: string;
  cnpj?: string;
  logradouro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  fone?: string;
}): Promise<string | null> {
  const nome = (d.razao_social ?? "").trim();
  const cnpjDigits = (d.cnpj ?? "").replace(/\D/g, "");
  if (!nome && !cnpjDigits) return null;

  const all = await getEmissores();
  let found =
    cnpjDigits.length >= 11
      ? all.find((e) => (e.cnpj ?? "").replace(/\D/g, "") === cnpjDigits)
      : undefined;
  if (!found && nome)
    found = all.find(
      (e) => e.razao_social.trim().toLowerCase() === nome.toLowerCase()
    );

  const saved = await upsertEmissor({
    id: found?.id,
    razao_social: nome || found?.razao_social || "Emissor sem nome",
    cnpj: d.cnpj || found?.cnpj || undefined,
    logradouro: d.logradouro || found?.logradouro || null,
    municipio: d.municipio || found?.municipio || null,
    uf: d.uf || found?.uf || null,
    cep: d.cep || found?.cep || null,
    fone: d.fone || found?.fone || null,
    tipo: found?.tipo || "concorrente",
    status_legal: found?.status_legal || "ativo",
    eh_mbv: found?.eh_mbv ?? false,
  });
  return saved.id;
}

/** Lista os grupos econômicos existentes (distintos) entre os emissores. */
export async function getGruposEconomicos(): Promise<string[]> {
  const emissores = await getEmissores();
  const set = new Set<string>();
  for (const e of emissores) if (e.grupo_economico) set.add(e.grupo_economico);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function getProjecaoResumo(): Promise<
  { emissor: Emissor; volume: number; ic: number }[]
> {
  const emissores = await getEmissores();
  if (!isSupabaseConfigured()) {
    const projecoes = localList<NFProjecao>("nf_projecao");
    return emissores
      .map((e) => {
        const p = projecoes.find((x) => x.emissor_id === e.id);
        return {
          emissor: e,
          volume: p?.volume_est_med ?? 0,
          ic: p?.ic_pct ?? 0,
        };
      })
      .sort((a, b) => b.volume - a.volume);
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("nf_projecao")
    .select("emissor_id, volume_est_med, ic_pct")
    .order("volume_est_med", { ascending: false });
  const byEmissor = new Map<string, { volume: number; ic: number }>();
  for (const row of data ?? []) {
    if (!row.emissor_id) continue;
    if (!byEmissor.has(row.emissor_id))
      byEmissor.set(row.emissor_id, {
        volume: row.volume_est_med ?? 0,
        ic: row.ic_pct ?? 0,
      });
  }
  return emissores
    .map((e) => ({
      emissor: e,
      volume: byEmissor.get(e.id)?.volume ?? 0,
      ic: byEmissor.get(e.id)?.ic ?? 0,
    }))
    .sort((a, b) => b.volume - a.volume);
}

export interface RankingProducao {
  emissor: Emissor;
  volume: number;
}

/**
 * Ranking de produtores por produção. mes=null → anual (projeção total);
 * mes=1..12 → produção daquele mês (a partir dos volumes mensais salvos).
 * Retorna os top `limite`.
 */
export async function getRankingProducao(
  ano: number,
  mes: number | null,
  limite = 20
): Promise<RankingProducao[]> {
  if (!isSupabaseConfigured()) return [];
  if (!mes) {
    const r = await getProjecaoResumo();
    return r.filter((x) => x.volume > 0).map((x) => ({ emissor: x.emissor, volume: x.volume })).slice(0, limite);
  }
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("projecao_mensal")
    .select("emissor_id, volumes")
    .eq("ano", ano);
  const byEmissor = new Map<string, number>();
  for (const row of rows ?? []) {
    const vol = (row.volumes as Record<string, number> | null)?.[String(mes)] ?? 0;
    if (vol) byEmissor.set(row.emissor_id, (byEmissor.get(row.emissor_id) ?? 0) + Number(vol));
  }
  const ids = Array.from(byEmissor.keys());
  if (ids.length === 0) return [];
  const { data: ems } = await supabase.from("emissores").select("*").in("id", ids);
  return ((ems ?? []) as Emissor[])
    .map((e) => ({ emissor: e, volume: byEmissor.get(e.id) ?? 0 }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limite);
}
