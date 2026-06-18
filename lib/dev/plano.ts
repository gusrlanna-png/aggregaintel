import "server-only";

import { getAnthropic, isClaudeConfigured, CLAUDE_MODEL } from "@/lib/claude/client";
import { conversarLLM } from "@/lib/ai/chat-llm";

/** Resumo da arquitetura, para fundamentar a análise crítica da IA. */
const PROJETO_CONTEXTO = `AggregaIntel — PWA de inteligência de mercado de agregados (mineração/brita/areia).
Stack: Next.js 14 (App Router, SSR + API routes), TypeScript, Supabase (Postgres + Auth + Storage, RLS por 'authenticated'), Tailwind + shadcn/ui, React Query, next-pwa. Deploy: VPS (systemd + nginx), 'next start'. Login via e-mail/senha e Microsoft (Entra/Graph).
Módulos: Produtores (emissores) com produção/projeção por NF; Clientes; Pessoas/Contatos (telefones/e-mails/endereços múltiplos, redes); NFs com OCR em cascata grátis (Gemini → Qwen2.5-VL local no Ollama → Claude pago); Inteligência de mercado (import WhatsApp/doc + IA); Visitas de campo; CFEM/ANM; Dashboard/market share.
Agentes em background (fila 'jobs', runner in-process com token do usuário): person_analysis (enriquecimento web), cascade_update (cadastro+sócios via Receita: BrasilAPI→minhareceita→ReceitaWS). Painel de agentes com log de ações e aprendizado. Chat dos agentes com cascata de IA grátis (Gemini→Qwen local→heurística).
Tabelas principais: emissores, clientes, pessoas (+telefones/emails/enderecos/links/sociedades), notas_fiscais, visitas, jobs, agentes, job_eventos, agente_aprendizados, dev_tasks, vendas_meta, projecao_base, cfem_*.`;

export interface PlanoDev {
  titulo: string;
  plano: string;
  provedor: string;
}

function instrucao(pedido: string, contextoPagina?: string): string {
  return `Você é um engenheiro de software sênior revisando o projeto abaixo.
${PROJETO_CONTEXTO}
${contextoPagina ? `\nContexto da página onde o pedido foi feito: ${contextoPagina}` : ""}

PEDIDO DO USUÁRIO: "${pedido}"

Produza, em português e em Markdown, um documento com EXATAMENTE estas seções:
## Título
(uma linha curta resumindo a demanda)
## Análise crítica
(estado atual relacionado ao pedido; pontos fracos, riscos e o que pode ser feito de forma melhor)
## Plano de implementação
(passos objetivos e ordenados)
## Impactos e correções no sistema
(o que mais é afetado: tabelas, telas, RLS, migrations, integrações; correções necessárias para não quebrar nada)
## Esforço e riscos
(estimativa de tamanho: pequeno/médio/grande; principais riscos)

Seja específico ao projeto descrito. Não escreva código — apenas a análise e o plano.`;
}

function extrairTitulo(md: string, pedido: string): string {
  const m = md.match(/##\s*T[ií]tulo\s*\n+([^\n]+)/i);
  return (m?.[1] ?? pedido).trim().slice(0, 120);
}

/** Gera análise crítica + plano. Usa Claude (melhor p/ código); cai p/ Gemini/Qwen. */
export async function gerarPlanoDev(
  pedido: string,
  contextoPagina?: string
): Promise<PlanoDev> {
  const prompt = instrucao(pedido, contextoPagina);

  if (isClaudeConfigured()) {
    try {
      const client = getAnthropic();
      const msg = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      const texto = (msg.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim();
      if (texto) return { titulo: extrairTitulo(texto, pedido), plano: texto, provedor: "claude" };
    } catch {
      /* cai para a cascata grátis */
    }
  }

  const r = await conversarLLM(
    "Você é um engenheiro de software sênior. Responda só o documento em Markdown pedido.",
    prompt
  );
  return { titulo: extrairTitulo(r.raw, pedido), plano: r.raw, provedor: r.provedor };
}
