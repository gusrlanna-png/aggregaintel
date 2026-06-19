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
  conta_origem: string | null;
  criado_por: string | null;
  criado_por_nome?: string | null;
  raw: Record<string, unknown> | null;
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
    .select("id, pessoa_id, fonte, external_id, handle, url, conta_origem, criado_por, raw, criado_em")
    .eq("pessoa_id", pessoaId)
    .order("criado_em");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  const lista = (data as PessoaIdentidade[]) ?? [];
  // Resolve o nome de quem vinculou (app_usuarios) para exibição.
  const ids = [...new Set(lista.map((i) => i.criado_por).filter(Boolean))] as string[];
  if (ids.length) {
    const { data: us } = await s.from("app_usuarios").select("id, nome, email").in("id", ids);
    const mapa = new Map((us ?? []).map((u: { id: string; nome: string | null; email: string | null }) => [u.id, u.nome || u.email]));
    for (const i of lista) i.criado_por_nome = i.criado_por ? mapa.get(i.criado_por) ?? null : null;
  }
  return lista;
}

export async function addPessoaIdentidade(
  pessoaId: string,
  dados: {
    fonte: string;
    external_id?: string | null;
    handle?: string | null;
    url?: string | null;
    conta_origem?: string | null;
    raw?: Record<string, unknown> | null;
  }
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
      conta_origem: dados.conta_origem || null,
      raw: dados.raw ?? null,
    })
    .select("id, pessoa_id, fonte, external_id, handle, url, conta_origem, criado_por, raw, criado_em")
    .single();
  if (error) throw error;
  return data as PessoaIdentidade;
}

/**
 * Traz os dados de um contato (e-mails/telefones) para uma pessoa existente, sem
 * duplicar: adiciona os que faltam em pessoa_emails/pessoa_telefones e preenche
 * o e-mail/telefone principal se estiverem vazios. Usado ao VINCULAR contatos.
 */
export async function adicionarDadosContato(
  pessoaId: string,
  dados: { emails?: string[]; fones?: string[] }
): Promise<{ emails: number; fones: number }> {
  if (!isSupabaseConfigured()) return { emails: 0, fones: 0 };
  const s = createClient();
  const emails = [...new Set((dados.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e)))];
  const fones = [...new Set((dados.fones ?? []).map((f) => f.trim()).filter((f) => f.replace(/\D/g, "").length >= 8))];

  const [{ data: exEmails }, { data: exFones }, { data: pe }] = await Promise.all([
    s.from("pessoa_emails").select("email").eq("pessoa_id", pessoaId),
    s.from("pessoa_telefones").select("numero").eq("pessoa_id", pessoaId),
    s.from("pessoas").select("email, fone").eq("id", pessoaId).maybeSingle(),
  ]);
  const jaEmails = new Set((exEmails ?? []).map((r: { email: string }) => r.email.trim().toLowerCase()));
  if (pe?.email) jaEmails.add(pe.email.trim().toLowerCase());
  const jaFones = new Set((exFones ?? []).map((r: { numero: string }) => r.numero.replace(/\D/g, "")));
  if (pe?.fone) jaFones.add(pe.fone.replace(/\D/g, ""));

  let nE = 0, nF = 0;
  for (const e of emails) {
    if (jaEmails.has(e)) continue;
    try { await addPessoaEmail(pessoaId, { email: e }); nE++; jaEmails.add(e); } catch {/* ignora */}
  }
  for (const f of fones) {
    if (jaFones.has(f.replace(/\D/g, ""))) continue;
    try { await addPessoaTelefone(pessoaId, { tipo: "celular", numero: f }); nF++; jaFones.add(f.replace(/\D/g, "")); } catch {/* ignora */}
  }
  // Preenche principal vazio.
  const patch: { email?: string; fone?: string } = {};
  if (!pe?.email && emails[0]) patch.email = emails[0];
  if (!pe?.fone && fones[0]) patch.fone = fones[0];
  if (Object.keys(patch).length) {
    try { await atualizarPessoa(pessoaId, patch); } catch {/* ignora */}
  }
  return { emails: nE, fones: nF };
}

export async function deletePessoaIdentidade(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("pessoa_identidades").delete().eq("id", id);
  if (error) throw error;
}

// ── Histórico de contatos M365 (por usuário que vinculou) ─────────────────────

export interface HistoricoContatoM365 {
  id: string;
  pessoa_id: string;
  pessoa_nome: string | null;
  fonte: string;
  external_id: string | null;
  conta_origem: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  raw: Record<string, unknown> | null;
}

/**
 * Histórico de contatos importados/vinculados do Microsoft 365, com quem
 * vinculou (criado_por) e a conta de origem. Admin vê todos; demais perfis
 * veem o que a RLS de pessoa_identidades permite. Filtra por usuário opcional.
 */
export async function getHistoricoContatosM365(
  usuarioId?: string
): Promise<HistoricoContatoM365[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  let q = s
    .from("pessoa_identidades")
    .select(
      "id, pessoa_id, fonte, external_id, conta_origem, criado_por, criado_em, raw, pessoa:pessoas(nome)"
    )
    .in("fonte", ["m365", "365"])
    .order("criado_em", { ascending: false })
    .limit(2000);
  if (usuarioId) q = q.eq("criado_por", usuarioId);
  const { data, error } = await q;
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  type Row = Omit<HistoricoContatoM365, "pessoa_nome" | "criado_por_nome"> & {
    pessoa: { nome: string | null } | { nome: string | null }[] | null;
  };
  const lista = ((data as unknown as Row[]) ?? []).map((r) => {
    const p = Array.isArray(r.pessoa) ? r.pessoa[0] : r.pessoa;
    return {
      id: r.id,
      pessoa_id: r.pessoa_id,
      pessoa_nome: p?.nome ?? null,
      fonte: r.fonte,
      external_id: r.external_id,
      conta_origem: r.conta_origem,
      criado_por: r.criado_por,
      criado_por_nome: null as string | null,
      criado_em: r.criado_em,
      raw: r.raw,
    };
  });
  // Resolve nome de quem vinculou.
  const ids = [...new Set(lista.map((i) => i.criado_por).filter(Boolean))] as string[];
  if (ids.length) {
    const { data: us } = await s
      .from("app_usuarios")
      .select("id, nome, email")
      .in("id", ids);
    const mapa = new Map(
      (us ?? []).map((u: { id: string; nome: string | null; email: string | null }) => [
        u.id,
        u.nome || u.email,
      ])
    );
    for (const i of lista)
      i.criado_por_nome = i.criado_por ? mapa.get(i.criado_por) ?? null : null;
  }
  return lista;
}

/** Lista de usuários distintos que vincularam contatos M365 (para filtro). */
export async function getUsuariosComContatosM365(): Promise<
  { id: string; nome: string }[]
> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("pessoa_identidades")
    .select("criado_por")
    .in("fonte", ["m365", "365"])
    .not("criado_por", "is", null)
    .limit(5000);
  if (error) return [];
  const ids = [
    ...new Set((data ?? []).map((r: { criado_por: string }) => r.criado_por)),
  ];
  if (!ids.length) return [];
  const { data: us } = await s
    .from("app_usuarios")
    .select("id, nome, email")
    .in("id", ids);
  return (us ?? [])
    .map((u: { id: string; nome: string | null; email: string | null }) => ({
      id: u.id,
      nome: u.nome || u.email || u.id,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
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

// ── Matching de pessoas (e-mail, telefone, nome completo/parcial) ─────────────

const normNome = (n: string) =>
  (n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const soDig = (v: string) => (v ?? "").replace(/\D/g, "");
/** Compara telefones pelos últimos 8 dígitos (ignora DDI/DDD divergentes). */
const foneKey = (v: string) => {
  const d = soDig(v);
  return d.length >= 8 ? d.slice(-8) : "";
};
const STOP = new Set(["de", "da", "do", "dos", "das", "e", "junior", "jr", "neto", "filho"]);

export interface IndicePessoas {
  byEmail: Map<string, { id: string; nome: string }>;
  byFone: Map<string, { id: string; nome: string }>;
  byNome: Map<string, { id: string; nome: string }>;
  byExternal: Map<string, { id: string; nome: string }>; // fonte:external_id já vinculado
  todos: { id: string; nome: string; tokens: string[] }[];
}

/** Monta um índice das pessoas (e seus e-mails/telefones extras) para matching. */
export async function getIndicePessoas(): Promise<IndicePessoas> {
  const idx: IndicePessoas = {
    byEmail: new Map(),
    byFone: new Map(),
    byNome: new Map(),
    byExternal: new Map(),
    todos: [],
  };
  if (!isSupabaseConfigured()) return idx;
  const s = createClient();
  const [pes, emails, fones, idents] = await Promise.all([
    s.from("pessoas").select("id, nome, email, fone"),
    s.from("pessoa_emails").select("pessoa_id, email"),
    s.from("pessoa_telefones").select("pessoa_id, numero"),
    s.from("pessoa_identidades").select("pessoa_id, fonte, external_id"),
  ]);
  const nomeDe = new Map<string, string>();
  for (const p of (pes.data as { id: string; nome: string; email: string | null; fone: string | null }[] | null) ?? []) {
    nomeDe.set(p.id, p.nome);
    const ref = { id: p.id, nome: p.nome };
    if (p.email) idx.byEmail.set(p.email.trim().toLowerCase(), ref);
    if (p.fone && foneKey(p.fone)) idx.byFone.set(foneKey(p.fone), ref);
    const nn = normNome(p.nome);
    if (nn) idx.byNome.set(nn, ref);
    idx.todos.push({ id: p.id, nome: p.nome, tokens: nn.split(" ").filter((t) => t.length > 2 && !STOP.has(t)) });
  }
  for (const e of (emails.data as { pessoa_id: string; email: string }[] | null) ?? []) {
    if (e.email) idx.byEmail.set(e.email.trim().toLowerCase(), { id: e.pessoa_id, nome: nomeDe.get(e.pessoa_id) ?? "" });
  }
  for (const f of (fones.data as { pessoa_id: string; numero: string }[] | null) ?? []) {
    const k = foneKey(f.numero);
    if (k) idx.byFone.set(k, { id: f.pessoa_id, nome: nomeDe.get(f.pessoa_id) ?? "" });
  }
  for (const it of (idents.data as { pessoa_id: string; fonte: string; external_id: string | null }[] | null) ?? []) {
    if (it.external_id) idx.byExternal.set(`${it.fonte}:${it.external_id}`, { id: it.pessoa_id, nome: nomeDe.get(it.pessoa_id) ?? "" });
  }
  return idx;
}

export type MatchTipo = "existe" | "duplicata" | "novo";
export interface MatchPessoa {
  tipo: MatchTipo;
  pessoaId?: string;
  pessoaNome?: string;
  motivo?: string;
}

/** Casa um contato com o índice: e-mail/telefone/nome exatos = existe; nome
 *  parcial (todos os tokens contidos) = possível duplicata; senão = novo. */
export function casarContato(
  c: { nome: string; emails?: string[]; fones?: string[]; externalId?: string | null; fonte?: string },
  idx: IndicePessoas
): MatchPessoa {
  // Já vinculado anteriormente (qualquer sessão/usuário) — histórico persistente.
  if (c.externalId) {
    const j = idx.byExternal.get(`${c.fonte ?? "m365"}:${c.externalId}`);
    if (j) return { tipo: "existe", pessoaId: j.id, pessoaNome: j.nome, motivo: "já vinculado" };
  }
  for (const e of c.emails ?? []) {
    const m = idx.byEmail.get((e ?? "").trim().toLowerCase());
    if (m) return { tipo: "existe", pessoaId: m.id, pessoaNome: m.nome, motivo: "e-mail igual" };
  }
  for (const f of c.fones ?? []) {
    const m = idx.byFone.get(foneKey(f));
    if (foneKey(f) && m) return { tipo: "existe", pessoaId: m.id, pessoaNome: m.nome, motivo: "telefone igual" };
  }
  const nn = normNome(c.nome);
  const exato = idx.byNome.get(nn);
  if (exato) return { tipo: "existe", pessoaId: exato.id, pessoaNome: exato.nome, motivo: "nome igual" };
  // Nome parcial: todos os tokens (>2) do contato presentes numa pessoa (ou vice-versa).
  const toks = nn.split(" ").filter((t) => t.length > 2 && !STOP.has(t));
  if (toks.length >= 2) {
    for (const p of idx.todos) {
      if (p.tokens.length < 2) continue;
      const contidoA = toks.every((t) => p.tokens.includes(t));
      const contidoB = p.tokens.every((t) => toks.includes(t));
      if (contidoA || contidoB) {
        return { tipo: "duplicata", pessoaId: p.id, pessoaNome: p.nome, motivo: "nome parcial" };
      }
    }
  }
  return { tipo: "novo" };
}

/**
 * Importa contatos (de CSV) com De→Para por nome normalizado: contatos já
 * existentes são pulados (dedup); novos viram pessoas, com telefones/e-mails.
 */
export async function importarContatosCsv(
  rows: { nome: string; fones: string[]; emails: string[]; empresa?: string | null; cargo?: string | null }[]
): Promise<{ criados: number; pulados: number; erros: number }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado");
  const norm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const existentes = await getPessoas();
  const indice = new Set(existentes.map((p) => norm(p.nome)));

  let criados = 0;
  let pulados = 0;
  let erros = 0;
  for (const r of rows) {
    const nome = (r.nome ?? "").trim();
    if (!nome) continue;
    if (indice.has(norm(nome))) {
      pulados++;
      continue;
    }
    try {
      const notas = [r.empresa, r.cargo].filter(Boolean).join(" · ") || null;
      const id = await criarPessoa({
        nome,
        fone: r.fones[0] ?? null,
        email: r.emails[0] ?? null,
        notas,
      });
      for (const f of r.fones.slice(1)) {
        try {
          await addPessoaTelefone(id, { tipo: "celular", numero: f });
        } catch {
          /* ignora telefone duplicado/ inválido */
        }
      }
      for (const e of r.emails.slice(1)) {
        try {
          await addPessoaEmail(id, { email: e });
        } catch {
          /* ignora email duplicado/ inválido */
        }
      }
      indice.add(norm(nome));
      criados++;
    } catch {
      erros++;
    }
  }
  return { criados, pulados, erros };
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
