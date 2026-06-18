"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SlidersHorizontal } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcOportunidade } from "@/components/clientes/oportunidade-mbv";
import type { MixRow } from "@/components/clientes/fornecedor-mix";
import {
  MESES_LABEL,
  getSazonalidade,
  normalizar,
} from "@/lib/utils/sazonalidade";
import {
  COR_PRIMARIA,
  SEGMENTOS,
  fmtPct,
  fmtReais,
  fmtToneladas1,
  type Segmento,
} from "@/lib/utils/agregados";

export function DistribuicaoMensal({
  consumoAnual,
  mix,
  segmento,
  ano,
  precosEfetivos,
}: {
  consumoAnual: Record<string, number>;
  mix: MixRow[];
  segmento: string;
  ano: number;
  precosEfetivos?: Record<string, number>;
}) {
  const { totalTon, oportunidadeTon, oportunidadeRs } = calcOportunidade(
    consumoAnual,
    mix,
    precosEfetivos
  );

  if (totalTon <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure o consumo (calculadora de traço) para ver a distribuição
        mensal.
      </p>
    );
  }

  // Sazonalidade do SEGMENTO do cliente (fallback: geral / padrão).
  const saz = normalizar(getSazonalidade(ano, segmento));
  const segLabel = SEGMENTOS[segmento as Segmento]?.label ?? segmento;

  const meses = saz.map((s, i) => ({
    mes: MESES_LABEL[i],
    sazon: s,
    consumo: totalTon * s,
    oport: oportunidadeTon * s,
    rs: oportunidadeRs * s,
  }));

  const chartData = meses.map((m) => ({
    mes: m.mes,
    Consumo: +m.consumo.toFixed(1),
    Oportunidade: +m.oport.toFixed(1),
  }));

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Distribuído pela sazonalidade do segmento{" "}
              <strong>{segLabel}</strong> ({ano})
            </p>
            <Link
              href="/configuracoes/sazonalidade"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> editar
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => `${fmtToneladas1(Number(v))} t`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Consumo" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar
                dataKey="Oportunidade"
                fill={COR_PRIMARIA}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Sazon.</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Oportun.</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  R$/mês
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{m.mes}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtPct(m.sazon * 100)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtToneladas1(m.consumo)} t
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-primary">
                    {fmtToneladas1(m.oport)} t
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {fmtReais(m.rs)}
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
