/**
 * Tabela de preços de IA para estimar custo das execuções dos agentes.
 *
 * ⚠️ MANTER ATUALIZADA: preços em USD por 1 milhão de tokens (entrada/saída).
 * Fonte: anthropic.com/pricing. Última revisão: 2026-06.
 * Câmbio USD→BRL também deve ser revisado periodicamente.
 */
export const PRECOS_CLAUDE_USD: Record<string, { in: number; out: number }> = {
  opus: { in: 15, out: 75 },
  sonnet: { in: 3, out: 15 },
  haiku: { in: 1, out: 5 },
  fable: { in: 5, out: 25 },
};

/** Câmbio usado para converter o custo de tokens em reais. Atualize conforme o dólar. */
export const USD_BRL = 5.4;

export function precoModelo(modelo?: string | null): { in: number; out: number } {
  const m = (modelo ?? "").toLowerCase();
  if (m.includes("opus")) return PRECOS_CLAUDE_USD.opus;
  if (m.includes("haiku")) return PRECOS_CLAUDE_USD.haiku;
  if (m.includes("fable")) return PRECOS_CLAUDE_USD.fable;
  return PRECOS_CLAUDE_USD.sonnet; // padrão (sonnet)
}

/** Custo estimado em R$ a partir de tokens de entrada/saída e do modelo. */
export function custoBRL(
  modelo: string | null | undefined,
  tokensIn: number,
  tokensOut: number
): number {
  const p = precoModelo(modelo);
  const usd = (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
  return usd * USD_BRL;
}
