/**
 * Armazenamento local (localStorage) usado quando o Supabase não está
 * configurado. Substitui os antigos dados fictícios: o app começa VAZIO e
 * persiste apenas o que for importado de NFs/arquivos ou inserido manualmente.
 *
 * Quando o Supabase estiver configurado (isSupabaseConfigured()), as funções de
 * acesso a dados usam o backend real e ignoram este módulo.
 */

const PREFIX = "aggregaintel:";

export type LocalTable =
  | "emissores"
  | "clientes"
  | "notas_fiscais"
  | "nf_projecao"
  | "traco_consumo"
  | "fornecedor_mix"
  | "inteligencia_mercado"
  | "cfem_anm"
  | "market_share_snapshot"
  | "grupos_economicos"
  | "produtos"
  | "sazonalidade"
  | "projecao_mensal"
  | "calendario_config";

function read<T>(t: LocalTable): T[] {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(PREFIX + t);
    return v ? (JSON.parse(v) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(t: LocalTable, rows: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + t, JSON.stringify(rows));
  } catch {
    /* quota / indisponível */
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function localList<T>(t: LocalTable): T[] {
  return read<T>(t);
}

export function localGet<T extends { id: string }>(
  t: LocalTable,
  id: string
): T | null {
  return read<T>(t).find((r) => r.id === id) ?? null;
}

export function localInsert<T extends { id: string }>(t: LocalTable, row: T): T {
  const rows = read<T>(t);
  rows.unshift(row);
  write(t, rows);
  return row;
}

export function localUpsert<T extends { id: string }>(t: LocalTable, row: T): T {
  const rows = read<T>(t);
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  write(t, rows);
  return row;
}

export function localUpdate<T extends { id: string }>(
  t: LocalTable,
  id: string,
  patch: Partial<T>
): T | null {
  const rows = read<T>(t);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch };
  write(t, rows);
  return rows[i];
}

export function localRemove(t: LocalTable, id: string): void {
  write(
    t,
    read<{ id: string }>(t).filter((r) => r.id !== id)
  );
}

export function localRemoveWhere<T>(
  t: LocalTable,
  predicate: (row: T) => boolean
): void {
  write(
    t,
    read<T>(t).filter((r) => !predicate(r))
  );
}
