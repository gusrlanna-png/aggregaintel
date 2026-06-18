import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { processJob } from "@/lib/jobs/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tipo = String(body?.tipo ?? "");
  if (!tipo) {
    return NextResponse.json({ error: "tipo ausente." }, { status: 400 });
  }

  // Reaper: jobs presos em "processando" há mais de 15 min (ex.: servidor
  // reiniciou) viram "erro" para poderem ser reprocessados.
  const limite = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabase
    .from("jobs")
    .update({ status: "erro", erro: "Interrompido (servidor reiniciado)." })
    .eq("status", "processando")
    .lt("iniciado_em", limite);

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      tipo,
      titulo: body?.titulo ?? null,
      payload: body?.payload ?? {},
      entidade_tipo: body?.entidade_tipo ?? null,
      entidade_id: body?.entidade_id ?? null,
      criado_por: session.user.id,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message ?? "Falha ao enfileirar." },
      { status: 500 }
    );
  }

  // Dispara o processamento em segundo plano no processo do servidor.
  // NÃO usamos await: a resposta volta na hora e o trabalho continua mesmo
  // que o usuário saia da página.
  void processJob(job.id, session.access_token);

  return NextResponse.json({ jobId: job.id });
}
