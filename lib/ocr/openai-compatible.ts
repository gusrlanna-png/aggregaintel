import { PROMPT_OCR, type OCRResult } from "@/lib/claude/client";

/**
 * Extração de NF via qualquer API compatível com OpenAI (Groq, OpenRouter,
 * Together, etc.) usando visão. Aceita IMAGENS (data URI base64).
 */
export interface OpenAICompatConfig {
  apiKey: string;
  baseUrl: string; // ex.: https://api.groq.com/openai/v1
  model: string;
  label: string;
  extraHeaders?: Record<string, string>;
}

export async function extractViaOpenAICompat(
  base64: string,
  mediaType: string,
  cfg: OpenAICompatConfig
): Promise<OCRResult> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(cfg.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT_OCR },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${cfg.label} ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return parseJsonLoose(text) as OCRResult;
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error(`Resposta de ${cleaned.slice(0, 40)} não é JSON válido.`);
  }
}

// ── Configurações por provedor (a partir das envs) ──────────────────────
export const isGroqConfigured = () => Boolean(process.env.GROQ_API_KEY);
export const groqConfig = (): OpenAICompatConfig => ({
  apiKey: process.env.GROQ_API_KEY ?? "",
  baseUrl: "https://api.groq.com/openai/v1",
  model:
    process.env.GROQ_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct",
  label: "Groq",
});

export const isOpenRouterConfigured = () =>
  Boolean(process.env.OPENROUTER_API_KEY);
export const openRouterConfig = (): OpenAICompatConfig => ({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseUrl: "https://openrouter.ai/api/v1",
  model:
    process.env.OPENROUTER_MODEL ??
    "meta-llama/llama-3.2-11b-vision-instruct:free",
  label: "OpenRouter",
  extraHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "AggregaIntel",
  },
});
