import { NextResponse, type NextRequest } from "next/server";

import { extractNF, isClaudeConfigured } from "@/lib/claude/client";
import { extractNFGemini, isGeminiConfigured } from "@/lib/ocr/gemini";
import {
  extractViaOpenAICompat,
  groqConfig,
  isGroqConfigured,
  isOpenRouterConfigured,
  openRouterConfig,
} from "@/lib/ocr/openai-compatible";
import { isOcrSpaceConfigured, ocrSpaceText } from "@/lib/ocr/ocrspace";
import { parseNFText } from "@/lib/utils/nf-text-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'file' ausente ou inválido." },
        { status: 400 }
      );
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo não suportado: ${file.type}` },
        { status: 415 }
      );
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo maior que 50MB." },
        { status: 413 }
      );
    }

    const isImage = file.type.startsWith("image/");
    const anyConfigured =
      isClaudeConfigured() ||
      isGeminiConfigured() ||
      isGroqConfigured() ||
      isOpenRouterConfigured() ||
      isOcrSpaceConfigured();

    // Nenhum provedor configurado → o cliente faz OCR local (Tesseract.js).
    if (!anyConfigured) {
      return NextResponse.json({ ocr: null, provider: "none" });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const erros: string[] = [];

    // Cascata por CUSTO: TODOS os provedores GRÁTIS primeiro; o Claude (pago)
    // só entra como ÚLTIMO recurso, quando todos os grátis falharam.
    // Helper: tenta um provedor, loga e devolve a resposta no formato certo
    // ({ocr} p/ LLM, {form} p/ OCR+parser); em erro, registra e segue.
    const tentar = async (
      nome: string,
      chave: "ocr" | "form",
      fn: () => Promise<unknown>
    ): Promise<NextResponse | null> => {
      try {
        const out = await fn();
        console.info(
          nome === "claude"
            ? "[nf/extract] usou Claude (fallback PAGO — todos os grátis falharam)"
            : `[nf/extract] leu via ${nome} (grátis)`
        );
        return NextResponse.json({ [chave]: out, provider: nome });
      } catch (e) {
        const msg = e instanceof Error ? e.message : nome;
        console.warn(`[nf/extract] ${nome} falhou, tentando próximo:`, msg);
        erros.push(`${nome}: ${msg}`);
        return null;
      }
    };

    // 1) Gemini (grátis — PDF e imagem)
    if (isGeminiConfigured()) {
      const r = await tentar("gemini", "ocr", () =>
        extractNFGemini(base64, file.type)
      );
      if (r) return r;
    }
    // 2) Groq (grátis — somente imagem)
    if (isImage && isGroqConfigured()) {
      const r = await tentar("groq", "ocr", () =>
        extractViaOpenAICompat(base64, file.type, groqConfig())
      );
      if (r) return r;
    }
    // 3) OpenRouter (modelos grátis — somente imagem)
    if (isImage && isOpenRouterConfigured()) {
      const r = await tentar("openrouter", "ocr", () =>
        extractViaOpenAICompat(base64, file.type, openRouterConfig())
      );
      if (r) return r;
    }
    // 4) OCR.space (grátis — PDF e imagem; texto + parser)
    if (isOcrSpaceConfigured()) {
      const r = await tentar("ocrspace", "form", async () =>
        parseNFText(await ocrSpaceText(base64, file.type))
      );
      if (r) return r;
    }
    // 5) Claude (PAGO — último recurso, só se todos os grátis falharam)
    if (isClaudeConfigured()) {
      const r = await tentar("claude", "ocr", () =>
        extractNF(base64, file.type)
      );
      if (r) return r;
    }

    // Todos os provedores configurados falharam.
    return NextResponse.json(
      { error: `Falha na extração: ${erros.join(" | ")}` },
      { status: 502 }
    );
  } catch (err) {
    console.error("[nf/extract]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha ao extrair dados da NF.",
      },
      { status: 500 }
    );
  }
}
