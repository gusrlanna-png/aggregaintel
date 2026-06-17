/**
 * Constantes de domínio do AggregaIntel.
 * Tipos de agregados, segmentos de clientes, traços padrão e caminhões.
 */

export const MBV = {
  cnpj: process.env.NEXT_PUBLIC_MBV_CNPJ ?? "03.334.595/0001-00",
  razao: process.env.NEXT_PUBLIC_MBV_RAZAO ?? "MBV Mineração Bela Vista Ltda",
} as const;

export const COR_PRIMARIA = "#0F6E56";

/**
 * Indica se um emissor é "nossa empresa" (MBV). Usa o flag eh_mbv (definível
 * por toggle no cadastro) e, por compatibilidade, o CNPJ da MBV configurado.
 */
const soDigitosCnpj = (s?: string | null) => (s ?? "").replace(/\D/g, "");

export function isMbvEmissor(e: {
  eh_mbv?: boolean | null;
  cnpj?: string | null;
}): boolean {
  if (e.eh_mbv) return true;
  const d = soDigitosCnpj(e.cnpj);
  return Boolean(d && d === soDigitosCnpj(MBV.cnpj));
}

// ── Tipos de produto (agregados) ───────────────────────────────────────
export type ProdutoTipo =
  | "b0"
  | "b1"
  | "b2"
  | "bg"
  | "ai"
  | "aq"
  | "pp"
  | "outro";

export const PRODUTOS: Record<ProdutoTipo, { label: string; precoMedio: number }> = {
  b0: { label: "Brita 0 (Pedrisco)", precoMedio: 60 },
  b1: { label: "Brita 1", precoMedio: 55 },
  b2: { label: "Brita 2", precoMedio: 55 },
  bg: { label: "Brita Graduada", precoMedio: 50 },
  ai: { label: "Areia Industrial", precoMedio: 45 },
  aq: { label: "Areia Quartzosa", precoMedio: 70 },
  pp: { label: "Pó de Pedra", precoMedio: 35 },
  outro: { label: "Outro", precoMedio: 50 },
};

export const PRODUTO_TIPOS = Object.keys(PRODUTOS) as ProdutoTipo[];

export function labelProduto(tipo?: string | null): string {
  if (!tipo) return "—";
  return PRODUTOS[tipo as ProdutoTipo]?.label ?? tipo;
}

export function precoMedio(tipo: string): number {
  return PRODUTOS[tipo as ProdutoTipo]?.precoMedio ?? 50;
}

// ── Segmentos de clientes ──────────────────────────────────────────────
export type Segmento = "concreto" | "asfalto" | "premoldado" | "varejo" | "outro";

export const SEGMENTOS: Record<
  Segmento,
  { label: string; cor: string; corClasse: string }
> = {
  concreto: { label: "Concreto", cor: "#2563eb", corClasse: "bg-blue-100 text-blue-800 border-blue-200" },
  asfalto: { label: "Asfalto", cor: "#d97706", corClasse: "bg-amber-100 text-amber-800 border-amber-200" },
  premoldado: { label: "Pré-moldado", cor: "#7c3aed", corClasse: "bg-purple-100 text-purple-800 border-purple-200" },
  varejo: { label: "Varejo", cor: "#16a34a", corClasse: "bg-green-100 text-green-800 border-green-200" },
  outro: { label: "Outro", cor: "#6b7280", corClasse: "bg-gray-100 text-gray-800 border-gray-200" },
};

// ── Caminhões (varejo) ─────────────────────────────────────────────────
export type CaminhaoTipo = "toco" | "truck" | "carreta" | "bitrem" | "custom";

export const CAMINHOES: Record<CaminhaoTipo, { label: string; pesoT: number }> = {
  toco: { label: "Toco (6t)", pesoT: 6 },
  truck: { label: "Truck (14t)", pesoT: 14 },
  carreta: { label: "Carreta (28t)", pesoT: 28 },
  bitrem: { label: "Bitrem (45t)", pesoT: 45 },
  custom: { label: "Personalizado", pesoT: 0 },
};

// ── Traços padrão de pré-moldados (kg por unidade) ─────────────────────
export type SubtipoPremoldado =
  | "bloco"
  | "paver"
  | "manilha"
  | "chapeu"
  | "laje"
  | "outro";

export interface TracoPremoldado {
  label: string;
  pesoKg: number;
  traco: { b0: number; ai: number; pp: number };
}

export const TRACOS_PREMOLDADO: Record<SubtipoPremoldado, TracoPremoldado> = {
  bloco: { label: "Bloco", pesoKg: 1.2, traco: { b0: 0.35, ai: 0.5, pp: 0.15 } },
  paver: { label: "Paver", pesoKg: 3.5, traco: { b0: 0.8, ai: 1.5, pp: 0.6 } },
  manilha: { label: "Manilha", pesoKg: 18, traco: { b0: 4.0, ai: 6.0, pp: 2.0 } },
  chapeu: { label: "Chapéu / Mourão", pesoKg: 5, traco: { b0: 1.2, ai: 2.0, pp: 0.8 } },
  laje: { label: "Laje", pesoKg: 25, traco: { b0: 6.0, ai: 8.0, pp: 1.5 } },
  outro: { label: "Outro", pesoKg: 1, traco: { b0: 0, ai: 0, pp: 0 } },
};

// ── Faixas de sliders de traço por segmento (kg por unidade de produção) ─
export const FAIXAS_CONCRETO = {
  // por m³ de concreto
  b1: { min: 0, max: 900, step: 5 },
  b2: { min: 0, max: 400, step: 5 },
  ai: { min: 0, max: 1200, step: 5 },
  aq: { min: 0, max: 400, step: 5 },
  pp: { min: 0, max: 300, step: 5 },
} as const;

export const FAIXAS_ASFALTO = {
  // por tonelada de massa asfáltica
  bg: { min: 0, max: 600, step: 5 },
  ai_pp: { min: 0, max: 800, step: 5 },
  filer: { min: 0, max: 100, step: 1 },
  cap: { min: 0, max: 80, step: 1 }, // apenas informativo — não soma agregados
} as const;

// ── Formatação ──────────────────────────────────────────────────────────
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtNum1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function fmtTon(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${fmtNum.format(v)} t`;
}

export function fmtToneladas1(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return fmtNum1.format(v);
}

export function fmtReais(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return fmtBRL.format(v);
}

const fmtBRL3 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

/** Para valores pequenos como R$/t/km (mantém casas decimais). */
export function fmtReaisDec(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return fmtBRL3.format(v);
}

export function fmtPct(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${fmtNum1.format(v)}%`;
}

export function fmtNumero(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return fmtNum.format(v);
}
