"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCfem } from "@/lib/supabase/cfem";
import { COR_PRIMARIA, fmtNumero, fmtReais } from "@/lib/utils/agregados";

export default function CfemPage() {
  const [busca, setBusca] = React.useState("");
  const [syncing, setSyncing] = React.useState(false);

  const { data: cfem } = useQuery({
    queryKey: ["cfem"],
    queryFn: () => getCfem(),
  });
  const lista = cfem ?? [];

  const rows = lista.filter(
    (c) =>
      !busca ||
      c.razao_titular?.toLowerCase().includes(busca.toLowerCase()) ||
      c.municipio?.toLowerCase().includes(busca.toLowerCase())
  );

  const top = [...lista]
    .sort((a, b) => (b.cfem_ultimo ?? 0) - (a.cfem_ultimo ?? 0))
    .slice(0, 10)
    .map((c) => ({
      nome: (c.razao_titular ?? "").split(" ").slice(0, 2).join(" "),
      valor: c.cfem_ultimo ?? 0,
    }));

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/cfem/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) toast.success(json.message ?? "Sincronização disparada.");
      else toast.warning(json.message ?? "n8n não configurado.");
    } catch {
      toast.error("Falha ao disparar sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CFEM / ANM</h1>
          <p className="text-sm text-muted-foreground">
            Compensação financeira por exploração mineral
          </p>
        </div>
        <Button onClick={sync} disabled={syncing} size="sm">
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 — CFEM no último mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={top}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(v) => fmtNumero(v)} fontSize={11} />
              <YAxis
                type="category"
                dataKey="nome"
                width={90}
                fontSize={11}
              />
              <Tooltip formatter={(v) => fmtReais(Number(v))} />
              <Bar dataKey="valor" fill={COR_PRIMARIA} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Input
        placeholder="Buscar titular ou município…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titular</TableHead>
                <TableHead className="hidden sm:table-cell">Município</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Recolh.
                </TableHead>
                <TableHead className="text-right">Último</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.razao_titular}
                    <span className="block text-xs text-muted-foreground">
                      {c.cnpj_titular}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {c.municipio}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtReais(c.cfem_acumulado)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {c.n_recolhimentos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtReais(c.cfem_ultimo)}
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
