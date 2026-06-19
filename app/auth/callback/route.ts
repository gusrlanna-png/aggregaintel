import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Atrás do nginx, request.url traz o host interno (127.0.0.1:3001). Monta o
  // retorno pelo host real (header Host = $host do nginx) + protocolo.
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : new URL(request.url).origin;

  return NextResponse.redirect(`${base}${redirect}`);
}
