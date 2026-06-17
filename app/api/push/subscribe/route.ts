import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Salva uma push subscription do navegador na tabela push_subscriptions.
 * O envio efetivo das notificações é disparado pelo n8n (Fase 7).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.subscription?.endpoint) {
    return NextResponse.json(
      { error: "subscription inválida." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase não configurado (modo demo)." },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();
  const sub = body.subscription;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh ?? null,
      auth: sub.keys?.auth ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
