import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

/**
 * Cadastro único de empresas (CNPJ). Os papéis são flags que habilitam recursos
 * no mesmo cadastro: produtor (CFEM, produção), cliente (planejamento, vendas),
 * fornecedor (mix) e transportador. A tabela física é `empresas`; `emissores` e
 * `clientes` são views filtradas por papel.
 */
export interface EmpresaPapeis {
  eh_produtor: boolean;
  eh_cliente: boolean;
  eh_fornecedor: boolean;
  eh_transportador: boolean;
}

export const PAPEIS_EMPRESA: { chave: keyof EmpresaPapeis; label: string; recursos: string }[] = [
  { chave: "eh_produtor", label: "Produtor", recursos: "CFEM, produção, títulos minerários, NFs emitidas" },
  { chave: "eh_cliente", label: "Cliente", recursos: "planejamento, metas, vendas, NFs recebidas, oportunidade" },
  { chave: "eh_fornecedor", label: "Fornecedor", recursos: "mix de fornecimento, preço efetivo" },
  { chave: "eh_transportador", label: "Transportador", recursos: "vínculo em fretes/NFs" },
];

export async function getEmpresaPapeis(id: string): Promise<EmpresaPapeis | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("eh_produtor, eh_cliente, eh_fornecedor, eh_transportador")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as EmpresaPapeis) ?? null;
}

export async function setEmpresaPapeis(
  id: string,
  papeis: Partial<EmpresaPapeis>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ ...papeis, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
