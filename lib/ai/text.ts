import {
  getAnthropic,
  isClaudeConfigured,
  CLAUDE_MODEL,
} from "@/lib/claude/client";
import { isGeminiConfigured, GEMINI_MODEL } from "@/lib/ocr/gemini";

/** Há algum motor de IA de texto disponível (Claude ou Gemini gratuito)? */
export const isAITextConfigured = (): boolean =>
  isClaudeConfigured() || isGeminiConfigured();

export interface GenOpts {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Geração de texto com cascata Claude → Gemini (free tier).
 * Lança erro se nenhum motor estiver configurado.
 */
export async function generateText(
  prompt: string,
  opts: GenOpts = {}
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 2000;

  if (isClaudeConfigured()) {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.2,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
  }

  if (isGeminiConfigured()) {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: maxTokens,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("\n")
        .trim() ?? ""
    );
  }

  throw new Error("Nenhum motor de IA configurado (defina GEMINI_API_KEY).");
}

export function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = Math.min(
      ...["[", "{"].map((c) => {
        const i = cleaned.indexOf(c);
        return i < 0 ? Number.MAX_SAFE_INTEGER : i;
      })
    );
    const e = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (s < Number.MAX_SAFE_INTEGER && e > s) {
      try {
        return JSON.parse(cleaned.slice(s, e + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
