"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Camera, Loader2, Package, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableHead,
  sortRows,
  useSort,
} from "@/components/ui/sortable-table";
import { getNFs } from "@/lib/supabase/nf";
import { getEmissores } from "@/lib/supabase/emissores";
import {
  PRODUTO_TIPOS,
  fmtReais,
  fmtReaisDec,
  fmtToneladas1,
  labelProduto,
} from "@/lib/utils/agregados";
import { cn } from "@/lib/utils";
import type { NotaFiscal } from "@/lib/supabase/types";

/** CIF (frete por conta do emitente) ou FOB (destinatário). */
function cifFob(v?: string | null): "CIF" | "FOB" | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes("emit") || s.trim() === "0") return "CIF";
  if (s.includes("dest") || s.trim() === "1") return "FOB";
  return null;
}

function precoInfo(nf: NotaFiscal) {
  const unit = nf.valor_unitario ?? 0;
  const calc =
    nf.quantidade_ton > 0 && (nf.valor_total ?? 0) > 0
      ? (nf.valor_total as number) / nf.quantidade_ton
      : 0;
  const diverge =
    unit > 0 && calc > 0 && Math.abs(unit - calc) / calc > 0.05;
  return { unit, calc, diverge };
}

type NFSortKey = "numero" | "emissor" | "data" | "produto" | "qtd" | "preco";

function nfSortValue(nf: NotaFiscal, key: NFSortKey): unknown {
  switch (key) {
    case "numero":
      return nf.numero_nf;
    case "emissor":
      return nf.emissor?.razao_social ?? "";
    case "data":
      return nf.data_emissao;
    case "produto":
      return labelProduto(nf.produto_tipo);
    case "qtd":
      return nf.quantidade_ton;
    case "preco": {
      const { unit, calc } = precoInfo(nf);
      return unit > 0 ? unit : calc;
    }
    default:
      return null;
  }
}

export default function NFListPage() {
  const router = useRouter();
  const [produto, setProduto] = React.useState("all");
  const [emissor, setEmissor] = React.useState("all");
  const [revisado, setRevisado] = React.useState("all");
  const [di, setDi] = React.useState("");
  const [df, setDf] = React.useState("");

  const { data: emissores } = useQuery({
    queryKey: ["emissores-all"],
    queryFn: () => getEmissores(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["nfs", produto, emissor, revisado, di, df],
    queryFn: () =>
      getNFs({
        produto_tipo: produto === "all" ? undefined : produto,
        emissor_id: emissor === "all" ? undefined : emissor,
        revisado: revisado === "all" ? undefined : revisado === "sim",
        data_inicio: di || undefined,
        data_fim: df || undefined,
      }),
  });

  const { sort, toggle } = useSort<NFSortKey>("data", "desc");
  const rows = sortRows(data?.data ?? [], sort, nfSortValue);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.count} NF(s)` : "Carregando…"} · duplo clique para
            editar
          </p>
        </div>
        <Link
          href="/produtos"
          className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Package className="h-4 w-4" /> Produtos
        </Link>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={emissor} onValueChange={setEmissor}>
            <SelectTrigger>
              <SelectValue placeholder="Produtor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtores</SelectItem>
              {(emissores ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={produto} onValueChange={setProduto}>
            <SelectTrigger>
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
          <Select value={revisado} onValueChange={setRevisado}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sim">Revisadas</SelectItem>
              <SelectItem value="nao">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={di}
            onChange={(e) => setDi(e.target.value)}
            aria-label="Data início"
          />
          <Input
            type="date"
            value={df}
            onChange={(e) => setDf(e.target.value)}
            aria-label="Data fim"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma NF encontrada. Toque no botão da câmera para capturar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="numero" sort={sort} onSort={toggle}>
                    NF
                  </SortableHead>
                  <SortableHead
                    sortKey="emissor"
                    sort={sort}
                    onSort={toggle}
                    className="hidden sm:table-cell"
                  >
                    Emissor
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
                  <SortableHead
                    sortKey="preco"
                    sort={sort}
                    onSort={toggle}
                    align="right"
                    className="text-right"
                  >
                    Preço R$/t
                  </SortableHead>
                  <TableHead className="hidden md:table-cell">Frete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((nf) => {
                  const { unit, calc, diverge } = precoInfo(nf);
                  const cf = cifFob(nf.frete_por_conta);
                  const temFrete = (nf.frete_valor ?? 0) > 0 || cf;
                  const rsTonKm =
                    (nf.frete_valor ?? 0) > 0 &&
                    nf.quantidade_ton > 0 &&
                    (nf.distancia_km ?? 0) > 0
                      ? (nf.frete_valor as number) /
                        (nf.quantidade_ton * (nf.distancia_km as number))
                      : 0;
                  return (
                    <TableRow
                      key={nf.id}
                      className="cursor-pointer"
                      onDoubleClick={() => router.push(`/nf/${nf.id}/editar`)}
                    >
                      <TableCell className="font-medium">
                        <Link href={`/nf/${nf.id}`} className="hover:underline">
                          {nf.numero_nf}
                          {nf.serie ? `/${nf.serie}` : ""}
                        </Link>
                        {!nf.revisado && (
                          <Badge variant="warning" className="ml-2 text-[10px]">
                            pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-[160px] truncate sm:table-cell">
                        {nf.emissor?.razao_social ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {nf.data_emissao}
                      </TableCell>
                      <TableCell>{labelProduto(nf.produto_tipo)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtToneladas1(nf.quantidade_ton)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          diverge && "font-semibold text-destructive"
                        )}
                        title={
                          diverge
                            ? `Divergência: total ÷ peso = ${fmtReais(
                                calc
                              )}/t`
                            : undefined
                        }
                      >
                        {unit > 0 ? fmtReais(unit) : calc > 0 ? fmtReais(calc) : "—"}
                        {diverge && " ⚠"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {temFrete ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {cf ?? "frete"}
                              {(nf.frete_valor ?? 0) > 0 &&
                                ` · ${fmtReais(nf.frete_valor)}`}
                            </span>
                            {rsTonKm > 0 && (
                              <span className="text-muted-foreground">
                                {fmtReaisDec(rsTonKm)}/t/km
                                {nf.distancia_km
                                  ? ` · ${nf.distancia_km} km`
                                  : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* FAB Nova NF */}
      <Link
        href="/nf/nova"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Nova NF"
      >
        <Camera className="h-6 w-6" />
      </Link>
    </div>
  );
}
