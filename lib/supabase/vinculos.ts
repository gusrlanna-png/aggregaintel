import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface VinculoCnpj {
  cliente_id: string | null;
  cliente_nome: string | null;
  emissor_id: string | null;
  emissor_nome: string | null;
}

/**
 * Busca o cadastro de cliente e de produtor que compartilham a mesma raiz de
 * CNPJ (8 dígitos). Permite navegar entre as duas faces da mesma empresa.
 */
export async function getVinculoPorCnpj(
  cnpj?: string | null
): Promise<VinculoCnpj | null> {
  const raiz = (cnpj ?? "").replace(/\D/g, "").slice(0, 8);
  if (!isSupabaseConfigured() || raiz.length < 8) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("vinculo_por_cnpj", {
    p_cnpj: cnpj,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as VinculoCnpj) ?? null;
}
