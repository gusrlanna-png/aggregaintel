import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Em modo demonstração (sem Supabase) liberamos a navegação.
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Atrás de proxy reverso (nginx), request.nextUrl pode trazer o host interno
  // (127.0.0.1:3001). Usa o host público vindo nos headers para montar redirects.
  const fwdHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const fwdProto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : request.nextUrl.origin;

  if (!user && !isPublic) {
    const url = new URL(
      `/login?redirect=${encodeURIComponent(pathname)}`,
      base
    );
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", base));
  }

  const ehPendente = pathname.startsWith("/acesso-pendente");

  // Aprovação de acesso: usuário autenticado mas pendente/bloqueado vai para a
  // tela de espera; quando aprovado, sai dela. (sem_cadastro = fail-open.)
  if (user && !isPublic && !pathname.startsWith("/api")) {
    try {
      const { data: status } = await supabase.rpc("meu_status");
      if ((status === "pendente" || status === "bloqueado") && !ehPendente) {
        return NextResponse.redirect(new URL("/acesso-pendente", base));
      }
      if (status === "ativo" && ehPendente) {
        return NextResponse.redirect(new URL("/dashboard", base));
      }
    } catch {
      /* erro transitório não derruba o usuário */
    }
  }

  // Controle de acesso por perfil (RBAC configurável no banco) — não bloqueia
  // /api nem a tela de espera.
  if (user && !isPublic && !ehPendente && !pathname.startsWith("/api")) {
    try {
      const { data: pode, error } = await supabase.rpc("pode_ver_rota", {
        p_rota: pathname,
      });
      // Fail-open: só redireciona quando a checagem retornou explicitamente false.
      if (!error && pode === false) {
        return NextResponse.redirect(new URL("/dashboard", base));
      }
    } catch {
      /* erro transitório não derruba o usuário (dados seguem protegidos por RLS) */
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto assets estáticos e PWA:
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|worker-.*|icons/.*|apple-touch-icon.png|.*\\.png$).*)",
  ],
};
