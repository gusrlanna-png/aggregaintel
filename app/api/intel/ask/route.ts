import { NextResponse, type NextRequest } from "next/server";

import { generateText, isAITextConfigured } from "@/lib/ai/text";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const pergunta: string = body?.pergunta?.trim();
  const contexto: string = body?.contexto ?? "";

  if (!pergunta) {
    return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
  }
  if (!contexto.trim()) {
    return NextResponse.json({
      resposta: "Ainda não há informações de inteligência para consultar.",
    });
  }

  if (!isAITextConfigured()) {
    // Fallback sem IA: busca por palavras-chave da pergunta no contexto.
    const termos = pergunta
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3);
    const linhas = contexto
      .split("\n")
      .filter((l) => termos.some((t) => l.toLowerCase().includes(t)))
      .slice(0, 10);
    return NextResponse.json({
      resposta:
        linhas.length > 0
          ? `IA não configurada — trechos relacionados:\n\n${linhas.join("\n")}`
          : "IA não configurada e nenhum trecho relacionado encontrado. Defina GEMINI_API_KEY (grátis) para respostas completas.",
      fallback: true,
    });
  }

  try {
    const prompt = `Você é um analista de inteligência de mercado do setor de agregados.
Responda à pergunta com base APENAS nas informações de inteligência abaixo.
Seja objetivo, em português. Se a resposta não estiver nas informações, diga que não há registro.

INFORMAÇÕES:
${contexto.slice(0, 16000)}

PERGUNTA: ${pergunta}`;
    const resposta = await generateText(prompt, { maxTokens: 1200 });
    return NextResponse.json({ resposta });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao consultar a IA." },
      { status: 500 }
    );
  }
}
