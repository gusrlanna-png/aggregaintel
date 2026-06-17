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
    .select("qualificacao, emissores(id, razao_social, cnpj, municipio, uf, grupo_economico)")
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

/** Persiste o resultado da busca na web no cadastro da pessoa. */
export async function salvarEnriquecimentoPessoa(
  id: string,
  d: EnriquecimentoPessoa
): Promise<{ redes: number; sociedades: number }> {
  if (!isSupabaseConfigured()) return { redes: 0, sociedades: 0 };
  const s = createClient();

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
