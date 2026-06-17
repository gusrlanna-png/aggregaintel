"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

/**
 * Hook de ordenação para tabelas. Clicar numa coluna alterna asc/desc.
 * Padrão do sistema — use com <SortableHead> e sortRows().
 */
export function useSort<K extends string>(
  initialKey: K | null = null,
  initialDir: SortDir = "asc"
) {
  const [sort, setSort] = React.useState<SortState<K>>({
    key: initialKey,
    dir: initialDir,
  });
  const toggle = (key: K) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  return { sort, toggle, setSort };
}

/** Ordena linhas por um acessor; valores nulos vão para o fim. */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getValue: (row: T, key: K) => unknown
): T[] {
  if (!sort.key) return rows;
  const key = sort.key;
  const out = [...rows].sort((a, b) => {
    const va = getValue(a, key);
    const vb = getValue(b, key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
  });
  return sort.dir === "asc" ? out : out.reverse();
}

/** Cabeçalho de coluna clicável com indicador de ordenação (seta). */
export function SortableHead<K extends string>({
  sortKey,
  sort,
  onSort,
  children,
  className,
  align = "left",
}: {
  sortKey: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead className={cn("select-none", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex w-full items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground"
        )}
      >
        <span className="truncate">{children}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active ? "opacity-100" : "opacity-40"
          )}
        />
      </button>
    </TableHead>
  );
}
