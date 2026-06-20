import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Grupo do Entra (nome) → perfil do app. Só perfis OPERACIONAIS são auto-
// atribuídos; admin/gestor permanecem manuais (segurança, sem service_role).
const GRUPO_PERFIL: { grupo: string; perfil: string }[] = [
  { grupo: "aggregaintel-financeiro", perfil: "financeiro" },
  { grupo: "aggregaintel-inteligencia", perfil: "analista_inteligencia" },
  { grupo: "aggregaintel-comercial", perfil: "vendedor" },
];

type Sb = ReturnType<typeof createClient>;

/** Lê os grupos do usuário no Entra (Graph) e aplica o perfil correspondente. */
async function aplicarPerfilPorGrupo(supabase: Sb): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;
  if (!token) return;
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=displayName&$top=200",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return; // sem consentimento GroupMember.Read.All → ignora
    const json = (await res.json()) as { value?: { displayName?: string }[] };
    const grupos = new Set(
      (json.value ?? []).map((g) => (g.displayName ?? "").trim().toLowerCase())
    );
    const match = GRUPO_PERFIL.find((m) => grupos.has(m.grupo));
    if (match) {
      await supabase.rpc("aplicar_perfil_entra", { p_perfil: match.perfil });
    }
  } catch {
    /* enriquecimento de perfil é complementar — não bloqueia o login */
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
    await aplicarPerfilPorGrupo(supabase);
  }

  // Atrás do nginx, request.url traz o host interno (127.0.0.1:3001). Monta o
  // retorno pelo host real (header Host = $host do nginx) + protocolo.
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : new URL(request.url).origin;

  return NextResponse.redirect(`${base}${redirect}`);
}
