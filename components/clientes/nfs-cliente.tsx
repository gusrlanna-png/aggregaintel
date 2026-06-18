"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNFsCliente } from "@/lib/supabase/nf";
import {
  fmtReais,
  fmtToneladas1,
  labelProduto,
  precoEfetivoMedioGeral,
  precoEfetivoTon,
  temDescontoNota,
} from "@/lib/utils/agregados";

/**
 * Histórico de NFs recebidas pelo cliente = volume CONFIRMADO (fonte real),
 * complementando a projeção estimada no planejamento.
 */
export function NfsCliente({ clienteId }: { clienteId: string }) {
  const { data: nfs = [] } = useQuery({
    queryKey: ["nfs-cliente", clienteId],
    queryFn: () => getNFsCliente(clienteId),
  });

  const totalTon = nfs.reduce((s, n) => s + (n.quantidade_ton || 0), 0);
  const precoEfetivoMedio = React.useMemo(() => precoEfetivoMedioGeral(nfs), [nfs]);
  // Volume confirmado por ano (para o planejamento).
  const porAno = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nfs) {
      const ano = (n.data_emissao ?? "").slice(0, 4) || "—";
      m.set(ano, (m.get(ano) ?? 0) + (n.quantidade_ton || 0));
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [nfs]);

  if (nfs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Volume confirmado (NFs recebidas)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {fmtToneladas1(totalTon)} t confirmadas · {nfs.length} NF(s)
          </span>
          {precoEfetivoMedio > 0 && (
            <span
              className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              title="Preço efetivo médio (valor líquido das notas ÷ toneladas), ponderado pelo volume"
            >
              {fmtReais(precoEfetivoMedio)}/t efetivo
            </span>
          )}
          {porAno.map(([ano, t]) => (
            <span key={ano} className="rounded-md bg-muted px-2.5 py-1 text-xs tabular-nums">
              {ano}: {fmtToneladas1(t)} t
            </span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Dados reais das notas fiscais (fonte verdadeira), usados como base
          confirmada no planejamento — distintos da projeção estimada.
        </p>

        <div className="divide-y rounded-md border">
          {nfs.slice(0, 12).map((n) => (
            <Link
              key={n.id}
              href={`/nf/${n.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {n.numero_nf}
                {n.serie ? `/${n.serie}` : ""} · {labelProduto(n.produto_tipo)}
                <span className="text-xs text-muted-foreground">
                  {" "}· {n.emissor?.razao_social ?? "—"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{n.data_emissao}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block">{fmtToneladas1(n.quantidade_ton)} t</span>
                {precoEfetivoTon(n) > 0 && (
                  <span
                    className={
                      temDescontoNota(n)
                        ? "block text-[10px] text-amber-700 dark:text-amber-400"
                        : "block text-[10px] text-muted-foreground"
                    }
                    title={temDescontoNota(n) ? "Preço efetivo (com desconto em nota)" : "Preço efetivo"}
                  >
                    {fmtReais(precoEfetivoTon(n))}/t{temDescontoNota(n) ? " ↓" : ""}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
        {nfs.length > 12 && (
          <p className="text-xs text-muted-foreground">… e mais {nfs.length - 12} NF(s).</p>
        )}
      </CardContent>
    </Card>
  );
}
