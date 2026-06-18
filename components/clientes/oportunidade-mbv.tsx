"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MBV,
  fmtReais,
  fmtToneladas1,
  labelProduto,
  precoMedio,
} from "@/lib/utils/agregados";
import type { MixRow } from "./fornecedor-mix";

export interface OportunidadeLinha {
  produto: string;
  total_ton: number;
  mbv_ton: number;
  oportunidade_ton: number;
  oportunidade_rs: number;
}

export function calcOportunidade(
  consumo: Record<string, number>,
  mix: MixRow[],
  /** Preço efetivo real (R$/t) por tipo de produto vindo das NFs do cliente.
   *  Quando há valor para o produto, usa-o; senão cai no preço tabelado. */
  precosEfetivos?: Record<string, number>
): { linhas: OportunidadeLinha[]; totalTon: number; oportunidadeTon: number; oportunidadeRs: number } {
  const linhas: OportunidadeLinha[] = Object.entries(consumo).map(
    ([produto, total_ton]) => {
      const mbvPct =
        mix
          .filter(
            (m) =>
              m.produto_tipo === produto &&
              (m.nome_fornecedor === MBV.razao ||
                m.nome_fornecedor.toLowerCase().includes("mbv"))
          )
          .reduce((s, m) => s + m.share_pct, 0) / 100;
      const mbv_ton = total_ton * Math.min(mbvPct, 1);
      const oportunidade_ton = Math.max(0, total_ton - mbv_ton);
      const preco =
        precosEfetivos && precosEfetivos[produto] > 0
          ? precosEfetivos[produto]
          : precoMedio(produto);
      return {
        produto,
        total_ton,
        mbv_ton,
        oportunidade_ton,
        oportunidade_rs: oportunidade_ton * preco,
      };
    }
  );

  const totalTon = linhas.reduce((s, l) => s + l.total_ton, 0);
  const oportunidadeTon = linhas.reduce((s, l) => s + l.oportunidade_ton, 0);
  const oportunidadeRs = linhas.reduce((s, l) => s + l.oportunidade_rs, 0);
  return { linhas, totalTon, oportunidadeTon, oportunidadeRs };
}

export function OportunidadeMBV({
  consumo,
  mix,
  precosEfetivos,
}: {
  consumo: Record<string, number>;
  mix: MixRow[];
  precosEfetivos?: Record<string, number>;
}) {
  const { linhas, oportunidadeTon, oportunidadeRs } = calcOportunidade(
    consumo,
    mix,
    precosEfetivos
  );
  const temEfetivo = !!precosEfetivos && Object.keys(precosEfetivos).length > 0;

  if (linhas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure o consumo (calculadora de traço) para ver a oportunidade.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Oportunidade MBV</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary">
              {fmtToneladas1(oportunidadeTon)} t/mês
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Potencial de receita</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {fmtReais(oportunidadeRs)}/mês
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {temEfetivo ? "preço efetivo das NFs" : "preço de referência"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">MBV</TableHead>
                <TableHead className="text-right">Oportunidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.produto}>
                  <TableCell className="font-medium">
                    {labelProduto(l.produto)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtToneladas1(l.total_ton)} t
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="success" className="tabular-nums">
                      {fmtToneladas1(l.mbv_ton)} t
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="warning" className="tabular-nums">
                      {fmtToneladas1(l.oportunidade_ton)} t
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
