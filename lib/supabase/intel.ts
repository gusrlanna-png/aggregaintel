import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { buscarTudo } from "./paginate";
import type { InteligenciaMercado } from "./types";
import {
  localInsert,
  localList,
  localRemove,
  localUpdate,
  newId,
  nowIso,
} from "@/lib/local/store";

export async function getIntel(): Promise<InteligenciaMercado[]> {
  if (!isSupabaseConfigured()) {
    return localList<InteligenciaMercado>("inteligencia_mercado").sort((a, b) =>
      a.criado_em < b.criado_em ? 1 : -1
    );
  }
  const supabase = createClient();
  return buscarTudo<InteligenciaMercado>((from, to) =>
    supabase
      .from("inteligencia_mercado")
      .select("*")
      .order("criado_em", { ascending: false })
      .range(from, to)
  );
}

export async function saveIntel(
  payload: Partial<InteligenciaMercado> & { tipo_fonte: string }
): Promise<InteligenciaMercado> {
  if (!isSupabaseConfigured()) {
    const row = {
      id: newId(),
      criado_em: nowIso(),
      tags: payload.tags ?? [],
      ...payload,
    } as InteligenciaMercado;
    return localInsert<InteligenciaMercado>("inteligencia_mercado", row);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inteligencia_mercado")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as InteligenciaMercado;
}

export async function updateIntel(
  id: string,
  patch: Partial<InteligenciaMercado>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    localUpdate<InteligenciaMercado>("inteligencia_mercado", id, patch);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("inteligencia_mercado")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function removeIntel(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    localRemove("inteligencia_mercado", id);
    return;
  }
  const supabase = createClient();
  await supabase.from("inteligencia_mercado").delete().eq("id", id);
}
