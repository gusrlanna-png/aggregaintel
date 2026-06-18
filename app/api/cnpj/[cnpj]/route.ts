import { NextResponse } from "next/server";

import { consultarCnpjServidor } from "@/lib/api/cnpj-fontes";

export const runtime = "nodejs";

/**
 * Consulta cadastral de CNPJ com cascata de fontes gratuitas (BrasilAPI →
 * minhareceita.org → ReceitaWS). GET /api/cnpj/00000000000000
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
    const result = await consultarCnpjServidor(digits);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar o CNPJ.";
    const naoEncontrado = /não encontrado/i.test(msg);
    return NextResponse.json({ error: msg }, { status: naoEncontrado ? 404 : 502 });
  }
}
