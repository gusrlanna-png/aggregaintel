import "server-only";

/**
 * Cascata de IA gratuita para o chat dos agentes (custo zero):
 *   1) Gemini (free tier)      — GEMINI_API_KEY
 *   2) Qwen2.5 via Ollama (VPS) — local, grátis e privado
 *   3) heurística               — sempre responde algo, mesmo offline
 *
 * Cada provedor recebe um system prompt e devolve JSON (string). Quem decide
 * a ação é o chamador (rota /api/chat).
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
// Modelo leve para o chat (cabe na RAM junto do modelo de visão do OCR e
// responde rápido). Pode ser trocado por env.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

export interface RespostaLLM {
  raw: string;
  provedor: "gemini" | "groq" | "qwen" | "heuristica";
}

async function chamarGroq(system: string, user: string, json = true): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("sem GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: json ? 0.2 : 0.4,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  const txt = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!txt) throw new Error("groq vazio");
  return txt;
}

async function chamarGemini(system: string, user: string, json = true): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("sem GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        temperature: json ? 0.2 : 0.4,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const txt: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("\n")
      .trim() ?? "";
  if (!txt) throw new Error("gemini vazio");
  return txt;
}

async function chamarOllama(system: string, user: string, json = true): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000); // CPU + prompt grande pode demorar
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        ...(json ? { format: "json" } : {}),
        keep_alive: "30m", // mantém o modelo carregado p/ respostas rápidas
        options: { temperature: json ? 0.2 : 0.4 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = await res.json();
    const txt = data?.message?.content?.trim() ?? "";
    if (!txt) throw new Error("ollama vazio");
    return txt;
  } finally {
    clearTimeout(t);
  }
}

/** Tenta os provedores em cascata. Lança só se todos falharem. */
export async function conversarLLM(system: string, user: string): Promise<RespostaLLM> {
  try {
    return { raw: await chamarGemini(system, user), provedor: "gemini" };
  } catch {
    /* tenta Groq */
  }
  try {
    return { raw: await chamarGroq(system, user), provedor: "groq" };
  } catch {
    /* tenta Qwen local */
  }
  try {
    return { raw: await chamarOllama(system, user), provedor: "qwen" };
  } catch {
    /* cai na heurística */
  }
  throw new Error("Nenhum provedor de IA disponível.");
}

/** Resposta em TEXTO LIVRE (assistente conversacional), mesma cascata grátis. */
export async function responderLLM(system: string, user: string): Promise<RespostaLLM> {
  try {
    return { raw: await chamarGemini(system, user, false), provedor: "gemini" };
  } catch {
    /* tenta Groq */
  }
  try {
    return { raw: await chamarGroq(system, user, false), provedor: "groq" };
  } catch {
    /* tenta Qwen local */
  }
  try {
    return { raw: await chamarOllama(system, user, false), provedor: "qwen" };
  } catch {
    /* sem IA */
  }
  throw new Error("Nenhum provedor de IA disponível.");
}

export const PROVEDORES_INFO = {
  gemini: `Gemini (${GEMINI_MODEL})`,
  groq: `Groq (${GROQ_MODEL})`,
  qwen: `Qwen2.5 local (${OLLAMA_MODEL})`,
  heuristica: "Heurística (sem IA)",
};
