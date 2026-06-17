/**
 * Sazonalidade mensal (fração do volume anual em cada mês). Soma ≈ 1,0.
 * Pode variar por ANO e por SEGMENTO de cliente. Padrão abaixo.
 */
import {
  localList,
  localUpsert,
  type LocalTable,
} from "@/lib/local/store";

export const SAZONALIDADE_PADRAO: number[] = [
  0.0703, // jan
  0.0725, // fev
  0.0806, // mar
  0.0786, // abr
  0.0842, // mai
  0.0895, // jun
  0.097, // jul
  0.0987, // ago
  0.0939, // set
  0.0929, // out
  0.0772, // nov
  0.0646, // dez
];

export const MESES_LABEL = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export interface SazonalidadeRow {
  id: string; // `${ano}:${segmento}`
  ano: number;
  segmento: string; // "geral" | concreto | asfalto | premoldado | varejo | outro
  pesos: number[]; // 12 valores
}

const TABELA: LocalTable = "sazonalidade";

export function getSazonalidade(ano: number, segmento = "geral"): number[] {
  const rows = localList<SazonalidadeRow>(TABELA);
  const exata = rows.find((r) => r.ano === ano && r.segmento === segmento);
  if (exata) return exata.pesos;
  const geralAno = rows.find((r) => r.ano === ano && r.segmento === "geral");
  if (geralAno) return geralAno.pesos;
  return SAZONALIDADE_PADRAO;
}

export function setSazonalidade(
  ano: number,
  segmento: string,
  pesos: number[]
): SazonalidadeRow {
  return localUpsert<SazonalidadeRow>(TABELA, {
    id: `${ano}:${segmento}`,
    ano,
    segmento,
    pesos,
  });
}

export function listSazonalidade(): SazonalidadeRow[] {
  return localList<SazonalidadeRow>(TABELA);
}

/** Normaliza um conjunto de pesos para somar 1 (para distribuição). */
export function normalizar(pesos: number[]): number[] {
  const soma = pesos.reduce((s, v) => s + (v || 0), 0);
  if (soma <= 0) return SAZONALIDADE_PADRAO;
  return pesos.map((p) => (p || 0) / soma);
}
