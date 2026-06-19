import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  upsertEmissor,
  salvarSocios,
  atualizarCadastralEmissor,
} from "./emissores";
import { buscarCadastroCnpj, cnpjDigitos, mascararCnpj } from "@/lib/utils/cnpj";

export interface PessoaLista {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  fone: string | null;
  municipio: string | null;
  uf: string | null;
  n_empresas: number;
}
export interface Pessoa {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  fone: string | null;
  logradouro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  notas: string | null;
  aniversario: string | null;
}

export interface PessoaTelefone {
  id: string;
  pessoa_id: string;
  tipo: "celular" | "fixo" | "whatsapp" | "comercial";
  numero: string;
  pais_codigo: string | null;
  rotulo: string | null;
  principal: boolean | null;
  criado_em: string;
}

export interface PessoaEmail {
  id: string;
  pessoa_id: string;
  email: string;
  rotulo: string | null;
  principal: boolean | null;
  criado_em: string;
}

export interface ContatoCliente {
  id: string;
  cliente_id: string;
  pessoa_id: string;
  cargo: string | null;
  departamento: string | null;
  principal: boolean | null;
  criado_em: string;
  pessoa: { id: string; nome: string; fone: string | null; email: string | null } | null;
}
export interface EmpresaDaPessoa {
  emissor_id: string;
  razao_social: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  cargo: string | null;
  grupo_economico: string | null;
}

export async function getPessoas(): Promise<PessoaLista[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("vw_pessoas")
    .select("*")
    .order("n_empresas", { ascending: false })
    .order("nome");
  if (error) throw error;
  return ((data as PessoaLista[]) ?? []).map((p) => ({
    ...p,
    n_empresas: Number(p.n_empresas) || 0,
  }));
}

export async function getPessoaById(id: string): Promise<Pessoa | null> {
  if (!isSupabaseConfigured()) return null;
  const s = createClient();
  const { data, error } = await s.from("pessoas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Pessoa) ?? null;
}

export async function getEmpresasDaPessoa(pessoaId: string): Promise<EmpresaDaPessoa[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("socios")
    .select("qualificacao, emissores:empresas!socios_emissor_id_fkey(id, razao_social, cnpj, municipio, uf, grupo_economico)")
    .eq("pessoa_id", pessoaId);
  if (error) throw error;
  type Row = {
    qualificacao: string | null;
    emissores: {
      id: string;
      razao_social: string;
      cnpj: string | null;
      municipio: string | null;
      uf: string | null;
      grupo_economico: string | null;
    } | null;
  };
  return ((data as unknown as Row[]) ?? [])
    .filter((r) => r.emissores)
    .map((r) => ({
      emissor_id: r.emissores!.id,
      razao_social: r.emissores!.razao_social,
      cnpj: r.emissores!.cnpj,
      municipio: r.emissores!.municipio,
      uf: r.emissores!.uf,
      cargo: r.qualificacao,
      grupo_economico: r.emissores!.grupo_economico,
    }))
    .sort((a, b) => a.razao_social.localeCompare(b.razao_social));
}

export interface PessoaLink {
  id: string;
  tipo: string;
  url: string;
  label: string | null;
}
export interface PessoaSociedade {
  id: string;
  empresa: string;
  cnpj: string | null;
  cargo: string | null;
  situacao: string | null;
  fonte_url: string | null;
  emissor_id: string | null;
}

export async function getPessoaLinks(pessoaId: string): Promise<PessoaLink[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_links")
    .select("id, tipo, url, label")
    .eq("pessoa_id", pessoaId)
    .order("tipo");
  if (error) throw error;
  return (data as PessoaLink[]) ?? [];
}

/** Adiciona/atualiza um link de rede social (upsert por pessoa+tipo). */
export async function addPessoaLink(
  pessoaId: string,
  dados: { tipo: string; url: string; label?: string | null }
): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  // remove o link existente do mesmo tipo (1 por rede) e insere o novo
  await s.from("pessoa_links").delete().eq("pessoa_id", pessoaId).eq("tipo", dados.tipo);
  const { error } = await s.from("pessoa_links").insert({
    pessoa_id: pessoaId,
    tipo: dados.tipo,
    url: dados.url,
    label: dados.label ?? null,
  });
  if (error) throw error;
}

export async function deletePessoaLink(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_links").delete().eq("id", id);
  if (error) throw error;
}

export interface PessoaEndereco {
  id: string;
  pessoa_id: string;
  rotulo: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  principal: boolean | null;
  criado_em: string;
}

export async function getPessoaEnderecos(pessoaId: string): Promise<PessoaEndereco[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_enderecos")
    .select("*")
    .eq("pessoa_id", pessoaId)
    .order("principal", { ascending: false })
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as PessoaEndereco[]) ?? [];
}

export async function addPessoaEndereco(
  pessoaId: string,
  dados: Partial<Omit<PessoaEndereco, "id" | "pessoa_id" | "criado_em">>
): Promise<PessoaEndereco> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_enderecos")
    .insert({ pessoa_id: pessoaId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data as PessoaEndereco;
}

export async function deletePessoaEndereco(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_enderecos").delete().eq("id", id);
  if (error) throw error;
}

export async function getPessoaSociedades(pessoaId: string): Promise<PessoaSociedade[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_sociedades")
    .select("id, empresa, cnpj, cargo, situacao, fonte_url, emissor_id")
    .eq("pessoa_id", pessoaId)
    .order("empresa");
  if (error) throw error;
  return (data as PessoaSociedade[]) ?? [];
}

export interface EnriquecimentoPessoa {
  cpf?: string | null;
  email?: string | null;
  fone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  redes?: { tipo: string; url: string; label?: string | null }[];
  contatos?: { tipo: string; valor: string }[];
  sociedades?: {
    empresa: string;
    cnpj?: string | null;
    cargo?: string | null;
    situacao?: string | null;
    fonte_url?: string | null;
  }[];
}

export async function criarPessoa(p: {
  nome: string;
  email?: string | null;
  fone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  notas?: string | null;
}): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { data, error } = await s
    .from("pessoas")
    .insert({
      nome: p.nome,
      email: p.email ?? null,
      fone: p.fone ?? null,
      logradouro: p.logradouro ?? null,
      municipio: p.municipio ?? null,
      uf: p.uf ?? null,
      cep: p.cep ?? null,
      notas: p.notas ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Persiste o resultado da busca na web no cadastro da pessoa. */
export async function salvarEnriquecimentoPessoa(
  id: string,
  d: EnriquecimentoPessoa,
  client?: ReturnType<typeof createClient>
): Promise<{ redes: number; sociedades: number }> {
  if (!client && !isSupabaseConfigured()) return { redes: 0, sociedades: 0 };
  const s = client ?? createClient();

  // 1) Campos cadastrais (não sobrescreve com nulo)
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const k of ["cpf", "email", "fone", "logradouro", "municipio", "uf", "cep"] as const) {
    if (d[k]) patch[k] = d[k];
  }
  if (d.contatos && d.contatos.length) patch.contatos = d.contatos;
  await s.from("pessoas").update(patch).eq("id", id);

  // 2) Redes / links (refresh)
  const redes = (d.redes ?? []).filter((r) => r && r.url);
  await s.from("pessoa_links").delete().eq("pessoa_id", id);
  if (redes.length) {
    await s.from("pessoa_links").insert(
      redes.map((r) => ({ pessoa_id: id, tipo: r.tipo || "outro", url: r.url, label: r.label ?? null }))
    );
  }

  // 3) Outras sociedades (refresh); tenta casar com emissores por raiz de CNPJ
  const socs = (d.sociedades ?? []).filter((x) => x && x.empresa);
  await s.from("pessoa_sociedades").delete().eq("pessoa_id", id);
  if (socs.length) {
    await s.from("pessoa_sociedades").insert(
      socs.map((x) => ({
        pessoa_id: id,
        empresa: x.empresa,
        cnpj: x.cnpj ?? null,
        cargo: x.cargo ?? null,
        situacao: x.situacao ?? null,
        fonte_url: x.fonte_url ?? null,
      }))
    );
  }
  return { redes: redes.length, sociedades: socs.length };
}

/**
 * Cadastra (ou vincula) uma "outra sociedade" como produtor (emissor) completo,
 * com dados e QSA da Receita Federal — para ter a mesma gestão da matriz.
 */
export async function cadastrarSociedadeComoEmissor(
  socId: string,
  cnpj: string | null,
  nomeFallback: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const s = createClient();
  const dig = cnpjDigitos(cnpj);
  let emissorId: string | null = null;

  // Já existe um emissor com esse CNPJ?
  if (dig.length === 14) {
    const fmt = mascararCnpj(dig);
    const { data: ex } = await s
      .from("emissores")
      .select("id")
      .eq("cnpj", fmt)
      .maybeSingle();
    if (ex) emissorId = (ex as { id: string }).id;
  }

  if (!emissorId) {
    let dados: Awaited<ReturnType<typeof buscarCadastroCnpj>> | null = null;
    if (dig.length === 14) {
      try {
        dados = await buscarCadastroCnpj(dig);
      } catch {
        /* segue com o nome do fallback */
      }
    }
    const saved = await upsertEmissor({
      razao_social: dados?.razao_social || nomeFallback,
      cnpj: dados?.cnpj || (dig.length === 14 ? mascararCnpj(dig) : undefined),
      logradouro: dados?.logradouro ?? null,
      municipio: dados?.municipio ?? null,
      uf: dados?.uf ?? null,
      cep: dados?.cep ?? null,
      fone: dados?.fone ?? null,
      tipo: "concorrente",
    });
    emissorId = saved.id;
    if (dados) {
      await atualizarCadastralEmissor(emissorId, {
        data_fundacao: dados.data_fundacao,
        situacao_cadastral: dados.situacao,
        atividade_principal: dados.atividade_principal,
        capital_social: dados.capital_social,
        natureza_juridica: dados.natureza_juridica,
        matriz_filial: dados.matriz_filial,
      });
      if (dados.socios?.length) await salvarSocios(emissorId, dados.socios);
    }
  }

  // Filial herda o grupo econômico da matriz/irmã (mesma raiz de CNPJ).
  if (dig.length === 14 && emissorId) {
    const prefixo = `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5, 8)}`;
    const { data: irmas } = await s
      .from("emissores")
      .select("id, grupo_economico")
      .like("cnpj", `${prefixo}%`);
    const comGrupo = (irmas as { id: string; grupo_economico: string | null }[] | null)?.find(
      (x) => x.grupo_economico && x.id !== emissorId
    );
    const atualId = emissorId;
    const atual = (irmas as { id: string; grupo_economico: string | null }[] | null)?.find(
      (x) => x.id === atualId
    );
    if (comGrupo && !atual?.grupo_economico) {
      await s
        .from("emissores")
        .update({ grupo_economico: comGrupo.grupo_economico })
        .eq("id", emissorId);
    }
  }

  await s.from("pessoa_sociedades").update({ emissor_id: emissorId }).eq("id", socId);
  return emissorId;
}

export async function atualizarPessoa(
  id: string,
  dados: Partial<Omit<Pessoa, "id">>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("pessoas")
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Múltiplos telefones ───────────────────────────────────────────────────────

export async function getPessoaTelefones(pessoaId: string): Promise<PessoaTelefone[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_telefones")
    .select("*")
    .eq("pessoa_id", pessoaId)
    .order("principal", { ascending: false })
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as PessoaTelefone[]) ?? [];
}

export async function addPessoaTelefone(
  pessoaId: string,
  dados: Pick<PessoaTelefone, "tipo" | "numero"> & { rotulo?: string | null }
): Promise<PessoaTelefone> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_telefones")
    .insert({ pessoa_id: pessoaId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data as PessoaTelefone;
}

export async function deletePessoaTelefone(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_telefones").delete().eq("id", id);
  if (error) throw error;
}

// ── Múltiplos e-mails ─────────────────────────────────────────────────────────

export async function getPessoaEmails(pessoaId: string): Promise<PessoaEmail[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_emails")
    .select("*")
    .eq("pessoa_id", pessoaId)
    .order("principal", { ascending: false })
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as PessoaEmail[]) ?? [];
}

export async function addPessoaEmail(
  pessoaId: string,
  dados: Pick<PessoaEmail, "email"> & { rotulo?: string | null }
): Promise<PessoaEmail> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_emails")
    .insert({ pessoa_id: pessoaId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data as PessoaEmail;
}

export async function deletePessoaEmail(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_emails").delete().eq("id", id);
  if (error) throw error;
}

// ── Contatos vinculados a clientes ────────────────────────────────────────────

export async function getContatosCliente(clienteId: string): Promise<ContatoCliente[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  try {
    const { data, error } = await s
      .from("cliente_pessoas")
      .select("*, pessoa:pessoas(id, nome, fone, email)")
      .eq("cliente_id", clienteId)
      .order("principal", { ascending: false })
      .order("criado_em");
    if (error) {
      if ((error as { code?: string }).code === "42P01") return [];
      throw error;
    }
    return (data as ContatoCliente[]) ?? [];
  } catch {
    return [];
  }
}

export async function vincularPessoaCliente(
  clienteId: string,
  pessoaId: string,
  cargo?: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s
    .from("cliente_pessoas")
    .upsert({ cliente_id: clienteId, pessoa_id: pessoaId, cargo: cargo ?? null }, {
      onConflict: "cliente_id,pessoa_id",
    });
  if (error) throw error;
}

export async function desvincularPessoaCliente(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("cliente_pessoas").delete().eq("id", id);
  if (error) throw error;
}

// ── Identidades multi-fonte (m365, 365, linkedin, instagram, whatsapp, …) ──────

export interface PessoaIdentidade {
  id: string;
  pessoa_id: string;
  fonte: string;
  external_id: string | null;
  handle: string | null;
  url: string | null;
  criado_em: string;
}

/** Fontes conhecidas (rótulos amigáveis). Extensível: aceita qualquer string. */
export const FONTES_IDENTIDADE: Record<string, string> = {
  m365: "Microsoft 365",
  "365": "Três-meia-cinco (365)",
  contrato: "Contrato",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  receita_qsa: "Receita (QSA)",
  outro: "Outra",
};

export async function getPessoaIdentidades(pessoaId: string): Promise<PessoaIdentidade[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_identidades")
    .select("id, pessoa_id, fonte, external_id, handle, url, criado_em")
    .eq("pessoa_id", pessoaId)
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as PessoaIdentidade[]) ?? [];
}

export async function addPessoaIdentidade(
  pessoaId: string,
  dados: { fonte: string; external_id?: string | null; handle?: string | null; url?: string | null }
): Promise<PessoaIdentidade> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_identidades")
    .insert({
      pessoa_id: pessoaId,
      fonte: dados.fonte,
      external_id: dados.external_id || null,
      handle: dados.handle || null,
      url: dados.url || null,
    })
    .select("id, pessoa_id, fonte, external_id, handle, url, criado_em")
    .single();
  if (error) throw error;
  return data as PessoaIdentidade;
}

export async function deletePessoaIdentidade(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_identidades").delete().eq("id", id);
  if (error) throw error;
}

// ── Pessoas duplicadas + mesclagem ────────────────────────────────────────────

export interface PessoaDup {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  fone: string | null;
  atualizado_em: string | null;
}

export interface GrupoPessoaDuplicada {
  chave: string;
  rotulo: string;
  membros: PessoaDup[];
}

/** Agrupa pessoas candidatas a duplicidade: mesmo CPF, ou mesmo nome normalizado. */
export async function getPessoasDuplicadas(): Promise<GrupoPessoaDuplicada[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoas")
    .select("id, nome, cpf, email, fone, atualizado_em")
    .limit(8000);
  if (error) throw error;
  const norm = (n: string) =>
    n.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const grupos = new Map<string, { rotulo: string; membros: PessoaDup[] }>();
  for (const p of (data as PessoaDup[]) ?? []) {
    const dig = (p.cpf ?? "").replace(/\D/g, "");
    const chave = dig.length === 11 ? `cpf:${dig}` : `nome:${norm(p.nome)}`;
    if (!grupos.has(chave)) grupos.set(chave, { rotulo: p.nome, membros: [] });
    grupos.get(chave)!.membros.push(p);
  }
  return [...grupos.entries()]
    .filter(([, g]) => g.membros.length > 1)
    .map(([chave, g]) => ({
      chave,
      rotulo: g.rotulo,
      membros: g.membros.sort((a, b) =>
        (b.atualizado_em ?? "").localeCompare(a.atualizado_em ?? "")
      ),
    }))
    .sort((a, b) => b.membros.length - a.membros.length);
}

/** Mescla pessoas duplicadas no mestre (RPC mesclar_pessoas). */
export async function mesclarPessoas(masterId: string, dupIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.rpc("mesclar_pessoas", {
    p_master: masterId,
    p_dups: dupIds,
  });
  if (error) throw error;
}
