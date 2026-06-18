import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { gerarPlanoDev } from "@/lib/dev/plano";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Regenera o plano de uma dev_task incorporando o feedback/opinião do usuário. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const taskId = String(body?.taskId ?? "");
  const feedback = String(body?.feedback ?? "").trim();
  if (!taskId || !feedback) {
    return NextResponse.json({ error: "taskId e feedback são obrigatórios." }, { status: 400 });
  }

  const { data: task } = await supabase
    .from("dev_tasks")
    .select("pedido, plano, contexto")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });

  const ctx = (task.contexto ?? {}) as { pagina?: string; pathname?: string };
  const contextoStr = [
    ctx.pagina ? `Página relacionada: ${ctx.pagina} (${ctx.pathname ?? "?"})` : "",
    `\nPLANO ANTERIOR (revise e incorpore o ajuste; mantenha as seções):\n${task.plano ?? "(vazio)"}`,
    `\nAJUSTE/OPINIÃO DO USUÁRIO (atenda explicitamente):\n${feedback}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const plano = await gerarPlanoDev(task.pedido as string, contextoStr);
    await supabase
      .from("dev_tasks")
      .update({
        titulo: plano.titulo,
        plano: plano.plano,
        provedor: plano.provedor,
        status: "aguardando_aprovacao", // volta para revisão após ajuste
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", taskId);
    return NextResponse.json({ ok: true, provedor: plano.provedor });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao refinar o plano." },
      { status: 500 }
    );
  }
}
