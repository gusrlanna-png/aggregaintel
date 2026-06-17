import { NextResponse, type NextRequest } from "next/server";

import { getAnthropic, isClaudeConfigured, CLAUDE_MODEL } from "@/lib/claude/client";
import { askPerplexity, isPerplexityConfigured } from "@/lib/ai/perplexity";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildLinks(nome: string, municipio?: string | null) {
  const q = encodeURIComponent(nome);
  const qLocal = encodeURIComponent(
    `${nome}${municipio ? " " + municipio : ""}`
  );
  return [
    {
      label: "Google Notícias",
      url: `https://news.google.com/search?q=${qLocal}&hl=pt-BR&gl=BR`,
    },
    {
      label: "Google (web)",
      url: `https://www.google.com/search?q=${qLocal}`,
    },
    {
      label: "Licenciamento ambiental (SEMAD/SIAM MG)",
      url: `https://www.google.com/search?q=${q}+licenciamento+ambiental+SEMAD+OR+SIAM`,
    },
    {
      label: "Processos e publicações (JusBrasil)",
      url: `https://www.jusbrasil.com.br/busca?q=${q}`,
    },
    {
      label: "ANM / Processos minerários",
      url: `https://www.google.com/search?q=${q}+ANM+processo+minerário+OR+CFEM`,
    },
    {
      label: "Instagram",
      url: `https://www.google.com/search?q=${q}+site:instagram.com`,
    },
    {
      label: "LinkedIn",
      url: `https://www.google.com/search?q=${q}+site:linkedin.com`,
    },
  ];
}

/**
 * Extrai, do texto da análise, dados estruturados (processos jurídicos,
 * ambientais e presença digital) para alimentar o cadastro. Usa Claude.
 */
async function extrairEstruturado(
  resumo: string,
  nome: string
): Promise<unknown | null> {
  if (!isClaudeConfigured() || !resumo) return null;
  const schemaPrompt = `Do texto de análise abaixo sobre a empresa "${nome}", extraia SOMENTE o que estiver explícito, em JSON puro (sem markdown), no formato:
{
  "processos_juridicos": [{"numero":null,"orgao":null,"tipo":null,"status":null,"risco":"baixo|medio|alto|critico","descricao":null,"fonte_url":null,"data_ref":"AAAA-MM-DD ou null"}],
  "processos_ambientais": [{"numero":null,"orgao":null,"tipo":null,"classe":null,"status":null,"descricao":null,"fonte_url":null,"data_ref":null}],
  "links": [{"tipo":"site|instagram|facebook|linkedin|youtube|outro","url":"","label":null}]
}
Se não houver itens de uma categoria, retorne lista vazia. Não invente dados. Texto:
"""${resumo.slice(0, 6000)}"""`;
  try {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: schemaPrompt }],
    });
    const txt = (msg.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(txt.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nome: string = body?.nome?.trim();
  const cnpj: string | null = body?.cnpj ?? null;
  const municipio: string | null = body?.municipio ?? null;

  if (!nome) {
    return NextResponse.json(
      { error: "Nome da empresa ausente." },
      { status: 400 }
    );
  }

  const prompt = `Você é um analista de inteligência de mercado do setor de agregados minerais (brita, areia, pó de pedra) em Minas Gerais/Brasil.
Pesquise na web informações RECENTES (últimos 24 meses) sobre a empresa abaixo e produza uma análise objetiva em português.

Empresa: ${nome}${cnpj ? ` (CNPJ ${cnpj})` : ""}${municipio ? ` — ${municipio}` : ""}

Cubra, quando houver: notícias e publicações; presença em redes sociais; licenciamento ambiental e processos (SEMAD/SIAM, ANM, CFEM); expansões, novas pedreiras ou investimentos; situação jurídica/recuperação judicial; contratos e clientes relevantes; sinais de preço/volume.

Formate como tópicos curtos com marcadores (-). Se não encontrar algo, diga "sem informações recentes".`;

  // 1) Perplexity Sonar — busca nativa na web com citações (preferido)
  if (isPerplexityConfigured()) {
    try {
      const r = await askPerplexity(prompt, {
        system:
          "Você responde em português, de forma objetiva, citando as fontes encontradas na web.",
        maxTokens: 1500,
        recency: "year",
      });
      return NextResponse.json({
        summary: r.content || "Sem informações relevantes encontradas.",
        sources: r.sources,
        provider: "perplexity",
        dados: await extrairEstruturado(r.content || "", nome),
      });
    } catch {
      /* cai para o Claude / atalhos */
    }
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json({
      fallback: true,
      links: buildLinks(nome, municipio),
      message: isPerplexityConfigured()
        ? "Falha na Perplexity. Use os atalhos de busca abaixo."
        : "Defina PERPLEXITY_API_KEY (busca na web) ou ANTHROPIC_API_KEY para a análise automática. Enquanto isso, use os atalhos de busca abaixo.",
    });
  }

  try {
    const client = getAnthropic();

    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        } as never,
      ],
    });

    const texto = (msg.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    // Extrai fontes das citações
    const sources = new Map<string, string>();
    for (const block of msg.content as unknown as Array<{
      type: string;
      citations?: Array<{ url?: string; title?: string }>;
      content?: Array<{ url?: string; title?: string }>;
    }>) {
      for (const c of block.citations ?? [])
        if (c.url) sources.set(c.url, c.title ?? c.url);
      for (const r of block.content ?? [])
        if (r.url) sources.set(r.url, r.title ?? r.url);
    }

    return NextResponse.json({
      summary: texto || "Sem informações relevantes encontradas.",
      sources: Array.from(sources, ([url, title]) => ({ url, title })),
      provider: "claude",
      dados: await extrairEstruturado(texto, nome),
    });
  } catch (err) {
    return NextResponse.json(
      {
        fallback: true,
        links: buildLinks(nome, municipio),
        message:
          err instanceof Error
            ? `Falha na análise automática: ${err.message}. Use os atalhos abaixo.`
            : "Falha na análise automática.",
      },
      { status: 200 }
    );
  }
}
