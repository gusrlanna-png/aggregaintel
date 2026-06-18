"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableHead,
  sortRows,
  useSort,
} from "@/components/ui/sortable-table";
import { BuscaTabela, matchBusca } from "@/components/ui/busca-tabela";
import { Button } from "@/components/ui/button";
import {
  getPrecoEfetivoPorCnpj,
  getProjecaoClientes,
  type ProjecaoCliente,
} from "@/lib/supabase/projecao-base";
import { fmtReais, fmtToneladas1 } from "@/lib/utils/agregados";

type SortKey =
  | "nome"
  | "segmento"
  | "cidade"
  | "realizado"
  | "projetado"
  | "previsto"
  | "precoNf";

function val(p: ProjecaoCliente, k: SortKey): unknown {
  switch (k) {
    case "nome":
      return p.nome ?? "";
    case "segmento":
      return p.segmento ?? "";
    case "cidade":
      return p.cidade ?? "";
    case "realizado":
      return p.valor_realizado;
    case "projetado":
      return p.valor_projetado;
    case "previsto":
      return p.valor_previsto_ano;
    default:
      return null;
  }
}

export default function ProjecaoPage() {
  const [busca, setBusca] = React.useState("");
  const [segmento, setSegmento] = React.useState("all");
  const { sort, toggle } = useSort<SortKey>("previsto", "desc");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["projecao-clientes"],
    queryFn: getProjecaoClientes,
  });
  // Preço efetivo real das NFs por CNPJ (realidade × projeção do BI).
  const { data: precoNfMap } = useQuery({
    queryKey: ["projecao-preco-nf"],
    queryFn: getPrecoEfetivoPorCnpj,
  });
  const precoNf = React.useCallback(
    (c: ProjecaoCliente) => precoNfMap?.get(c.cnpj_digitos)?.preco_efetivo ?? 0,
    [precoNfMap]
  );

  const segmentos = React.useMemo(
    () =>
      Array.from(
        new Set(clientes.map((c) => c.segmento).filter(Boolean))
      ).sort() as string[],
    [clientes]
  );

  const filtrados = React.useMemo(() => {
    const base = clientes.filter((c) => {
      if (segmento !== "all" && c.segmento !== segmento) return false;
      return matchBusca(busca, c.nome, c.cnpj, c.segmento, c.cidade);
    });
    const valEx = (p: ProjecaoCliente, k: SortKey) =>
      k === "precoNf" ? precoNf(p) : val(p, k);
    return sortRows(base, sort, valEx);
  }, [clientes, busca, segmento, sort, precoNf]);

  const tot = filtrados.reduce(
    (a, c) => ({
      r: a.r + c.valor_realizado,
      p: a.p + c.valor_projetado,
      t: a.t + c.valor_previsto_ano,
    }),
    { r: 0, p: 0, t: 0 }
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/vendas">
          <ArrowLeft className="h-4 w-4" /> Planejamento
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Projeção de vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            Realizado (jan–jun) + projetado (jul–dez) por cliente · base do BI
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        <BuscaTabela
          value={busca}
          onChange={setBusca}
          placeholder="Buscar cliente, CNPJ, cidade…"
          id="projecao"
        />
        <Select value={segmento} onValueChange={setSegmento}>
          <SelectTrigger>
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segmentos.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum cliente na projeção. Importe a base do BI.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="nome" sort={sort} onSort={toggle}>
                    Cliente
                  </SortableHead>
                  <SortableHead
                    sortKey="segmento"
                    sort={sort}
                    onSort={toggle}
                    className="hidden sm:table-cell"
                  >
                    Segmento
                  </SortableHead>
                  <SortableHead
                    sortKey="realizado"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Realizado
                  </SortableHead>
                  <SortableHead
                    sortKey="projetado"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Projetado
                  </SortableHead>
                  <SortableHead
                    sortKey="previsto"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Previsto (ano)
                  </SortableHead>
                  <SortableHead
                    sortKey="precoNf"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="hidden text-right md:table-cell"
                  >
                    R$/t NF (real)
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.slice(0, 500).map((c) => (
                  <TableRow key={c.cnpj_digitos}>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate font-medium">
                        {c.nome ?? "—"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.cidade, fmtToneladas1(c.peso_previsto_ano) + " t"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {c.segmento ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtReais(c.valor_realizado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-primary">
                      {fmtReais(c.valor_projetado)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtReais(c.valor_previsto_ano)}
                    </TableCell>
                    <TableCell
                      className="hidden text-right tabular-nums text-amber-700 dark:text-amber-400 md:table-cell"
                      title="Preço efetivo médio das NFs recebidas (valor líquido ÷ toneladas)"
                    >
                      {precoNf(c) > 0 ? fmtReais(precoNf(c)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">
                    Total ({filtrados.length})
                  </TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtReais(tot.r)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtReais(tot.p)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtReais(tot.t)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell" />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
      {filtrados.length > 500 && (
        <p className="text-center text-xs text-muted-foreground">
          Exibindo os 500 maiores de {filtrados.length}. Refine pela busca/segmento.
        </p>
      )}
    </div>
  );
}
