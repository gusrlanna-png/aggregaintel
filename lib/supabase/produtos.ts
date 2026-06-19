import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { NotaFiscal, Produto } from "./types";
import {
  localGet,
  localInsert,
  localList,
  localRemove,
  localUpdate,
  newId,
  nowIso,
} from "@/lib/local/store";
import { classificaProduto } from "@/lib/utils/ocr-map";
import { buscarTudo } from "./paginate";

export async function getProdutos(): Promise<Produto[]> {
  if (!isSupabaseConfigured()) {
    return localList<Produto>("produtos").sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  }
  const supabase = createClient();
  return buscarTudo<Produto>((from, to) =>
    supabase.from("produtos").select("*").order("nome").range(from, to)
  );
}

/** Nomes de produto extraídos das NFs com contagem e tipo inferido. */
export interface NomeNF {
  nome: string;
  count: number;
  tipoInferido: string;
}

export async function getNomesNF(): Promise<NomeNF[]> {
  let descs: { desc: string; tipo: string | null }[] = [];
  if (!isSupabaseConfigured()) {
    descs = localList<NotaFiscal>("notas_fiscais")
      .filter((n) => n.produto_desc)
      .map((n) => ({ desc: n.produto_desc as string, tipo: n.produto_tipo }));
  } else {
    const supabase = createClient();
    const data = await buscarTudo<{ produto_desc: string; produto_tipo: string | null }>(
      (from, to) =>
        supabase
          .from("notas_fiscais")
          .select("produto_desc, produto_tipo")
          .not("produto_desc", "is", null)
          .range(from, to)
    );
    descs = (data ?? []).map((r) => ({
      desc: r.produto_desc as string,
      tipo: r.produto_tipo as string | null,
    }));
  }

  const map = new Map<string, NomeNF>();
  for (const { desc, tipo } of descs) {
    const key = desc.trim();
    if (!key) continue;
    const cur = map.get(key.toLowerCase());
    if (cur) cur.count += 1;
    else
      map.set(key.toLowerCase(), {
        nome: key,
        count: 1,
        tipoInferido: tipo || classificaProduto(key) || "outro",
      });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Nomes das NFs ainda não presentes em nenhum produto (nome ou alias). */
export async function getNomesNaoCatalogados(): Promise<NomeNF[]> {
  const [nomes, produtos] = await Promise.all([getNomesNF(), getProdutos()]);
  const catalogados = new Set<string>();
  for (const p of produtos) {
    catalogados.add(p.nome.toLowerCase());
    for (const a of p.aliases ?? []) catalogados.add(a.toLowerCase());
  }
  return nomes.filter((n) => !catalogados.has(n.nome.toLowerCase()));
}

export async function addProduto(
  nome: string,
  tipo: string,
  origem: "nf" | "manual" = "manual",
  aliases: string[] = []
): Promise<Produto> {
  if (!isSupabaseConfigured()) {
    const row: Produto = {
      id: newId(),
      nome: nome.trim(),
      tipo,
      aliases,
      origem,
      criado_em: nowIso(),
    };
    return localInsert<Produto>("produtos", row);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("produtos")
    .insert({ nome: nome.trim(), tipo, aliases, origem })
    .select()
    .single();
  if (error) throw error;
  return data as Produto;
}

export async function updateProduto(
  id: string,
  patch: Partial<Produto>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    localUpdate<Produto>("produtos", id, patch);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("produtos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeProduto(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    localRemove("produtos", id);
    return;
  }
  const supabase = createClient();
  await supabase.from("produtos").delete().eq("id", id);
}

/** Adiciona um nome (ex.: de NF) como alias de um produto existente. */
export async function addAlias(produtoId: string, nome: string): Promise<void> {
  const prod = isSupabaseConfigured()
    ? (await getProdutos()).find((p) => p.id === produtoId)
    : localGet<Produto>("produtos", produtoId);
  if (!prod) return;
  const aliases = Array.from(
    new Set([...(prod.aliases ?? []), nome.trim()])
  ).filter((a) => a.toLowerCase() !== prod.nome.toLowerCase());
  await updateProduto(produtoId, { aliases });
}

/** Remove um nome vinculado (alias) de um produto — desfaz a mesclagem daquele nome. */
export async function removeAlias(produtoId: string, nome: string): Promise<void> {
  const prod = isSupabaseConfigured()
    ? (await getProdutos()).find((p) => p.id === produtoId)
    : localGet<Produto>("produtos", produtoId);
  if (!prod) return;
  const aliases = (prod.aliases ?? []).filter(
    (a) => a.toLowerCase() !== nome.trim().toLowerCase()
  );
  await updateProduto(produtoId, { aliases });
}

/** Mescla o produto source no target: nome e aliases viram aliases do target. */
export async function mergeProdutos(
  sourceId: string,
  targetId: string
): Promise<void> {
  const produtos = await getProdutos();
  const source = produtos.find((p) => p.id === sourceId);
  const target = produtos.find((p) => p.id === targetId);
  if (!source || !target || sourceId === targetId) return;

  const aliases = Array.from(
    new Set([
      ...(target.aliases ?? []),
      source.nome,
      ...(source.aliases ?? []),
    ])
  ).filter((a) => a.toLowerCase() !== target.nome.toLowerCase());

  await updateProduto(targetId, { aliases });
  await removeProduto(sourceId);
}
