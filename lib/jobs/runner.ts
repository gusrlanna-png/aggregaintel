import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTokenClient } from "@/lib/supabase/server";
import { analisarPessoa } from "@/lib/ai/person-analysis";
import { salvarEnriquecimentoPessoa, type EnriquecimentoPessoa } from "@/lib/supabase/pessoas";
import { atualizarCadastralEmissor, salvarSocios } from "@/lib/supabase/emissores";
import { buscarCadastroCnpj } from "@/lib/utils/cnpj";
import { investigarEmpresaWeb } from "@/lib/ai/investigacao";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sb = SupabaseClient;

interface JobRow {
  id: string;
  tipo: string;
  payload: Record<string, unknown>;
}

type Progresso = (pct: number, etapa: string) => Promise<void>;
type Logger = (
  nivel: "info" | "sucesso" | "aviso" | "erro",
  mensagem: string,
  dados?: Record<string, unknown>
) => Promise<void>;

interface Ctx {
  prog: Progresso;
  log: Logger;
}

/** Handlers por tipo de job. Cada um roda no servidor com o client do usuário. */
const HANDLERS: Record<
  string,
  (job: JobRow, sb: Sb, ctx: Ctx) => Promise<Record<string, unknown>>
> = {
  // Atualização de uma pessoa/contato pela web (CPF, redes, sociedades…)
  async person_analysis(job, sb, { prog, log }) {
    const nome = String(job.payload.nome ?? "");
    const pessoaId = String(job.payload.pessoaId ?? "");
    const empresas = Array.isArray(job.payload.empresas)
      ? (job.payload.empresas as string[])
      : [];
    if (!nome || !pessoaId) throw new Error("payload incompleto (nome/pessoaId).");

    await prog(20, "Pesquisando na web…");
    await log("info", `Iniciando pesquisa web de "${nome}"`, { empresas: empresas.length });
    const r = await analisarPessoa(nome, empresas);
    if (r.fallback || !r.dados) {
      throw new Error(r.message ?? "Sem dados encontrados na web.");
    }
    await log("info", `Pesquisa concluída — ${r.sources?.length ?? 0} fonte(s)`);

    await prog(70, "Salvando enriquecimento…");
    const res = await salvarEnriquecimentoPessoa(
      pessoaId,
      r.dados as EnriquecimentoPessoa,
      sb
    );
    await log("sucesso", `Cadastro atualizado: ${res.redes} rede(s), ${res.sociedades} sociedade(s)`, res);
    if (r.uso) {
      await log(
        "info",
        `IA: ${r.uso.provedor} (${r.uso.modelo}) — ${r.uso.tokens_in + r.uso.tokens_out} tokens`,
        r.uso
      );
    }
    await prog(95, "Finalizando…");
    return {
      redes: res.redes,
      sociedades: res.sociedades,
      fontes: r.sources?.length ?? 0,
      provedor: r.uso?.provedor ?? null,
      modelo: r.uso?.modelo ?? null,
      tokens_in: r.uso?.tokens_in ?? 0,
      tokens_out: r.uso?.tokens_out ?? 0,
    };
  },

  // Atualização em cadeia de um produtor: dados cadastrais + sócios (Receita)
  // da empresa E de TODAS as empresas do mesmo grupo / mesma raiz de CNPJ.
  async cascade_update(job, sb, { prog, log }) {
    const emissorId = String(job.payload.emissorId ?? "");
    if (!emissorId) throw new Error("payload incompleto (emissorId).");

    const { data: emissor } = await sb
      .from("emissores")
      .select("id, razao_social, cnpj, grupo_economico")
      .eq("id", emissorId)
      .single();
    if (!emissor) throw new Error("Produtor não encontrado.");

    // Monta o conjunto de empresas a atualizar (sem duplicar).
    const alvos = new Map<string, { id: string; razao: string; cnpj: string | null }>();
    alvos.set(emissor.id, { id: emissor.id, razao: emissor.razao_social, cnpj: emissor.cnpj });

    if (emissor.grupo_economico) {
      const { data: g } = await sb
        .from("emissores")
        .select("id, razao_social, cnpj")
        .eq("grupo_economico", emissor.grupo_economico);
      for (const e of g ?? []) alvos.set(e.id, { id: e.id, razao: e.razao_social, cnpj: e.cnpj });
    }
    const raiz = (emissor.cnpj ?? "").replace(/\D/g, "").slice(0, 8);
    if (raiz.length === 8) {
      const mask = `%${raiz.slice(0, 2)}.${raiz.slice(2, 5)}.${raiz.slice(5, 8)}%`;
      const { data: u } = await sb
        .from("emissores")
        .select("id, razao_social, cnpj")
        .ilike("cnpj", mask);
      for (const e of u ?? []) alvos.set(e.id, { id: e.id, razao: e.razao_social, cnpj: e.cnpj });
    }

    const lista = Array.from(alvos.values());
    await log("info", `Atualizando ${lista.length} empresa(s) do grupo`, {
      empresas: lista.map((l) => l.razao),
    });

    let okCad = 0, okSoc = 0, totalSoc = 0, falhas = 0;
    for (let i = 0; i < lista.length; i++) {
      const emp = lista[i];
      await prog(10 + Math.round((i / lista.length) * 85), `Atualizando ${emp.razao}…`);
      const dig = (emp.cnpj ?? "").replace(/\D/g, "");
      if (dig.length !== 14) {
        await log("aviso", `${emp.razao}: sem CNPJ válido — pulado.`);
        continue;
      }
      try {
        const c = await buscarCadastroCnpj(dig);
        await atualizarCadastralEmissor(
          emp.id,
          {
            razao_social: c.razao_social ?? emp.razao,
            cnpj: c.cnpj ?? emp.cnpj ?? undefined,
            logradouro: c.logradouro,
            municipio: c.municipio,
            uf: c.uf,
            cep: c.cep,
            fone: c.fone,
            data_fundacao: c.data_fundacao,
            situacao_cadastral: c.situacao,
            atividade_principal: c.atividade_principal,
            capital_social: c.capital_social,
            natureza_juridica: c.natureza_juridica,
            matriz_filial: c.matriz_filial,
          },
          sb
        );
        okCad++;
        const socios = c.socios ?? [];
        await salvarSocios(emp.id, socios, sb);
        okSoc++;
        totalSoc += socios.length;
        await log("sucesso", `${emp.razao}: cadastral + ${socios.length} sócio(s).`);
      } catch (e) {
        falhas++;
        const motivo = e instanceof Error ? e.message : "falha";
        await log("erro", `${emp.razao}: ${motivo}`);
        // Investigação web GRÁTIS para obter ao menos dados parciais (não verificados).
        await prog(10 + Math.round((i / lista.length) * 85), `Investigando ${emp.razao} na web…`);
        const web = await investigarEmpresaWeb(emp.razao, emp.cnpj).catch(() => null);
        if (web) await log("info", `Investigação web (não verificada) de ${emp.razao}: ${web.slice(0, 220)}…`);
        // Registra o aprendizado (para o chat sugerir alternativas e não repetir).
        await sb.from("agente_aprendizados").insert({
          chave_agente: "cascade_update",
          contexto: `${emp.razao} (CNPJ ${emp.cnpj ?? "?"})`,
          problema: `Falha nas fontes da Receita: ${motivo}`,
          solucao: web
            ? `Investigação web (NÃO verificado, revisar): ${web.slice(0, 900)}`
            : "Web sem resultados; revisar o CNPJ manualmente ou tentar mais tarde.",
          sucesso: false,
        });
      }
      await sleep(1200); // respeita limite da BrasilAPI/Receita
    }

    return {
      empresas: lista.length,
      cadastrais_ok: okCad,
      socios_sincronizados: okSoc,
      total_socios: totalSoc,
      falhas,
    };
  },
};

/**
 * Processa um job em segundo plano no processo do servidor. Roda com a
 * identidade do usuário (token), respeitando RLS. Atualiza progresso/status
 * na tabela `jobs` e grava o log de ações em `job_eventos`.
 */
export async function processJob(jobId: string, accessToken: string): Promise<void> {
  const sb = createTokenClient(accessToken);

  const { data: job } = await sb.from("jobs").select("*").eq("id", jobId).single();
  if (!job) return;

  const chave = job.tipo as string;
  const log: Logger = async (nivel, mensagem, dados) => {
    await sb.from("job_eventos").insert({
      job_id: jobId,
      agente_chave: chave,
      nivel,
      mensagem,
      dados: dados ?? null,
    });
  };
  const prog: Progresso = async (pct, etapa) => {
    await sb.from("jobs").update({ progresso: pct, etapa }).eq("id", jobId);
  };

  // Respeita o on/off do agente, se houver registro.
  const { data: agente } = await sb
    .from("agentes")
    .select("ativo, nome")
    .eq("chave", chave)
    .maybeSingle();
  if (agente && agente.ativo === false) {
    await sb
      .from("jobs")
      .update({ status: "cancelado", etapa: "Agente desativado", agente_chave: chave })
      .eq("id", jobId);
    await log("aviso", "Execução cancelada: agente desativado.");
    return;
  }

  await sb
    .from("jobs")
    .update({
      status: "processando",
      iniciado_em: new Date().toISOString(),
      etapa: "Iniciando…",
      progresso: 5,
      agente_chave: chave,
    })
    .eq("id", jobId);
  await log("info", `Tarefa iniciada${agente?.nome ? ` — ${agente.nome}` : ""}.`);

  const handler = HANDLERS[chave];
  if (!handler) {
    await sb
      .from("jobs")
      .update({ status: "erro", erro: `Tipo de tarefa desconhecido: ${chave}` })
      .eq("id", jobId);
    await log("erro", `Tipo de tarefa desconhecido: ${chave}`);
    return;
  }

  try {
    const resultado = await handler(job as JobRow, sb, { prog, log });
    // "Sucesso" só quando NÃO há falhas. Com falhas: parcial (algo deu certo)
    // ou erro (nada deu certo). Nunca marcar concluído escondendo erros.
    const r = resultado as Record<string, unknown>;
    const falhas = Number(r.falhas) || 0;
    const ok = Number(r.ok ?? r.cadastrais_ok ?? 1) || 0;
    let status: string = "concluido";
    let etapaFim = "Concluído";
    let erro: string | null = null;
    if (falhas > 0) {
      status = ok > 0 ? "parcial" : "erro";
      etapaFim = ok > 0 ? `Parcial — ${falhas} falha(s)` : `Falhou — ${falhas} erro(s)`;
      erro = `${falhas} item(ns) não puderam ser obtidos.`;
    }
    await sb
      .from("jobs")
      .update({
        status,
        progresso: 100,
        etapa: etapaFim,
        resultado,
        erro,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", jobId);
    await log(
      status === "concluido" ? "sucesso" : status === "parcial" ? "aviso" : "erro",
      `Tarefa ${status === "concluido" ? "concluída" : status}.`,
      resultado
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no processamento.";
    await sb
      .from("jobs")
      .update({ status: "erro", erro: msg, concluido_em: new Date().toISOString() })
      .eq("id", jobId);
    await log("erro", msg);
  }
}

export const TIPOS_SUPORTADOS = Object.keys(HANDLERS);
