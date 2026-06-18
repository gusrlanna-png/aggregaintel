import "server-only";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/**
 * Investigação web GRATUITA (Gemini com Google Search) para conseguir ao menos
 * dados PARCIAIS quando as fontes oficiais (Receita) falham. O resultado é
 * tratado como NÃO VERIFICADO — registrado como lead/aprendizado, nunca gravado
 * direto no cadastro (evita dado falso/alucinação).
 */
export async function investigarEmpresaWeb(
  nome: string,
  cnpj?: string | null
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const prompt = `Pesquise na web informações PÚBLICAS sobre a empresa "${nome}"${
    cnpj ? ` (CNPJ ${cnpj})` : ""
  }: situação cadastral, endereço/município/UF, sócios ou administradores, atividade/CNAE e sites/redes.
Responda objetivo em português, em tópicos curtos. Deixe claro que são dados públicos NÃO verificados. Se não encontrar, responda apenas "sem informações".`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const data = await res.json();
    const txt: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("\n")
        .trim() ?? "";
    if (!txt || /^sem informa/i.test(txt)) return null;
    return txt;
  } catch {
    return null;
  }
}
