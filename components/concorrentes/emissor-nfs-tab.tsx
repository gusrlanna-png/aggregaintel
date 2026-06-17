"use client";

import * as React from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableHead,
  sortRows,
  useSort,
} from "@/components/ui/sortable-table";
import { PRODUTO_TIPOS, fmtToneladas1, labelProduto } from "@/lib/utils/agregados";
import type { NotaFiscal } from "@/lib/supabase/types";

type SortKey = "numero" | "data" | "produto" | "qtd";

function sortValue(nf: NotaFiscal, key: SortKey): unknown {
  switch (key) {
    case "numero":
      return nf.numero_nf;
    case "data":
      return nf.data_emissao;
    case "produto":
      return labelProduto(nf.produto_tipo);
    case "qtd":
      return nf.quantidade_ton;
    default:
      return null;
  }
}

/** Aba NF do produtor: filtros (nº, produto), ordenação e atalho p/ importar. */
export function EmissorNFsTab({
  nfs,
  emissorId,
}: {
  nfs: NotaFiscal[];
  emissorId: string;
}) {
  const [fNumero, setFNumero] = React.useState("");
  const [fProduto, setFProduto] = React.useState("all");
  const { sort, toggle } = useSort<SortKey>("data", "desc");

  const filtradas = React.useMemo(() => {
    const num = fNumero.trim();
    return nfs.filter((nf) => {
      if (num && !String(nf.numero_nf).includes(num.replace(/\D/g, "")))
        return false;
      if (fProduto !== "all" && nf.produto_tipo !== fProduto) return false;
      return true;
    });
  }, [nfs, fNumero, fProduto]);

  const rows = sortRows(filtradas, sort, sortValue);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={fNumero}
          onChange={(e) => setFNumero(e.target.value)}
          placeholder="Filtrar por nº da NF"
          inputMode="numeric"
          className="h-9 w-full sm:w-48"
        />
        <Select value={fProduto} onValueChange={setFProduto}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {PRODUTO_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {labelProduto(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          href={`/nf/nova?emissor=${emissorId}`}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Camera className="h-4 w-4" /> Importar NF
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {nfs.length === 0
                ? "Nenhuma NF capturada para este produtor."
                : "Nenhuma NF para os filtros selecionados."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="numero" sort={sort} onSort={toggle}>
                    NF
                  </SortableHead>
                  <SortableHead sortKey="data" sort={sort} onSort={toggle}>
                    Data
                  </SortableHead>
                  <SortableHead sortKey="produto" sort={sort} onSort={toggle}>
                    Produto
                  </SortableHead>
                  <SortableHead
                    sortKey="qtd"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Qtd (t)
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-medium">
                      <Link href={`/nf/${nf.id}`} className="hover:underline">
                        {nf.numero_nf}
                        {nf.serie ? `/${nf.serie}` : ""}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {nf.data_emissao}
                    </TableCell>
                    <TableCell>{labelProduto(nf.produto_tipo)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtToneladas1(nf.quantidade_ton)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
