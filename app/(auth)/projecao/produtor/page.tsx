"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Factory, Loader2 } from "lucide-react";

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
import { SortableHead, sortRows, useSort } from "@/components/ui/sortable-table";
import { BuscaTabela, matchBusca } from "@/components/ui/busca-tabela";
import { Button } from "@/components/ui/button";
import {
  getRealizadoEmissores,
  type RealizadoEmissor,
} from "@/lib/supabase/projecao";
import { fmtReais, fmtToneladas1 } from "@/lib/utils/agregados";

type SortKey =
  | "nome"
  | "municipio"
  | "ton"
  | "faturamento"
  | "preco"
  | "nfs"
  | "ultima";

function val(p: RealizadoEmissor, k: SortKey): unknown {
  switch (k) {
    case "nome":
      return p.razao_social ?? "";
    case "municipio":
      return p.municipio ?? "";
    case "ton":
      return p.ton;
    case "faturamento":
      return p.faturamento;
    case "preco":
      return p.preco_efetivo ?? 0;
    case "nfs":
      return p.nfs;
    case "ultima":
      return p.ultima ?? "";
    default:
      return null;
  }
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const ANO_ATUAL = 2026;
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2];

export default function ProjecaoProdutorPage() {
  const [busca, setBusca] = React.useState("");
  const [ano, setAno] = React.useState("all");
  const [aberto, setAberto] = React.useState<string | null>(null);
  const { sort, toggle } = useSort<SortKey>("ton", "desc");

  const { data: produtores = [], isLoading } = useQuery({
    queryKey: ["realizado-emissor", ano],
    queryFn: () => getRealizadoEmissores(ano === "all" ? undefined : Number(ano)),
  });

  const filtrados = React.useMemo(() => {
    const base = produtores.filter((p) =>
      matchBusca(busca, p.razao_social, p.cnpj, p.municipio)
    );
    return sortRows(base, sort, val);
  }, [produtores, busca, sort]);

  const tot = filtrados.reduce(
    (a, p) => ({ ton: a.ton + p.ton, fat: a.fat + p.faturamento, nfs: a.nfs + p.nfs }),
    { ton: 0, fat: 0, nfs: 0 }
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/projecao">
          <ArrowLeft className="h-4 w-4" /> Projeção
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Factory className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Realizado por produtor
          </h1>
          <p className="text-sm text-muted-foreground">
            Volume, faturamento e preço efetivo (R$/t) a partir das NFs reais
            importadas. Clique numa linha para ver o volume mês a mês.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BuscaTabela
          value={busca}
          onChange={setBusca}
          placeholder="Buscar produtor, CNPJ, cidade…"
          id="realizado-produtor"
        />
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {ANOS.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
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
              Nenhuma NF importada para o período. Importe em{" "}
              <Link
                href="/configuracoes/fontes"
                className="text-primary hover:underline"
              >
                Fontes de dados
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="nome" sort={sort} onSort={toggle}>
                    Produtor
                  </SortableHead>
                  <SortableHead
                    sortKey="ton"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Volume (t)
                  </SortableHead>
                  <SortableHead
                    sortKey="faturamento"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="hidden text-right sm:table-cell"
                  >
                    Faturamento
                  </SortableHead>
                  <SortableHead
                    sortKey="preco"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    R$/t
                  </SortableHead>
                  <SortableHead
                    sortKey="nfs"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="hidden text-right md:table-cell"
                  >
                    NFs
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.slice(0, 500).map((p) => (
                  <React.Fragment key={p.emissor_id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setAberto(aberto === p.emissor_id ? null : p.emissor_id)
                      }
                    >
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate font-medium">
                          {p.razao_social ?? "—"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.municipio ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtToneladas1(p.ton)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {fmtReais(p.faturamento)}
                      </TableCell>
                      <TableCell
                        className="text-right tabular-nums text-amber-700 dark:text-amber-400"
                        title="Preço efetivo médio (faturamento ÷ toneladas)"
                      >
                        {p.preco_efetivo ? fmtReais(p.preco_efetivo) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                        {p.nfs}
                      </TableCell>
                    </TableRow>
                    {aberto === p.emissor_id && (
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={5} className="p-3">
                          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                            {MESES.map((m, i) => {
                              const chave = String(i + 1).padStart(2, "0");
                              const v = p.por_mes?.[chave] ?? 0;
                              return (
                                <div key={m} className="text-center">
                                  <div className="text-[10px] uppercase text-muted-foreground">
                                    {m}
                                  </div>
                                  <div className="text-xs font-medium tabular-nums">
                                    {v ? fmtToneladas1(v) : "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {p.primeira && p.ultima
                              ? `NFs de ${p.primeira.split("-").reverse().join("/")} a ${p.ultima
                                  .split("-")
                                  .reverse()
                                  .join("/")}`
                              : ""}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">
                    Total ({filtrados.length})
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtToneladas1(tot.ton)}
                  </TableCell>
                  <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">
                    {fmtReais(tot.fat)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {tot.ton > 0 ? fmtReais(tot.fat / tot.ton) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right font-semibold tabular-nums md:table-cell">
                    {tot.nfs}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
      {filtrados.length > 500 && (
        <p className="text-center text-xs text-muted-foreground">
          Exibindo os 500 maiores de {filtrados.length}. Refine pela busca.
        </p>
      )}
    </div>
  );
}
