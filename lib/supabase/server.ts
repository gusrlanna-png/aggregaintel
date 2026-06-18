import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente Supabase para Server Components / Route Handlers,
 * com persistência de sessão via cookies (@supabase/ssr).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado de um Server Component — pode ser ignorado quando há
          // middleware atualizando a sessão.
        }
      },
    },
  });
}

/**
 * Cliente administrativo (service role) — APENAS para API Routes no servidor.
 * Ignora RLS. Nunca exponha a SERVICE_ROLE_KEY ao cliente.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente autenticado a partir de um access_token (JWT) do usuário.
 * Usado pelo processamento de jobs em segundo plano: roda no processo do
 * servidor com a identidade do usuário (respeita RLS), sem precisar de
 * service_role. O token é capturado no momento de enfileirar a tarefa.
 */
export function createTokenClient(accessToken: string) {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
