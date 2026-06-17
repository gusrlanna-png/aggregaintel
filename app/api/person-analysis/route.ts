import { NextResponse, type NextRequest } from "next/server";

import { getAnthropic, isClaudeConfigured, CLAUDE_MODEL } from "@/lib/claude/client";
import { askPerplexity, isPerplexityConfigured } from "@/lib/ai/perplexity";

export const runtime = "nodejs";
export const maxDuration = 60;

async function extrairEstruturado(resumo: string, nome: string): Promise<unknown | null> {
  if (!isClaudeConfigured() || !resumo) return null;
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
    const a = txt.indexOf("{");
    const b = txt.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    return JSON.parse(txt.slice(a, b + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nome: string = body?.nome?.trim();
  const empresas: string[] = Array.isArray(body?.empresas) ? body.empresas : [];
  if (!nome) {
    return NextResponse.json({ error: "Nome ausente." }, { status: 400 });
  }

  const ctx = empresas.length ? ` Sócio das empresas: ${empresas.join("; ")}.` : "";
  const prompt = `Você é um investigador de inteligência empresarial. Pesquise na web a pessoa física "${nome}".${ctx}
Busque e relate, com fontes: CPF (mesmo parcial), e-mails, telefones, endereços (comercial e residencial), redes sociais (Instagram, Facebook, LinkedIn, YouTube), site pessoal, e TODAS as outras empresas em que a pessoa consta como sócio/administrador (quadro societário — nome da empresa, CNPJ, cargo, situação).
Responda em português, objetivo, em tópicos. Se não encontrar algo, diga "sem informações".`;

  let resumo = "";
  let sources: { url: string; title: string }[] = [];

  if (isPerplexityConfigured()) {
    try {
      const r = await askPerplexity(prompt, {
        system: "Você responde em português citando as fontes da web.",
        maxTokens: 1500,
        recency: "year",
      });
      resumo = r.content || "";
      sources = r.sources ?? [];
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
    return NextResponse.json({
      fallback: true,
      message:
        "Configure PERPLEXITY_API_KEY ou ANTHROPIC_API_KEY para a busca automática de pessoas.",
    });
  }

  return NextResponse.json({
    resumo,
    sources,
    dados: await extrairEstruturado(resumo, nome),
  });
}
