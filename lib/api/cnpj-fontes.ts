/**
 * Consulta cadastral de CNPJ com CASCATA de fontes GRATUITAS (custo zero).
 * Usado no servidor (rota /api/cnpj e jobs em background). Tenta uma fonte;
 * se falhar, tenta a próxima — para conseguir a informação mesmo que parcial.
 *
 * Fontes (todas gratuitas, sem chave):
 *  1) BrasilAPI        https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 *  2) minhareceita.org https://minhareceita.org/{cnpj}   (mesma base da Receita)
 *  3) ReceitaWS        https://receitaws.com.br/v1/cnpj/{cnpj} (limite 3/min)
 */
import type { CadastroCnpj, SocioCnpj } from "@/lib/utils/cnpj";

const fmtCnpj = (d: string) =>
  d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : d;

/** Mapeia o formato "open data da Receita" (BrasilAPI e minhareceita.org). */
function mapOpenData(d: Record<string, unknown>, digits: string): CadastroCnpj {
  const g = (k: string) => d[k] as string | number | null | undefined;
  const logradouro = [g("descricao_tipo_de_logradouro"), g("logradouro"), g("numero")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const qsa = Array.isArray(d.qsa) ? (d.qsa as Record<string, unknown>[]) : [];
  const socios: SocioCnpj[] = qsa.map((s) => ({
    nome: (s.nome_socio as string) ?? (s.nome as string) ?? null,
    qualificacao: (s.qualificacao_socio as string) ?? null,
    faixa_etaria: (s.faixa_etaria as string) ?? null,
    desde: (s.data_entrada_sociedade as string) ?? null,
  }));
  return {
    razao_social: (g("razao_social") as string) ?? (g("nome_fantasia") as string) ?? null,
    nome_fantasia: (g("nome_fantasia") as string) ?? null,
    cnpj: fmtCnpj(digits),
    logradouro: logradouro || null,
    bairro: (g("bairro") as string) ?? null,
    municipio: (g("municipio") as string) ?? null,
    uf: (g("uf") as string) ?? null,
    cep: g("cep") ? String(g("cep")).replace(/(\d{5})(\d{3})/, "$1-$2") : null,
    fone: (g("ddd_telefone_1") as string) ?? null,
    situacao: (g("descricao_situacao_cadastral") as string) ?? null,
    data_fundacao: (g("data_inicio_atividade") as string) ?? null,
    atividade_principal: g("cnae_fiscal_descricao")
      ? `${g("cnae_fiscal") ?? ""} ${g("cnae_fiscal_descricao")}`.trim()
      : null,
    capital_social: g("capital_social") != null ? Number(g("capital_social")) : null,
    natureza_juridica: (g("natureza_juridica") as string) ?? null,
    matriz_filial:
      d.identificador_matriz_filial === 1
        ? "matriz"
        : d.identificador_matriz_filial === 2
          ? "filial"
          : null,
    socios,
  };
}

/** Mapeia o formato da ReceitaWS (nomes de campos diferentes). */
function mapReceitaWs(d: Record<string, unknown>, digits: string): CadastroCnpj {
  const ap = Array.isArray(d.atividade_principal)
    ? (d.atividade_principal[0] as Record<string, string> | undefined)
    : undefined;
  const qsa = Array.isArray(d.qsa) ? (d.qsa as Record<string, unknown>[]) : [];
  return {
    razao_social: (d.nome as string) ?? null,
    nome_fantasia: (d.fantasia as string) ?? null,
    cnpj: fmtCnpj(digits),
    logradouro: [d.logradouro, d.numero].filter(Boolean).join(", ") || null,
    bairro: (d.bairro as string) ?? null,
    municipio: (d.municipio as string) ?? null,
    uf: (d.uf as string) ?? null,
    cep: (d.cep as string) ?? null,
    fone: (d.telefone as string) ?? null,
    situacao: (d.situacao as string) ?? null,
    data_fundacao: (d.abertura as string) ?? null,
    atividade_principal: ap ? `${ap.code ?? ""} ${ap.text ?? ""}`.trim() : null,
    capital_social:
      d.capital_social != null ? Number(String(d.capital_social).replace(/[^\d.]/g, "")) || null : null,
    natureza_juridica: (d.natureza_juridica as string) ?? null,
    matriz_filial: typeof d.tipo === "string" ? d.tipo.toLowerCase() : null,
    socios: qsa.map((s) => ({
      nome: (s.nome as string) ?? null,
      qualificacao: (s.qual as string) ?? null,
      faixa_etaria: null,
      desde: null,
    })),
  };
}

async function tentar(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AggregaIntel/1.0 (+https://aggrega.vertexgus.duckdns.org)",
    },
  });
  if (res.status === 404) throw new Error("__404__");
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Consulta o CNPJ tentando, em ordem, todas as fontes gratuitas. Retorna o
 * primeiro sucesso. Lança "CNPJ não encontrado" só se TODAS derem 404; lança
 * erro genérico se todas falharem por indisponibilidade.
 */
export async function consultarCnpjServidor(digits: string): Promise<CadastroCnpj> {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length !== 14) throw new Error("CNPJ inválido — informe 14 dígitos.");

  const fontes: { nome: string; url: string; map: (x: Record<string, unknown>, dig: string) => CadastroCnpj }[] = [
    { nome: "BrasilAPI", url: `https://brasilapi.com.br/api/cnpj/v1/${d}`, map: mapOpenData },
    { nome: "minhareceita", url: `https://minhareceita.org/${d}`, map: mapOpenData },
    { nome: "receitaws", url: `https://receitaws.com.br/v1/cnpj/${d}`, map: mapReceitaWs },
  ];

  const erros: string[] = [];
  let algum404 = false;
  for (const f of fontes) {
    try {
      const json = await tentar(f.url);
      if (json) {
        // ReceitaWS sinaliza erro no corpo com status "ERROR"
        if (json.status === "ERROR") {
          erros.push(`${f.nome}: ${String(json.message ?? "erro")}`);
          continue;
        }
        return f.map(json, d);
      }
      erros.push(`${f.nome}: indisponível`);
    } catch (e) {
      if (e instanceof Error && e.message === "__404__") algum404 = true;
      else erros.push(`${f.nome}: ${e instanceof Error ? e.message : "falha"}`);
    }
  }
  if (algum404 && erros.length === 0) throw new Error("CNPJ não encontrado em nenhuma fonte.");
  throw new Error(`Falha em todas as fontes — ${erros.join(" | ")}`);
}
