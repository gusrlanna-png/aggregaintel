"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  FileText,
  Loader2,
  PieChart as PieIcon,
  TrendingUp,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MarketShareLine,
  MarketSharePie,
  type ShareSlice,
} from "@/components/charts/market-share-chart";
import {
  RankingProducoes,
  type RankingRow,
} from "@/components/charts/ranking-producoes";
import { AlertasFeed } from "@/components/dashboard/alertas-feed";
import { getProjecaoResumo } from "@/lib/supabase/emissores";
import { countNFsMesAtual } from "@/lib/supabase/nf";
import { getIntel } from "@/lib/supabase/intel";
import { getMarketShare } from "@/lib/supabase/marketshare";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isMbvEmissor, fmtNumero, fmtPct, fmtTon } from "@/lib/utils/agregados";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [resumo, nfsMes, intel, marketShare] = await Promise.all([
        getProjecaoResumo(),
        countNFsMesAtual(),
        getIntel(),
        getMarketShare(),
      ]);
      return { resumo, nfsMes, intel, marketShare };
    },
  });

  const resumo = data?.resumo ?? [];

  const ranking: RankingRow[] = resumo.map((r) => ({
    emissor: r.emissor,
    volume: r.volume,
    ic: r.ic,
  }));

  const pieData: ShareSlice[] = resumo
    .filter((r) => r.volume > 0)
    .slice(0, 6)
    .map((r) => ({
      name: r.emissor.razao_social.split(" ").slice(0, 2).join(" "),
      volume: r.volume,
      isMbv: isMbvEmissor(r.emissor),
    }));

  const volumeTotal = resumo.reduce((s, r) => s + r.volume, 0);
  const nossas = resumo.filter((r) => isMbvEmissor(r.emissor));
  const nossaVolume = nossas.reduce((s, r) => s + r.volume, 0);
  const sharePct = volumeTotal ? (nossaVolume / volumeTotal) * 100 : 0;
  // Rótulo dinâmico da "nossa empresa" (produtor marcado em Mercado).
  const nossaLabel =
    nossas.length === 1
      ? nossas[0].emissor.razao_social.split(" ").slice(0, 2).join(" ")
      : nossas.length > 1
        ? "nossas empresas"
        : "nossa empresa";

  const shareLine = (data?.marketShare ?? []).map((m) => ({
    mes: m.mes_ref.slice(5),
    share: m.mbv_share_pct ?? 0,
  }));

  const alertas = (data?.intel ?? []).filter(
    (i) => i.classificacao === "alerta" || i.tags?.includes("novo-emissor")
  );

  const vazio = !isLoading && resumo.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do mercado de agregados —{" "}
          {isSupabaseConfigured() ? "dados ao vivo" : "armazenamento local"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={PieIcon}
              label="Market share"
              value={fmtPct(sharePct)}
              hint={
                nossas.length ? nossaLabel : "marque sua empresa em Mercado"
              }
            />
            <StatCard
              icon={TrendingUp}
              label="Mercado total"
              value={fmtTon(volumeTotal)}
              hint="produção estimada"
            />
            <StatCard
              icon={FileText}
              label="NFs no mês"
              value={fmtNumero(data?.nfsMes ?? 0)}
              hint="capturadas"
            />
            <StatCard
              icon={Activity}
              label="Alertas ativos"
              value={fmtNumero(alertas.length)}
              hint="inteligência"
            />
          </div>

          {vazio ? (
            <Card>
              <CardContent className="space-y-2 p-8 text-center">
                <p className="font-medium">Nenhum dado ainda</p>
                <p className="text-sm text-muted-foreground">
                  Cadastre produtores em <strong>Mercado</strong> e capture
                  notas fiscais em <strong>NFs</strong> para começar a ver
                  projeções, market share e oportunidades.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Participação por produtor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarketSharePie data={pieData} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Evolução do market share — {nossaLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarketShareLine data={shareLine} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4" />
                    Ranking de produção estimada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingProducoes rows={ranking} />
                </CardContent>
              </Card>
            </>
          )}

          {alertas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alertas recentes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <AlertasFeed items={alertas} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
