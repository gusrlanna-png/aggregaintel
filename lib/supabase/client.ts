import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente Supabase para uso no navegador (client components).
 * Usa as chaves públicas (anon). As políticas RLS controlam o acesso.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
