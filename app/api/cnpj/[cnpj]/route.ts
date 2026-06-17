import { NextResponse } from "next/server";

export const runtime = "nodejs";

function fmtCnpj(d: string): string {
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12
  )}-${d.slice(12)}`;
}

/**
 * Consulta cadastral de CNPJ via BrasilAPI (gratuita, sem chave).
 * GET /api/cnpj/00000000000000
 */
export async function GET(
  _req: Request,
  { params }: { params: { cnpj: string } }
) {
  const digits = (params.cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ inválido. Informe 14 dígitos." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AggregaIntel/1.0 (+https://aggregaintel.app)",
      },
      next: { revalidate: 0 },
    });
    if (res.status === 404) {
      return NextResponse.json(
        { error: "CNPJ não encontrado." },
        { status: 404 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha na consulta (${res.status}).` },
        { status: 502 }
      );
    }
    const d = await res.json();

    const logradouro = [d.descricao_tipo_de_logradouro, d.logradouro, d.numero]
      .filter(Boolean)
      .join(" ")
      .trim();

    const socios = Array.isArray(d.qsa)
      ? d.qsa.map((s: Record<string, unknown>) => ({
          nome: (s.nome_socio as string) ?? null,
          qualificacao: (s.qualificacao_socio as string) ?? null,
          faixa_etaria: (s.faixa_etaria as string) ?? null,
          desde: (s.data_entrada_sociedade as string) ?? null,
        }))
      : [];

    const result = {
      razao_social: d.razao_social ?? d.nome_fantasia ?? null,
      nome_fantasia: d.nome_fantasia ?? null,
      cnpj: fmtCnpj(digits),
      logradouro: logradouro || null,
      bairro: d.bairro ?? null,
      municipio: d.municipio ?? null,
      uf: d.uf ?? null,
      cep: d.cep ? String(d.cep).replace(/(\d{5})(\d{3})/, "$1-$2") : null,
      fone: d.ddd_telefone_1 ?? null,
      situacao: d.descricao_situacao_cadastral ?? null,
      cnae: d.cnae_fiscal_descricao ?? null,
      // Cadastro estendido
      data_fundacao: d.data_inicio_atividade ?? null,
      atividade_principal: d.cnae_fiscal_descricao
        ? `${d.cnae_fiscal ?? ""} ${d.cnae_fiscal_descricao}`.trim()
        : null,
      capital_social:
        d.capital_social != null ? Number(d.capital_social) : null,
      natureza_juridica: d.natureza_juridica ?? null,
      matriz_filial:
        d.identificador_matriz_filial === 1
          ? "matriz"
          : d.identificador_matriz_filial === 2
            ? "filial"
            : null,
      socios,
    };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao consultar o CNPJ.",
      },
      { status: 500 }
    );
  }
}
