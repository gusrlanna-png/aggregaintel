import { PROMPT_OCR, type OCRResult } from "@/lib/claude/client";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "";

/**
 * OCR de NF via modelo de visão local (Ollama na VPS — ex.: qwen2.5vl).
 * 100% gratuito e privado. Habilita-se definindo OLLAMA_VISION_MODEL no .env.
 * Suporta apenas IMAGEM (não PDF). Usa o mesmo PROMPT_OCR dos demais provedores.
 */
export const isOllamaVisionConfigured = (): boolean =>
  Boolean(OLLAMA_VISION_MODEL);

export async function extractNFOllamaVision(
  base64: string
): Promise<OCRResult> {
  if (!OLLAMA_VISION_MODEL) throw new Error("OLLAMA_VISION_MODEL não definido.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 110_000); // CPU é lento; folga
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [{ role: "user", content: PROMPT_OCR, images: [base64] }],
      }),
    });
    if (!res.ok) throw new Error(`ollama-vision ${res.status}`);
    const data = await res.json();
    const txt: string = data?.message?.content?.trim() ?? "";
    if (!txt) throw new Error("ollama-vision retornou vazio");
    return parseJsonLoose(txt) as OCRResult;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("Resposta do Ollama não é JSON válido.");
  }
}
