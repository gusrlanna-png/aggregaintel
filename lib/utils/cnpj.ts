/** Aplica a máscara 00.000.000/0000-00 progressivamente. */
export function mascararCnpj(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length >= 3) out += "." + d.slice(2, 5);
  if (d.length >= 6) out += "." + d.slice(5, 8);
  if (d.length >= 9) out += "/" + d.slice(8, 12);
  if (d.length >= 13) out += "-" + d.slice(12, 14);
  return out;
}

/** Só os dígitos do CNPJ. */
export const cnpjDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");

export interface SocioCnpj {
  nome: string | null;
  qualificacao: string | null;
  faixa_etaria: string | null;
  desde: string | null;
}
export interface CadastroCnpj {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  logradouro: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  fone: string | null;
  situacao: string | null;
  data_fundacao: string | null;
  atividade_principal: string | null;
  capital_social: number | null;
  natureza_juridica: string | null;
  matriz_filial: string | null;
  socios: SocioCnpj[];
}

/** Consulta cadastral (Receita Federal via fontes gratuitas, com cascata). */
export async function buscarCadastroCnpj(
  cnpj?: string | null
): Promise<CadastroCnpj> {
  const d = cnpjDigitos(cnpj);
  if (d.length !== 14) throw new Error("CNPJ inválido — informe 14 dígitos.");
  // No servidor (jobs em background) chamamos as fontes direto — URL relativa
  // não existe fora do navegador. No browser usamos /api/cnpj (evita CORS).
  if (typeof window === "undefined") {
    const { consultarCnpjServidor } = await import("@/lib/api/cnpj-fontes");
    return consultarCnpjServidor(d);
  }
  const res = await fetch(`/api/cnpj/${d}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "CNPJ não encontrado.");
  return json as CadastroCnpj;
}
