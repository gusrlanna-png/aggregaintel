import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface ClienteEndereco {
  id: string;
  empresa_id: string;
  nome: string | null;
  tipo: string | null; // obra | usina | fabrica | matriz | outro
  segmento: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  ativo: boolean;
  externo_id: string | null;
  fonte_id: string | null;
  fonte_raw: Record<string, unknown> | null;
  criado_em: string;
}

export const TIPOS_ENDERECO: Record<string, string> = {
  matriz: "Matriz / sede",
  obra: "Obra",
  usina: "Usina",
  fabrica: "Fábrica de pré-fabricados",
  outro: "Outro",
};

const COLS =
  "id, empresa_id, nome, tipo, segmento, logradouro, numero, complemento, bairro, municipio, uf, cep, lat, lng, ativo, externo_id, fonte_id, criado_em";

/** Endereços de obra/usina/fábrica de um cliente (mesmo CNPJ). */
export async function getClienteEnderecos(
  empresaId: string
): Promise<ClienteEndereco[]> {
  if (!empresaId || !isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("cliente_enderecos")
    .select(COLS)
    .eq("empresa_id", empresaId)
    .order("ativo", { ascending: false })
    .order("nome");
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as ClienteEndereco[]) ?? [];
}

export type ClienteEnderecoInput = Partial<
  Omit<ClienteEndereco, "id" | "empresa_id" | "criado_em">
> & { empresa_id: string };

export async function upsertClienteEndereco(
  e: ClienteEnderecoInput & { id?: string }
): Promise<ClienteEndereco> {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado.");
  const s = createClient();
  const payload = {
    empresa_id: e.empresa_id,
    nome: e.nome ?? null,
    tipo: e.tipo ?? null,
    segmento: e.segmento ?? null,
    logradouro: e.logradouro ?? null,
    numero: e.numero ?? null,
    complemento: e.complemento ?? null,
    bairro: e.bairro ?? null,
    municipio: e.municipio ?? null,
    uf: e.uf ?? null,
    cep: e.cep ?? null,
    ativo: e.ativo ?? true,
  };
  const q = e.id
    ? s.from("cliente_enderecos").update(payload).eq("id", e.id)
    : s.from("cliente_enderecos").insert(payload);
  const { data, error } = await q.select(COLS).single();
  if (error) throw error;
  return data as ClienteEndereco;
}

export async function deleteClienteEndereco(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const s = createClient();
  const { error } = await s.from("cliente_enderecos").delete().eq("id", id);
  if (error) throw error;
}
