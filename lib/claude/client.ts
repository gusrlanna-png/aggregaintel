import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Defina no .env.local para habilitar o OCR."
    );
  }
  return new Anthropic({ apiKey });
}

export const isClaudeConfigured = (): boolean =>
  Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Prompt EXATO de extração de NF (Seção 4 — Módulo 1 do documento).
 */
export const PROMPT_OCR = `
Você é um sistema especializado em extração de dados de Notas Fiscais Eletrônicas (NF-e/DANFE) brasileiras.
Analise a imagem e extraia TODOS os dados disponíveis no formato JSON abaixo.
Se um campo não estiver legível ou presente, use null.
Retorne APENAS o JSON, sem texto adicional.

REGRAS IMPORTANTES:
- "nf.numero": número da NF (campo "Nº"/"NÚMERO"). Inclua exatamente como impresso.
- "nf.hora_saida": a HORA DA SAÍDA/ENTRADA da mercadoria (fica ao lado de "DATA DA SAÍDA/ENTRADA"). NÃO use a hora de emissão — são campos diferentes; se houver as duas, priorize a de saída.
- "produto.quantidade_ton": quantidade em TONELADAS (se vier em kg, converta dividindo por 1000).
- Valores numéricos no formato brasileiro (1.234,56) devem ser retornados como número (1234.56).
- Datas (data_emissao etc.): retorne no formato AAAA-MM-DD.

{
  "emissor": {
    "razao_social": null,
    "cnpj": null,
    "inscricao_estadual": null,
    "logradouro": null,
    "municipio": null,
    "uf": null,
    "cep": null,
    "fone": null
  },
  "destinatario": {
    "nome": null,
    "cnpj_cpf": null,
    "logradouro": null,
    "bairro": null,
    "municipio": null,
    "uf": null,
    "cep": null
  },
  "nf": {
    "numero": null,
    "serie": null,
    "chave_acesso": null,
    "data_emissao": null,
    "hora_saida": null,
    "protocolo_sefaz": null,
    "cfop": null,
    "natureza_operacao": null
  },
  "produto": {
    "descricao": null,
    "ncm": null,
    "codigo": null,
    "quantidade_ton": null,
    "valor_unitario": null,
    "valor_total": null,
    "desconto": null
  },
  "impostos": {
    "icms_base": null,
    "icms_valor": null,
    "icms_aliquota": null,
    "icms_isento": null,
    "icms_fundamento": null,
    "ipi_valor": null,
    "pis_valor": null,
    "cofins_valor": null
  },
  "transporte": {
    "frete_por_conta": null,
    "frete_valor": null,
    "transportador_nome": null,
    "placa_veiculo": null,
    "uf_veiculo": null,
    "peso_bruto_ton": null,
    "peso_liquido_ton": null,
    "especie_carga": null
  },
  "dados_adicionais": null,
  "motorista_cpf": null,
  "pedido_ref": null,
  "confianca_ocr": 0.95
}
`;

export interface OCRResult {
  emissor: Record<string, string | null>;
  destinatario: Record<string, string | null>;
  nf: Record<string, string | null>;
  produto: Record<string, string | number | null>;
  impostos: Record<string, string | number | boolean | null>;
  transporte: Record<string, string | number | null>;
  dados_adicionais: string | null;
  motorista_cpf: string | null;
  pedido_ref: string | null;
  confianca_ocr: number;
}

/**
 * Envia a imagem/PDF (base64) ao Claude Vision e retorna o JSON estruturado.
 */
export async function extractNF(
  base64: string,
  mediaType: string
): Promise<OCRResult> {
  const client = getAnthropic();

  const isPdf = mediaType === "application/pdf";
  const content: Anthropic.MessageParam["content"] = [
    isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",
            data: base64,
          },
        },
    { type: "text", text: PROMPT_OCR },
  ];

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

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
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Resposta do Claude não é um JSON válido.");
  }
}
