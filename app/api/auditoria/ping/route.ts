import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** IP real do cliente atrás do nginx. */
function ipDe(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Geolocalização aproximada por IP (best-effort, sem chave; timeout curto). */
async function geoDeIp(ip: string | null): Promise<{ cidade: string | null; uf: string | null; pais: string | null }> {
  const vazio = { cidade: null, uf: null, pais: null };
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return vazio;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return vazio;
    const j = await res.json();
    if (j?.status !== "success") return vazio;
    return { cidade: j.city ?? null, uf: j.regionName ?? null, pais: j.country ?? null };
  } catch {
    return vazio;
  }
}

/**
 * Registra um acesso (página) ou ação do usuário + atualiza o dispositivo.
 * Chamado por beacon do cliente. Não bloqueia a navegação.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 204 });

  const body = await req.json().catch(() => ({}));
  const tipo = body?.tipo === "acao" ? "acao" : "acesso";
  const recurso = String(body?.recurso ?? "").slice(0, 300) || null;
  const acao = body?.acao ? String(body.acao).slice(0, 100) : null;
  const detalhe = body?.detalhe ?? null;
  const deviceId = body?.device_id ? String(body.device_id).slice(0, 64) : null;
  const ip = ipDe(req);
  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  // Dispositivo: registra/atualiza; resolve geo só quando é novo ou mudou de IP.
  let geo = { cidade: null as string | null, uf: null as string | null, pais: null as string | null };
  if (deviceId) {
    const { data: existente } = await supabase
      .from("usuario_dispositivos")
      .select("id, ip, n_acessos")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!existente) {
      geo = await geoDeIp(ip);
      await supabase.from("usuario_dispositivos").insert({
        user_id: user.id,
        device_id: deviceId,
        user_agent: ua,
        ip,
        status: "pendente",
      });
    } else {
      if (existente.ip !== ip) geo = await geoDeIp(ip);
      await supabase
        .from("usuario_dispositivos")
        .update({
          ultimo_acesso: new Date().toISOString(),
          n_acessos: (existente.n_acessos ?? 0) + 1,
          ip,
          user_agent: ua,
        })
        .eq("id", existente.id);
    }
  }

  await supabase.from("auditoria_log").insert({
    user_id: user.id,
    email: user.email ?? null,
    tipo,
    recurso,
    acao,
    detalhe,
    dispositivo_id: deviceId,
    ip,
    user_agent: ua,
    geo_cidade: geo.cidade,
    geo_uf: geo.uf,
    geo_pais: geo.pais,
  });

  return NextResponse.json({ ok: true });
}
