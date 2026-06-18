"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getRankingProducao } from "@/lib/supabase/emissores";
import { fmtToneladas1 } from "@/lib/utils/agregados";
import { mascararCnpj } from "@/lib/utils/cnpj";
import { MESES_LABEL } from "@/lib/utils/sazonalidade";

const AGORA = new Date();

export default function RankingPage() {
  const [ano, setAno] = React.useState(AGORA.getFullYear());
  const [periodo, setPeriodo] = React.useState<string>(String(AGORA.getMonth() + 1)); // "anual" | "1".."12"

  const mes = periodo === "anual" ? null : Number(periodo);
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking-producao", ano, periodo],
    queryFn: () => getRankingProducao(ano, mes, 20),
  });

  const anos = Array.from({ length: 4 }, (_, i) => AGORA.getFullYear() - i);
  const total = ranking.reduce((s, r) => s + r.volume, 0);

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Top 20 produtores</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Ranking por produção. Escolha o período: mês específico (volumes mensais salvos)
        ou anual (projeção total).
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anual">Anual (total)</SelectItem>
                {MESES_LABEL.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {ranking.length > 0 && (
            <span className="ml-auto text-sm text-muted-foreground">
              Total top 20: <strong className="text-foreground">{fmtToneladas1(total)} t</strong>
            </span>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ranking.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {mes
            ? `Sem volumes mensais salvos para ${MESES_LABEL[(mes ?? 1) - 1]}/${ano}. Defina os volumes mensais na aba Produção de cada produtor, ou use o período Anual.`
            : "Sem projeções de produção. Capture NFs e salve projeções nos produtores."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {ranking.map((r, i) => (
              <Link
                key={r.emissor.id}
                href={`/concorrentes/${r.emissor.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.emissor.razao_social}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.emissor.cnpj ? mascararCnpj(r.emissor.cnpj) : null, [r.emissor.municipio, r.emissor.uf].filter(Boolean).join("/")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-semibold">{fmtToneladas1(r.volume)} t</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
