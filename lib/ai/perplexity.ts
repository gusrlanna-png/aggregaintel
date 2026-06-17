/**
 * Perplexity Sonar — busca na web em tempo real com citações.
 * Ideal para a análise de mercado (notícias, licenciamento, processos).
 * Chave: https://www.perplexity.ai/settings/api  (env PERPLEXITY_API_KEY)
 */
export const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL ?? "sonar";

export const isPerplexityConfigured = (): boolean =>
  Boolean(process.env.PERPLEXITY_API_KEY);

export interface PerplexityResult {
  content: string;
  sources: { title: string; url: string }[];
}

export async function askPerplexity(
  prompt: string,
  opts: { system?: string; maxTokens?: number; recency?: string } = {}
): Promise<PerplexityResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY não configurada.");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: 0.2,
      messages: [
        ...(opts.system
          ? [{ role: "system", content: opts.system }]
          : []),
        { role: "user", content: prompt },
      ],
      ...(opts.recency ? { search_recency_filter: opts.recency } : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  // A API retorna 'citations' (string[]) e/ou 'search_results' ([{title,url}]).
  const sources: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const r of data?.search_results ?? []) {
    if (r?.url && !seen.has(r.url)) {
      seen.add(r.url);
      sources.push({ url: r.url, title: r.title ?? r.url });
    }
  }
  for (const url of data?.citations ?? []) {
    if (typeof url === "string" && !seen.has(url)) {
      seen.add(url);
      sources.push({ url, title: url });
    }
  }

  return { content, sources };
}
