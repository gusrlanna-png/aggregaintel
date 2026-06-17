import { NextResponse, type NextRequest } from "next/server";

import { generateText, isAITextConfigured, parseJsonLoose } from "@/lib/ai/text";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IntelItem {
  classificacao: string;
  confianca: string;
  texto_extraido: string;
  valor_num: number | null;
  unidade: string | null;
  tags: string[];
  data_info: string | null;
  cliente_nome?: string | null;
}

interface Sintese {
  cliente_nome: string;
  resumo: string;
  pontos: string[];
}

const KEYWORDS = [
  "preç","preco","r$","/t","tonelada","ton","m³","m3","brita","areia","pedra",
  "pó de pedra","bica","frete","carrad","carga","concorr","cliente","usina",
  "concreto","asfalto","pedreira","volume","produç",
];

const LINE_RE =
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[,]?\s+\d{1,2}:\d{2}(?::\d{2})?\s*\]?\s*-?\s*([^:]{1,40}?):\s*(.*)$/;

function brToIso(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function classify(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("r$") || t.includes("preç") || t.includes("preco")) return "preco";
  if (t.includes("frete") || t.includes("carrad")) return "preco";
  if (t.includes("volume") || t.includes("produç") || t.includes("tonelada")) return "volume";
  if (t.includes("concorr") || t.includes("pedreira")) return "concorrente";
  if (t.includes("cliente") || t.includes("usina") || t.includes("concreto")) return "cliente";
  return "outro";
}

function extractValor(text: string): { valor: number | null; unidade: string | null } {
  const m = text.match(/r\$\s*([\d.]+,\d{2}|\d+[.,]?\d*)/i);
  if (m) {
    const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(num)) {
      const unidade = /\/\s*t|tonelada|ton\b/i.test(text)
        ? "R$/t"
        : /m³|m3/i.test(text)
          ? "R$/m³"
          : "R$";
      return { valor: num, unidade };
    }
  }
  return { valor: null, unidade: null };
}

function heuristicParse(conteudo: string): { total: number; items: IntelItem[] } {
  const linhas = conteudo.split(/\r?\n/);
  let total = 0;
  const items: IntelItem[] = [];
  for (const linha of linhas) {
    const m = linha.match(LINE_RE);
    let texto = linha.trim();
    let data: string | null = null;
    if (m) {
      total += 1;
      texto = m[3].trim();
      data = brToIso(m[1]);
    } else if (!texto) continue;
    if (texto.length < 4) continue;
    const lower = texto.toLowerCase();
    if (!KEYWORDS.some((k) => lower.includes(k))) continue;
    const { valor, unidade } = extractValor(texto);
    items.push({
      classificacao: classify(texto),
      confianca: "baixa",
      texto_extraido: texto.slice(0, 500),
      valor_num: valor,
      unidade,
      tags: ["whatsapp"],
      data_info: data,
      cliente_nome: null,
    });
  }
  return { total: total || linhas.length, items };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const conteudo: string = body?.conteudo ?? "";
  if (!conteudo.trim()) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  const totalLinhas = conteudo.split(/\r?\n/).length;

  if (!isAITextConfigured()) {
    const { items } = heuristicParse(conteudo);
    return NextResponse.json({
      total: totalLinhas,
      relevantes: items.length,
      items,
      sinteses: [],
      metodo: "heuristica",
      aviso:
        "Síntese por cliente requer IA. Defina GEMINI_API_KEY (grátis) para gerar resumos automáticos.",
    });
  }

  try {
    const trecho = conteudo.slice(0, 16000);
    const prompt = `Você é analista de inteligência de mercado do setor de agregados (brita, areia, pó de pedra).
Analise a conversa de WhatsApp abaixo e responda SOMENTE com JSON no formato:
{
  "items": [{"classificacao":"preco|volume|concorrente|cliente|alerta|outro","confianca":"alta|media|baixa","texto_extraido":"...","valor_num":number|null,"unidade":"R$/t|R$/m³|t|null","tags":["..."],"data_info":"AAAA-MM-DD|null","cliente_nome":"empresa citada ou null"}],
  "sinteses": [{"cliente_nome":"nome do cliente/empresa","resumo":"síntese objetiva do que foi falado sobre este cliente","pontos":["preço X","volume Y","..."]}]
}
Regras: 'items' = apenas mensagens relevantes. 'sinteses' = um resumo POR CLIENTE/EMPRESA citado (agrupe tudo de cada um). Se não houver cliente claro, use "Geral".

CONVERSA:
${trecho}`;

    const text = await generateText(prompt, { json: true, maxTokens: 3500 });
    const parsed = parseJsonLoose(text) as {
      items?: IntelItem[];
      sinteses?: Sintese[];
    } | null;

    const items = Array.isArray(parsed?.items) ? parsed!.items : [];
    const sinteses = Array.isArray(parsed?.sinteses) ? parsed!.sinteses : [];

    if (items.length === 0 && sinteses.length === 0) {
      const h = heuristicParse(conteudo);
      return NextResponse.json({
        total: totalLinhas,
        relevantes: h.items.length,
        items: h.items,
        sinteses: [],
        metodo: "heuristica",
      });
    }

    return NextResponse.json({
      total: totalLinhas,
      relevantes: items.length,
      items,
      sinteses,
      metodo: "ia",
    });
  } catch {
    const { items } = heuristicParse(conteudo);
    return NextResponse.json({
      total: totalLinhas,
      relevantes: items.length,
      items,
      sinteses: [],
      metodo: "heuristica",
    });
  }
}
