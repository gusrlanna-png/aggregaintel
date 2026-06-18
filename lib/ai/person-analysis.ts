import { getAnthropic, isClaudeConfigured, CLAUDE_MODEL } from "@/lib/claude/client";
import { askPerplexity, isPerplexityConfigured } from "@/lib/ai/perplexity";

export interface PersonAnalysisResult {
  resumo: string;
  sources: { url: string; title: string }[];
  dados: unknown | null;
  fallback?: boolean;
  message?: string;
  /** Consumo de IA desta execução (para o painel de agentes). */
  uso?: { provedor: string; modelo: string; tokens_in: number; tokens_out: number };
}

async function extrairEstruturado(
  resumo: string,
  nome: string
): Promise<{ dados: unknown | null; tin: number; tout: number }> {
  if (!isClaudeConfigured() || !resumo) return { dados: null, tin: 0, tout: 0 };
  const prompt = `Do texto abaixo sobre a pessoa "${nome}", extraia SOMENTE o que estiver explícito, em JSON puro (sem markdown):
{
  "cpf": null,
  "email": null,
  "fone": null,
  "logradouro": null,
  "municipio": null,
  "uf": null,
  "cep": null,
  "redes": [{"tipo":"instagram|facebook|linkedin|youtube|site|outro","url":"","label":null}],
  "contatos": [{"tipo":"email|telefone|endereco_comercial|endereco_residencial","valor":""}],
  "sociedades": [{"empresa":"","cnpj":null,"cargo":null,"situacao":null,"fonte_url":null}]
}
Priorize encontrar o CPF (mesmo parcial). Não invente. Texto:
"""${resumo.slice(0, 6000)}"""`;
  try {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = (msg.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const u = (msg as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    const tin = u?.input_tokens ?? 0;
    const tout = u?.output_tokens ?? 0;
    const a = txt.indexOf("{");
    const b = txt.lastIndexOf("}");
    if (a < 0 || b <= a) return { dados: null, tin, tout };
    return { dados: JSON.parse(txt.slice(a, b + 1)), tin, tout };
  } catch {
    return { dados: null, tin: 0, tout: 0 };
  }
}

/**
 * Pesquisa na web uma pessoa física e extrai dados estruturados (CPF, contatos,
 * redes, sociedades). Usado tanto pela API quanto pelo worker de jobs.
 */
export async function analisarPessoa(
  nome: string,
  empresas: string[] = []
): Promise<PersonAnalysisResult> {
  const ctx = empresas.length ? ` Sócio das empresas: ${empresas.join("; ")}.` : "";
  const prompt = `Você é um investigador de inteligência empresarial. Pesquise na web a pessoa física "${nome}".${ctx}
Busque e relate, com fontes: CPF (mesmo parcial), e-mails, telefones, endereços (comercial e residencial), redes sociais (Instagram, Facebook, LinkedIn, YouTube), site pessoal, e TODAS as outras empresas em que a pessoa consta como sócio/administrador (quadro societário — nome da empresa, CNPJ, cargo, situação).
Responda em português, objetivo, em tópicos. Se não encontrar algo, diga "sem informações".`;

  let resumo = "";
  let sources: { url: string; title: string }[] = [];
  let provedor = "";
  let tinBusca = 0;
  let toutBusca = 0;

  if (isPerplexityConfigured()) {
    try {
      const r = await askPerplexity(prompt, {
        system: "Você responde em português citando as fontes da web.",
        maxTokens: 1500,
        recency: "year",
      });
      resumo = r.content || "";
      sources = r.sources ?? [];
      if (resumo) provedor = "Perplexity";
    } catch {
      /* tenta Claude */
    }
  }

  if (!resumo && isClaudeConfigured()) {
    try {
      const client = getAnthropic();
      const msg = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as never],
      });
      provedor = "Anthropic (Claude)";
      const uBusca = (msg as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      tinBusca = uBusca?.input_tokens ?? 0;
      toutBusca = uBusca?.output_tokens ?? 0;
      resumo = (msg.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim();
      const map = new Map<string, string>();
      for (const block of msg.content as unknown as Array<{
        citations?: Array<{ url?: string; title?: string }>;
        content?: Array<{ url?: string; title?: string }>;
      }>) {
        for (const c of block.citations ?? []) if (c.url) map.set(c.url, c.title ?? c.url);
        for (const r of block.content ?? []) if (r.url) map.set(r.url, r.title ?? r.url);
      }
      sources = Array.from(map, ([url, title]) => ({ url, title }));
    } catch {
      /* sem provider */
    }
  }

  if (!resumo) {
    return {
      resumo: "",
      sources: [],
      dados: null,
      fallback: true,
      message:
        "Configure PERPLEXITY_API_KEY ou ANTHROPIC_API_KEY para a busca automática de pessoas.",
    };
  }

  const ext = await extrairEstruturado(resumo, nome);
  return {
    resumo,
    sources,
    dados: ext.dados,
    uso: {
      provedor: provedor || "Anthropic (Claude)",
      modelo: CLAUDE_MODEL,
      tokens_in: tinBusca + ext.tin,
      tokens_out: toutBusca + ext.tout,
    },
  };
}
