/**
 * Máscaras padrão do sistema (pt-BR).
 * Regras: CNPJ xx.xxx.xxx/xxxx-xx · CPF xxx.xxx.xxx-xx ·
 * dinheiro "R$ x.xxx,xx" · número "x.xxx,xx" (ponto = milhar, vírgula = decimal).
 * Os componentes de input em components/ui/masked-input.tsx usam estas funções.
 */

import { mascararCnpj } from "./cnpj";

/** Mantém apenas dígitos. */
export const onlyDigits = (v: string | null | undefined): string =>
  (v ?? "").replace(/\D/g, "");

/** Aplica a máscara de CNPJ (xx.xxx.xxx/xxxx-xx). Reusa o util canônico. */
export const maskCNPJ = (v: string | null | undefined): string =>
  mascararCnpj(v ?? "");

/** Aplica a máscara de CPF progressivamente sobre dígitos (até 11). */
export function maskCPF(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 11);
  let out = "";
  for (let i = 0; i < d.length; i++) {
    if (i === 3 || i === 6) out += ".";
    else if (i === 9) out += "-";
    out += d[i];
  }
  return out;
}

/** CPF (<=11 dígitos) ou CNPJ (>11) conforme a quantidade digitada. */
export function maskCpfCnpj(v: string | null | undefined): string {
  return onlyDigits(v).length <= 11 ? maskCPF(v) : maskCNPJ(v);
}

/** Valida um CNPJ (dígitos verificadores). Aceita string com ou sem máscara. */
export function isValidCNPJ(v: string | null | undefined): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // todos iguais
  const calc = (base: string): number => {
    let soma = 0;
    let pos = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

/** Formata um número em pt-BR (ponto milhar, vírgula decimal), sem símbolo. */
export function formatNumberBR(
  n: number,
  minDecimals = 2,
  maxDecimals = 2
): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Máscara de dinheiro estilo "calculadora": os dígitos digitados preenchem
 * da direita (centavos). Ex.: "123456" -> { display: "R$ 1.234,56", value: "1234.56" }.
 * `value` sai como string com ponto decimal (compatível com Number()).
 */
export function maskMoney(raw: string | null | undefined): {
  display: string;
  value: string;
} {
  const d = onlyDigits(raw);
  if (!d) return { display: "", value: "" };
  const cents = Number(d);
  const reais = cents / 100;
  return { display: `R$ ${formatNumberBR(reais, 2, 2)}`, value: reais.toFixed(2) };
}

/** Converte um value (string com ponto decimal, ex.: "1234.56") para exibição "R$ 1.234,56". */
export function moneyDisplay(value: string | null | undefined): string {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return "";
  return `R$ ${formatNumberBR(n, 2, 2)}`;
}

/**
 * Normaliza um número digitado em pt-BR ("1.234,56" ou "1234,56" ou "1234.56")
 * para string com ponto decimal ("1234.56"). Vazio -> "".
 */
export function parseNumberBR(raw: string | null | undefined): string {
  if (raw == null) return "";
  let t = String(raw).trim();
  if (!t) return "";
  // remove tudo que não for dígito, vírgula, ponto ou sinal
  t = t.replace(/[^\d.,-]/g, "");
  if (t.includes(",")) {
    // vírgula é decimal: pontos são separadores de milhar
    t = t.replace(/\./g, "").replace(",", ".");
  }
  // se só tem pontos, mantém como decimal (ex.: "1234.56")
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : "";
}

/** Exibe um number/string como "x.xxx,xx" (decimais flexíveis até maxDecimals). */
export function numberDisplay(
  value: string | number | null | undefined,
  maxDecimals = 3
): string {
  if (value === "" || value == null) return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return formatNumberBR(n, 0, maxDecimals);
}
