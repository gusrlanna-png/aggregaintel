import { cnpjDigitos } from "./cnpj";

/**
 * Agrupamento padrão de empresas do sistema: concatena empresas repetidas
 * (mesma raiz de CNPJ — 8 dígitos — ou mesma razão social normalizada), elege
 * a MATRIZ (CNPJ terminando em /0001, senão a 1ª alfabética) como representante
 * e mantém as demais unidades (filiais) recolhidas. Grupos em ordem alfabética.
 *
 * Reutilizável em qualquer página que liste empresas (produtores, sociedades de
 * uma pessoa, clientes do mesmo grupo, etc.).
 */
export interface GrupoEmpresas<T> {
  chave: string;
  matriz: T;
  unidades: T[]; // todas as unidades do grupo (inclui a matriz), ordenadas
}

function normalizarNome(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ehMatriz = (cnpj: string | null | undefined): boolean =>
  cnpjDigitos(cnpj).slice(8, 12) === "0001";

export function agruparEmpresas<T>(
  itens: T[],
  getCnpj: (t: T) => string | null | undefined,
  getNome: (t: T) => string
): GrupoEmpresas<T>[] {
  const grupos = new Map<string, T[]>();
  for (const it of itens) {
    const d = cnpjDigitos(getCnpj(it));
    const chave =
      d.length >= 8 ? `cnpj:${d.slice(0, 8)}` : `nome:${normalizarNome(getNome(it))}`;
    const arr = grupos.get(chave);
    if (arr) arr.push(it);
    else grupos.set(chave, [it]);
  }

  const out: GrupoEmpresas<T>[] = [];
  for (const [chave, unidades] of grupos) {
    const sorted = [...unidades].sort((a, b) => {
      const ma = ehMatriz(getCnpj(a)) ? 0 : 1;
      const mb = ehMatriz(getCnpj(b)) ? 0 : 1;
      if (ma !== mb) return ma - mb;
      return getNome(a).localeCompare(getNome(b), "pt-BR");
    });
    out.push({ chave, matriz: sorted[0], unidades: sorted });
  }
  out.sort((a, b) =>
    getNome(a.matriz).localeCompare(getNome(b.matriz), "pt-BR")
  );
  return out;
}
