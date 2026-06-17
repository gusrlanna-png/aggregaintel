"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapaLocais, type LocalPonto } from "@/components/maps/mapa-locais";
import { getEmissores, getProjecaoResumo } from "@/lib/supabase/emissores";
import { getMarketShare } from "@/lib/supabase/marketshare";
import { COR_PRIMARIA, isMbvEmissor, fmtTon } from "@/lib/utils/agregados";

export default function MercadoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["mercado"],
    queryFn: async () => {
      const [emissores, resumo, marketShare] = await Promise.all([
        getEmissores(),
        getProjecaoResumo(),
        getMarketShare(),
      ]);
      return { emissores, resumo, marketShare };
    },
  });

  const resumo = data?.resumo ?? [];
  const volumeById = new Map(resumo.map((r) => [r.emissor.id, r.volume]));

  const pontos: LocalPonto[] = (data?.emissores ?? []).map((e) => ({
    id: e.id,
    nome: e.razao_social,
    lat: e.lat,
    lng: e.lng,
    detalhe: `${e.municipio ?? ""} · ${fmtTon(volumeById.get(e.id) ?? 0)}`,
    destaque: isMbvEmissor(e),
  }));

  // Volume por município
  const porMunicipio = new Map<string, number>();
  for (const r of resumo) {
    const m = r.emissor.municipio ?? "—";
    porMunicipio.set(m, (porMunicipio.get(m) ?? 0) + r.volume);
  }
  const municipios = Array.from(porMunicipio.entries())
    .map(([municipio, volume]) => ({ municipio, volume }))
    .sort((a, b) => b.volume - a.volume);

  const historico = (data?.marketShare ?? []).map((m) => ({
    mes: m.mes_ref.slice(5),
    mercado: m.mercado_total_ton ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Análise de mercado</h1>
        <p className="text-sm text-muted-foreground">
          Distribuição geográfica e evolução do mercado de agregados
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapa de produtores</CardTitle>
            </CardHeader>
            <CardContent>
              <MapaLocais pontos={pontos} altura={300} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volume por município</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {municipios.map((m) => {
                  const max = municipios[0]?.volume || 1;
                  return (
                    <div key={m.municipio}>
                      <div className="flex justify-between text-sm">
                        <span>{m.municipio}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtTon(m.volume)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(m.volume / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Evolução do mercado total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={historico}
                    margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COR_PRIMARIA} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COR_PRIMARIA} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v) => fmtTon(Number(v))} />
                    <Area
                      type="monotone"
                      dataKey="mercado"
                      stroke={COR_PRIMARIA}
                      strokeWidth={2}
                      fill="url(#g)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
