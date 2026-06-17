import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { podeAcessar, type Perfil } from "@/lib/auth/rotas";

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

  // Controle de acesso por perfil (RBAC) — não bloqueia rotas de API.
  if (user && !isPublic && !pathname.startsWith("/api")) {
    const { data: perfil } = await supabase.rpc("meu_perfil");
    if (!podeAcessar((perfil as Perfil | null) ?? null, pathname)) {
      return NextResponse.redirect(new URL("/dashboard", base));
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
