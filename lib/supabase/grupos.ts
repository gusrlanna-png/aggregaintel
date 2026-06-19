import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface MembroGrupo {
  id: string;
  razao_social: string;
  fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  municipio: string | null;
  uf: string | null;
  segmento: string | null;
  eh_cliente: boolean;
  eh_produtor: boolean;
  eh_fornecedor: boolean;
  eh_transportador: boolean;
  ton: number;
  faturamento: number;
  nfs: number;
}

export interface ResumoGrupo {
  nome: string;
  membros: MembroGrupo[];
  ton: number;
  faturamento: number;
  nfs: number;
}

/** Consolida um grupo econômico: membros (por papel) + volume/faturamento das NFs. */
export async function getGrupoEconomico(nome: string): Promise<ResumoGrupo | null> {
  if (!isSupabaseConfigured() || !nome) return null;
  const s = createClient();
  const { data: emp, error } = await s
    .from("empresas")
    .select(
      "id, razao_social, fantasia, cnpj, cpf, municipio, uf, segmento, eh_cliente, eh_produtor, eh_fornecedor, eh_transportador"
    )
    .eq("grupo_economico", nome)
    .order("razao_social");
  if (error) throw error;
  const membros = (emp as Omit<MembroGrupo, "ton" | "faturamento" | "nfs">[]) ?? [];
  if (!membros.length) return { nome, membros: [], ton: 0, faturamento: 0, nfs: 0 };

  const ids = membros.map((m) => m.id);
  const { data: nfs } = await s
    .from("notas_fiscais")
    .select("cliente_id, quantidade_ton, valor_total_nota, valor_total")
    .in("cliente_id", ids)
    .not("desconsiderada", "eq", true);

  const agg = new Map<string, { ton: number; fat: number; n: number }>();
  for (const r of (nfs as {
    cliente_id: string;
    quantidade_ton: number | null;
    valor_total_nota: number | null;
    valor_total: number | null;
  }[]) ?? []) {
    const a = agg.get(r.cliente_id) ?? { ton: 0, fat: 0, n: 0 };
    a.ton += Number(r.quantidade_ton) || 0;
    a.fat += Number(r.valor_total_nota ?? r.valor_total) || 0;
    a.n += 1;
    agg.set(r.cliente_id, a);
  }

  const full: MembroGrupo[] = membros.map((m) => {
    const a = agg.get(m.id) ?? { ton: 0, fat: 0, n: 0 };
    return { ...m, ton: a.ton, faturamento: a.fat, nfs: a.n };
  });
  full.sort((a, b) => b.ton - a.ton || a.razao_social.localeCompare(b.razao_social));

  return {
    nome,
    membros: full,
    ton: full.reduce((s2, m) => s2 + m.ton, 0),
    faturamento: full.reduce((s2, m) => s2 + m.faturamento, 0),
    nfs: full.reduce((s2, m) => s2 + m.nfs, 0),
  };
}

/** Lista de grupos econômicos distintos (com contagem de membros) para navegação. */
export async function getGruposEconomicos(): Promise<{ nome: string; membros: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s
    .from("empresas")
    .select("grupo_economico")
    .not("grupo_economico", "is", null)
    .limit(20000);
  if (error) return [];
  const m = new Map<string, number>();
  for (const r of (data as { grupo_economico: string }[]) ?? []) {
    const g = (r.grupo_economico ?? "").trim();
    if (g && g.toUpperCase() !== "NULL") m.set(g, (m.get(g) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([nome, membros]) => ({ nome, membros }))
    .filter((g) => g.membros > 1)
    .sort((a, b) => b.membros - a.membros);
}
