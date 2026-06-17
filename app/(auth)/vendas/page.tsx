"use client";

import * as React from "react";
import Link from "next/link";
import { Database, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VendasHierarquia } from "@/components/vendas/vendas-hierarquia";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DIM_LABEL, ORDENS } from "@/lib/supabase/vendas";

const FONTES = [2026];

export default function VendasPage() {
  const [fonte, setFonte] = React.useState(2026);
  const [ordemKey, setOrdemKey] = React.useState("cliente");
  const ordem = ORDENS[ordemKey] ?? ORDENS.cliente;
  const primeiraCol = DIM_LABEL[ordem.dims[0]];

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-center">
          <Database className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Supabase não configurado</p>
          <p className="text-sm text-muted-foreground">
            O planejamento de vendas usa os dados sincronizados do sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Planejamento de vendas
          </h1>
          <p className="text-sm text-muted-foreground">
            Peso e preço de 2024, 2025 e meta. Clique nos títulos para ordenar.
            Fonte: META PREVISTA (integra sistema + meta).
          </p>
        </div>
        <Link
          href="/projecao"
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <TrendingUp className="h-4 w-4" /> Projeção
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Organizar por</Label>
          <Select value={ordemKey} onValueChange={setOrdemKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDENS).map(([k, o]) => (
                <SelectItem key={k} value={k}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Plano</Label>
          <Select value={String(fonte)} onValueChange={(v) => setFonte(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTES.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  Plano {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <VendasHierarquia
        key={ordemKey}
        fonte={fonte}
        dims={ordem.dims}
        primeiraColLabel={primeiraCol}
      />

      <p className="text-xs text-muted-foreground">
        Clique numa linha para expandir. Próximas evoluções: coluna “Projetado”
        (realizado + run-rate por dias úteis), edição de metas com redistribuição
        por sazonalidade e linha de concorrente por cliente. Ajustes em{" "}
        <Link href="/configuracoes/integracao" className="text-primary hover:underline">
          Integração
        </Link>
        .
      </p>
    </div>
  );
}
