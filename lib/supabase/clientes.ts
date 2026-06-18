import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { Cliente } from "./types";
import {
  localGet,
  localList,
  localUpdate,
  localUpsert,
  newId,
  nowIso,
} from "@/lib/local/store";

export interface ClienteFilters {
  segmento?: string;
  busca?: string;
}

export async function getClientes(
  filters: ClienteFilters = {}
): Promise<Cliente[]> {
  if (!isSupabaseConfigured()) {
    return localList<Cliente>("clientes")
      .filter((c) => {
        if (filters.segmento && c.segmento !== filters.segmento) return false;
        if (
          filters.busca &&
          !c.razao_social.toLowerCase().includes(filters.busca.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => a.razao_social.localeCompare(b.razao_social));
  }
  const supabase = createClient();
  const PAGINA = 1000; // limite do PostgREST por requisição
  const todos: Cliente[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    let query = supabase
      .from("clientes")
      .select("*")
      .order("razao_social")
      .order("cnpj", { nullsFirst: false })
      .range(inicio, inicio + PAGINA - 1);
    if (filters.segmento) query = query.eq("segmento", filters.segmento);
    if (filters.busca) query = query.ilike("razao_social", `%${filters.busca}%`);
    const { data, error } = await query;
    if (error) throw error;
    const lote = (data ?? []) as Cliente[];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}

/** Atualiza campos cadastrais (ex.: vindos da Receita Federal/BrasilAPI). */
export async function atualizarCadastralCliente(
  id: string,
  dados: Partial<{
    razao_social: string;
    cnpj: string;
    logradouro: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
    fone: string | null;
  }>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase.from("clientes").update(dados).eq("id", id);
  if (error) throw error;
}

export interface ClienteDup {
  id: string;
  razao_social: string;
  fantasia: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  status: string | null;
  atualizado_em: string | null;
}

export interface GrupoDuplicado {
  cnpj_digitos: string;
  membros: ClienteDup[];
}

/** Agrupa clientes que compartilham o mesmo CNPJ (candidatos a mesclagem). */
export async function getClientesDuplicados(): Promise<GrupoDuplicado[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social, fantasia, cnpj, municipio, uf, status, atualizado_em")
    .not("cnpj", "is", null)
    .limit(5000);
  if (error) throw error;
  const grupos = new Map<string, ClienteDup[]>();
  for (const c of (data as ClienteDup[]) ?? []) {
    const dig = (c.cnpj ?? "").replace(/\D/g, "");
    if (dig.length < 8) continue;
    if (!grupos.has(dig)) grupos.set(dig, []);
    grupos.get(dig)!.push(c);
  }
  return [...grupos.entries()]
    .filter(([, m]) => m.length > 1)
    .map(([cnpj_digitos, membros]) => ({
      cnpj_digitos,
      membros: membros.sort((a, b) =>
        (b.atualizado_em ?? "").localeCompare(a.atualizado_em ?? "")
      ),
    }))
    .sort((a, b) => b.membros.length - a.membros.length);
}

/** Mescla os duplicados no cliente mestre (RPC mesclar_clientes). */
export async function mesclarClientes(masterId: string, dupIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase.rpc("mesclar_clientes", {
    p_master: masterId,
    p_dups: dupIds,
  });
  if (error) throw error;
}

export interface SocioCliente {
  id: string;
  nome: string;
  qualificacao: string | null;
  faixa_etaria: string | null;
  desde: string | null;
  pessoa_id: string | null;
}

/** Quadro societário do cliente (mesma tabela `socios`, via cliente_id). */
export async function getSociosCliente(clienteId: string): Promise<SocioCliente[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id, nome, qualificacao, faixa_etaria, desde, pessoa_id")
    .eq("cliente_id", clienteId)
    .order("nome");
  if (error) throw error;
  return (data as SocioCliente[]) ?? [];
}

/** Substitui o quadro societário do cliente (RPC sincronizar_socios_cliente). */
export async function salvarSociosCliente(
  clienteId: string,
  socios: { nome: string | null; qualificacao?: string | null; faixa_etaria?: string | null; desde?: string | null }[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const limpos = socios
    .filter((s): s is typeof s & { nome: string } => Boolean(s.nome && s.nome.trim()))
    .map((s) => ({
      nome: s.nome.trim(),
      qualificacao: s.qualificacao ?? null,
      faixa_etaria: s.faixa_etaria ?? null,
      desde: s.desde || null,
    }));
  const { error } = await supabase.rpc("sincronizar_socios_cliente", {
    p_cliente: clienteId,
    p_socios: limpos,
  });
  if (error) throw error;
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  if (!isSupabaseConfigured()) {
    return localGet<Cliente>("clientes", id);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Cliente | null;
}

/**
 * Localiza um cliente por CNPJ/CPF (dígitos) ou razão social e cria/atualiza
 * a partir dos dados do destinatário de uma NF. Retorna o id. Segmento padrão
 * "outro" (ajustável depois na ficha do cliente).
 */
export async function findOrCreateCliente(d: {
  razao_social?: string;
  doc?: string; // cnpj ou cpf
  logradouro?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}): Promise<string | null> {
  const nome = (d.razao_social ?? "").trim();
  const docDigits = (d.doc ?? "").replace(/\D/g, "");
  if (!nome && !docDigits) return null;

  const all = await getClientes();
  let found =
    docDigits.length >= 11
      ? all.find(
          (c) =>
            (c.cnpj ?? "").replace(/\D/g, "") === docDigits ||
            (c.cpf ?? "").replace(/\D/g, "") === docDigits
        )
      : undefined;
  if (!found && nome)
    found = all.find(
      (c) => c.razao_social.trim().toLowerCase() === nome.toLowerCase()
    );

  const isCpf = docDigits.length === 11;
  const saved = await upsertCliente({
    id: found?.id,
    razao_social: nome || found?.razao_social || "Cliente sem nome",
    cnpj: isCpf ? found?.cnpj ?? null : d.doc || found?.cnpj || null,
    cpf: isCpf ? d.doc || found?.cpf || null : found?.cpf ?? null,
    segmento: found?.segmento || "outro",
    logradouro: d.logradouro || found?.logradouro || null,
    bairro: d.bairro || found?.bairro || null,
    municipio: d.municipio || found?.municipio || null,
    uf: d.uf || found?.uf || null,
    cep: d.cep || found?.cep || null,
    status: found?.status || "ativo",
  });
  // Vincula ao grupo econômico por raiz de CNPJ, se houver.
  if (saved.cnpj) {
    try {
      await vincularGrupoPorCnpj(saved.id);
    } catch {
      /* não bloqueia o salvamento da NF */
    }
  }
  return saved.id;
}

export async function upsertCliente(
  data: Partial<Cliente> & { razao_social: string; segmento: string }
): Promise<Cliente> {
  if (!isSupabaseConfigured()) {
    const ex = data.id ? localGet<Cliente>("clientes", data.id) : null;
    // mantém o valor existente quando o campo não é enviado (undefined)
    const keep = <K extends keyof Cliente>(k: K, def: Cliente[K]): Cliente[K] =>
      (data[k] !== undefined ? data[k] : ex?.[k] ?? def) as Cliente[K];
    const row: Cliente = {
      id: data.id ?? newId(),
      razao_social: data.razao_social,
      cnpj: keep("cnpj", null),
      cpf: keep("cpf", null),
      segmento: data.segmento,
      logradouro: keep("logradouro", null),
      bairro: keep("bairro", null),
      municipio: keep("municipio", null),
      uf: keep("uf", "MG"),
      cep: keep("cep", null),
      lat: keep("lat", null),
      lng: keep("lng", null),
      fone: keep("fone", null),
      contato_nome: keep("contato_nome", null),
      contatos: keep("contatos", []),
      grupo_economico: keep("grupo_economico", null),
      status: keep("status", "ativo"),
      notas: keep("notas", null),
      criado_em: ex?.criado_em ?? data.criado_em ?? nowIso(),
      atualizado_em: nowIso(),
    };
    return localUpsert<Cliente>("clientes", row);
  }
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("clientes")
    .upsert({ ...data, atualizado_em: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return row as Cliente;
}

/** Raiz do CNPJ (8 primeiros dígitos) — identifica a empresa-mãe e filiais. */
export function cnpjRaiz(cnpj?: string | null): string {
  const d = (cnpj ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(0, 8) : "";
}

function nomeBaseGrupo(razao: string): string {
  return (
    razao
      .replace(
        /\s+(LTDA|S\/A|S\.?A\.?|EIRELI|EPP|ME|MEI)\b.*$/i,
        ""
      )
      .trim() || razao.trim()
  );
}

export async function getGruposEconomicosClientes(): Promise<string[]> {
  const clientes = await getClientes();
  const set = new Set<string>();
  for (const c of clientes) if (c.grupo_economico) set.add(c.grupo_economico);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function getClientesDoGrupo(
  grupo: string,
  excludeId?: string
): Promise<Cliente[]> {
  const clientes = await getClientes();
  return clientes.filter(
    (c) => c.grupo_economico === grupo && c.id !== excludeId
  );
}

async function updateClienteCampos(
  id: string,
  patch: Partial<Cliente>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    localUpdate<Cliente>("clientes", id, patch);
    return;
  }
  const supabase = createClient();
  await supabase.from("clientes").update(patch).eq("id", id);
}

/**
 * Vincula automaticamente clientes com a MESMA raiz de CNPJ (8 primeiros
 * dígitos) ao mesmo grupo econômico. Retorna o grupo aplicado.
 */
export async function vincularGrupoPorCnpj(
  clienteId: string
): Promise<string | null> {
  const all = await getClientes();
  const cli = all.find((c) => c.id === clienteId);
  if (!cli) return null;
  const raiz = cnpjRaiz(cli.cnpj);
  if (!raiz) return cli.grupo_economico ?? null;

  const irmaos = all.filter((c) => cnpjRaiz(c.cnpj) === raiz);
  let grupo =
    cli.grupo_economico ||
    irmaos.map((c) => c.grupo_economico).find(Boolean) ||
    null;
  if (!grupo) grupo = nomeBaseGrupo(cli.razao_social);

  for (const c of irmaos) {
    if (c.grupo_economico !== grupo) {
      await updateClienteCampos(c.id, { grupo_economico: grupo });
    }
  }
  return grupo;
}
