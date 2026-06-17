/**
 * OCR.space — OCR gratuito (free key), independente de cota de LLM.
 * Lê imagem e PDF, retorna o TEXTO bruto (o chamador estrutura com parseNFText).
 */
export const isOcrSpaceConfigured = (): boolean =>
  Boolean(process.env.OCRSPACE_API_KEY);

export async function ocrSpaceText(
  base64: string,
  mediaType: string
): Promise<string> {
  const apiKey = process.env.OCRSPACE_API_KEY;
  if (!apiKey) throw new Error("OCRSPACE_API_KEY não configurada.");

  const isPdf = mediaType === "application/pdf";
  const body = new URLSearchParams({
    apikey: apiKey,
    base64Image: `data:${mediaType};base64,${base64}`,
    language: "por",
    OCREngine: "1",
    isOverlayRequired: "false",
    scale: "true",
    detectOrientation: "true",
    filetype: isPdf ? "PDF" : "Auto",
  });

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OCR.space ${res.status}`);

  const data = await res.json();
  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join("; ")
      : data.ErrorMessage;
    throw new Error(`OCR.space: ${msg ?? "erro"}`);
  }
  const text: string = (data.ParsedResults ?? [])
    .map((r: { ParsedText?: string }) => r.ParsedText ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("OCR.space: texto vazio.");
  return text;
}
