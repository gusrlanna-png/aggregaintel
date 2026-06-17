"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  DIM_COL,
  editarMeta,
  getVendasNivel,
  type Dim,
  type NivelRow,
} from "@/lib/supabase/vendas";
import { MESES_LABEL } from "@/lib/utils/sazonalidade";
import { cn } from "@/lib/utils";

type SortCol =
  | "rotulo"
  | "peso_2024"
  | "peso_2025"
  | "peso_meta"
  | "pct"
  | "preco_2025"
  | "preco_meta";
interface Sort {
  col: SortCol;
  dir: "asc" | "desc";
}

const fmtNum = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtPreco = (n: number | null) =>
  n == null
    ? "—"
    : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctMeta = (r: NivelRow) =>
  r.peso_2025 ? ((r.peso_meta - r.peso_2025) / r.peso_2025) * 100 : 0;

function rotuloDe(dim: Dim, row: NivelRow): string {
  if (dim === "mes") {
    const m = Number(row.rotulo);
    return MESES_LABEL[m - 1] ?? row.rotulo;
  }
  return row.rotulo;
}

function ordenar(rows: NivelRow[], dim: Dim, sort: Sort): NivelRow[] {
  // Meses sempre em ordem cronológica (Jan→Dez), independente da coluna de sort.
  if (dim === "mes") {
    return [...rows].sort((a, b) => Number(a.rotulo) - Number(b.rotulo));
  }
  const f = sort.dir === "asc" ? 1 : -1;
  const val = (r: NivelRow): number | string => {
    switch (sort.col) {
      case "rotulo":
        return rotuloDe(dim, r).toLowerCase();
      case "pct":
        return pctMeta(r);
      default:
        return (r[sort.col] as number) ?? 0;
    }
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === "string" && typeof vb === "string")
      return va.localeCompare(vb) * f;
    return ((va as number) - (vb as number)) * f;
  });
}

function Divergencia({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 tabular-nums",
        up ? "text-emerald-600" : "text-destructive"
      )}
    >
      {up ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const GRID =
  "grid grid-cols-[minmax(160px,1.6fr)_repeat(6,minmax(70px,1fr))] items-center gap-2";

/** Célula numérica editável inline (Peso Meta / Preço Meta no nível mês). */
function InputMeta({
  valor,
  onSalvar,
}: {
  valor: number | null;
  onSalvar: (n: number | null) => void;
}) {
  const fmt = (v: number | null) =>
    v == null ? "" : String(v).replace(".", ",");
  const [txt, setTxt] = React.useState(fmt(valor));
  React.useEffect(() => setTxt(fmt(valor)), [valor]);

  const salvar = () => {
    const limpo = txt.trim().replace(/\./g, "").replace(",", ".");
    const n = limpo === "" ? null : Number(limpo);
    if (n != null && Number.isNaN(n)) {
      setTxt(fmt(valor));
      return;
    }
    if ((n ?? null) === (valor ?? null)) return;
    onSalvar(n);
  };

  return (
    <input
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={salvar}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTxt(fmt(valor));
          e.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-input focus:border-primary focus:bg-background focus:outline-none"
    />
  );
}

function Linha({
  row,
  level,
  filtros,
  dims,
  fonte,
  sort,
}: {
  row: NivelRow;
  level: number;
  filtros: Record<string, string>;
  dims: Dim[];
  fonte: number;
  sort: Sort;
}) {
  const [aberto, setAberto] = React.useState(false);
  const qc = useQueryClient();
  const dim = dims[level];
  const expansivel = level < dims.length - 1;
  const childFiltros = { ...filtros, [DIM_COL[dim]]: row.chave };
  // Só permite editar quando a linha identifica uma meta única
  // (visão por Cliente → Unidade → Produto → Mês).
  const editavel =
    dim === "mes" &&
    "cnpj_secundario" in filtros &&
    "produto" in filtros;

  async function salvarMeta(campo: "peso" | "preco", n: number | null) {
    try {
      const cnt = await editarMeta(
        fonte,
        filtros,
        Number(row.chave),
        campo === "peso" ? n : null,
        campo === "preco" ? n : null
      );
      if (cnt === 0) {
        toast.error("Nenhuma linha de meta encontrada para editar.");
        return;
      }
      toast.success(
        campo === "peso" ? "Peso meta atualizado." : "Preço meta atualizado."
      );
      qc.invalidateQueries({ queryKey: ["vendas-nivel"] });
    } catch (e) {
      toast.error(
        "Erro ao salvar: " + (e instanceof Error ? e.message : String(e))
      );
    }
  }

  return (
    <>
      <div
        className={cn(
          GRID,
          "border-b px-2 py-2 text-sm",
          expansivel && "cursor-pointer hover:bg-muted/50",
          level === 0 && "font-medium"
        )}
        style={{ paddingLeft: 8 + level * 16 }}
        onClick={expansivel ? () => setAberto((v) => !v) : undefined}
      >
        <span className="flex items-center gap-1 truncate">
          {expansivel ? (
            aberto ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="truncate">{rotuloDe(dim, row)}</span>
          {editavel && (
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          )}
        </span>
        <span className="text-right tabular-nums text-muted-foreground">
          {fmtNum(row.peso_2024)}
        </span>
        <span className="text-right tabular-nums text-muted-foreground">
          {fmtNum(row.peso_2025)}
        </span>
        {editavel ? (
          <InputMeta
            valor={Math.round(row.peso_meta)}
            onSalvar={(n) => salvarMeta("peso", n)}
          />
        ) : (
          <span className="text-right font-medium tabular-nums">
            {fmtNum(row.peso_meta)}
          </span>
        )}
        <span className="text-right">
          <Divergencia pct={pctMeta(row)} />
        </span>
        <span className="text-right tabular-nums text-muted-foreground">
          {fmtPreco(row.preco_2025)}
        </span>
        {editavel ? (
          <InputMeta
            valor={row.preco_meta}
            onSalvar={(n) => salvarMeta("preco", n)}
          />
        ) : (
          <span className="text-right tabular-nums">
            {fmtPreco(row.preco_meta)}
          </span>
        )}
      </div>
      {aberto && expansivel && (
        <Nivel
          level={level + 1}
          filtros={childFiltros}
          dims={dims}
          fonte={fonte}
          sort={sort}
        />
      )}
    </>
  );
}

function Nivel({
  level,
  filtros,
  dims,
  fonte,
  sort,
}: {
  level: number;
  filtros: Record<string, string>;
  dims: Dim[];
  fonte: number;
  sort: Sort;
}) {
  const dim = dims[level];
  const { data, isLoading } = useQuery({
    queryKey: ["vendas-nivel", fonte, dim, filtros],
    queryFn: () => getVendasNivel(fonte, dim, filtros),
  });

  if (isLoading)
    return (
      <div
        className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
      </div>
    );
  if (!data || data.length === 0)
    return (
      <div
        className="px-2 py-2 text-xs text-muted-foreground"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        sem dados
      </div>
    );

  const rows = ordenar(data, dim, sort);
  return (
    <>
      {rows.map((row) => (
        <Linha
          key={`${level}-${row.chave}`}
          row={row}
          level={level}
          filtros={filtros}
          dims={dims}
          fonte={fonte}
          sort={sort}
        />
      ))}
    </>
  );
}

function Cabecalho({
  sort,
  setSort,
  primeiraColLabel,
}: {
  sort: Sort;
  setSort: (s: Sort) => void;
  primeiraColLabel: string;
}) {
  const toggle = (col: SortCol) =>
    setSort({
      col,
      dir: sort.col === col && sort.dir === "desc" ? "asc" : "desc",
    });
  const Seta = ({ col }: { col: SortCol }) =>
    sort.col === col ? (
      sort.dir === "desc" ? (
        <ArrowDown className="ml-0.5 inline h-3 w-3" />
      ) : (
        <ArrowUp className="ml-0.5 inline h-3 w-3" />
      )
    ) : null;
  const cols: { col: SortCol; label: string }[] = [
    { col: "peso_2024", label: "Peso 2024" },
    { col: "peso_2025", label: "Peso 2025" },
    { col: "peso_meta", label: "Peso Meta" },
    { col: "pct", label: "% Meta×25" },
    { col: "preco_2025", label: "Preço 2025" },
    { col: "preco_meta", label: "Preço Meta" },
  ];
  return (
    <div className={cn(GRID, "border-b bg-muted/60 px-2 py-2 text-xs font-semibold")}>
      <button
        className="flex items-center text-left hover:text-primary"
        onClick={() => toggle("rotulo")}
      >
        {primeiraColLabel}
        <Seta col="rotulo" />
      </button>
      {cols.map((c) => (
        <button
          key={c.col}
          className="flex items-center justify-end text-right hover:text-primary"
          onClick={() => toggle(c.col)}
        >
          {c.label}
          <Seta col={c.col} />
        </button>
      ))}
    </div>
  );
}

export function VendasHierarquia({
  fonte,
  dims,
  primeiraColLabel = "Cliente / Produto / Mês",
}: {
  fonte: number;
  dims: Dim[];
  primeiraColLabel?: string;
}) {
  const [sort, setSort] = React.useState<Sort>({ col: "peso_meta", dir: "desc" });
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[680px]">
        <Cabecalho
          sort={sort}
          setSort={setSort}
          primeiraColLabel={primeiraColLabel}
        />
        <Nivel level={0} filtros={{}} dims={dims} fonte={fonte} sort={sort} />
      </div>
    </div>
  );
}
