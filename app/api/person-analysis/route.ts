import { NextResponse, type NextRequest } from "next/server";

import { analisarPessoa } from "@/lib/ai/person-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nome: string = body?.nome?.trim();
  const empresas: string[] = Array.isArray(body?.empresas) ? body.empresas : [];
  if (!nome) {
    return NextResponse.json({ error: "Nome ausente." }, { status: 400 });
  }
  const r = await analisarPessoa(nome, empresas);
  if (r.fallback) {
    return NextResponse.json({ fallback: true, message: r.message });
  }
  return NextResponse.json({ resumo: r.resumo, sources: r.sources, dados: r.dados });
}
