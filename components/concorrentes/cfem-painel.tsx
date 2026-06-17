"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCfemProjecao,
  getCfemTitulos,
  getCfemTituloMensal,
  getPrecoMercado,
  getTitulosMinerarios,
} from "@/lib/supabase/cfem";
import { fmtNumero, fmtReais } from "@/lib/utils/agregados";
import { MESES_LABEL } from "@/lib/utils/sazonalidade";

const fmtK = (n: number) =>
  !n ? "—" : n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : n.toFixed(0);
const mesCurto = (ano: number, mes: number) =>
  `${MESES_LABEL[mes - 1]}/${String(ano).slice(2)}`;

export function CfemPainel({ cnpj }: { cnpj?: string | null }) {
  const { data: titulos, isLoading: loadingT } = useQuery({
    queryKey: ["cfem-titulos", cnpj],
    queryFn: () => getCfemTitulos(cnpj),
  });
  const { data: projecao, isLoading: loadingP } = useQuery({
    queryKey: ["cfem-projecao", cnpj],
    queryFn: () => getCfemProjecao(cnpj, 1), // faturamento independe do preço
  });
  const { data: precoMercado } = useQuery({
    queryKey: ["preco-mercado"],
    queryFn: getPrecoMercado,
  });
  const { data: abertura } = useQuery({
    queryKey: ["cfem-abertura", cnpj],
    queryFn: () => getCfemTituloMensal(cnpj),
  });
  const { data: sigmine } = useQuery({
    queryKey: ["titulos-sigmine", cnpj],
    queryFn: () => getTitulosMinerarios(cnpj),
  });

  // Pivot título × mês (últimos 14 meses) — abre a variação por título.
  const pivot = React.useMemo(() => {
    const rows = abertura ?? [];
    const mesesMap = new Map<string, { ano: number; mes: number }>();
    const titMap = new Map<
      string,
      { processo: string; substancia: string; total: number }
    >();
    const mapa = new Map<string, number>();
    for (const r of rows) {
      const mk = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
      mesesMap.set(mk, { ano: r.ano, mes: r.mes });
      const t = titMap.get(r.processo) ?? {
        processo: r.processo,
        substancia: r.substancia,
        total: 0,
      };
      t.total += r.valor;
      titMap.set(r.processo, t);
      mapa.set(`${r.processo}|${mk}`, (mapa.get(`${r.processo}|${mk}`) ?? 0) + r.valor);
    }
    const meses = Array.from(mesesMap.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 14)
      .reverse()
      .map(([key, v]) => ({ key, ...v }));
    const titulos = Array.from(titMap.values()).sort((a, b) => b.total - a.total);
    // Por título: primeiro/último mês declarado, média e "buracos" (meses
    // internos sem declaração = título ativo que não lançou no período).
    const titMeta = new Map<
      string,
      { first: number; last: number; mean: number; gaps: number }
    >();
    let gapsTotal = 0;
    for (const t of titulos) {
      let first = -1;
      let last = -1;
      let soma = 0;
      let cnt = 0;
      meses.forEach((m, idx) => {
        const v = mapa.get(`${t.processo}|${m.key}`) ?? 0;
        if (v > 0) {
          if (first < 0) first = idx;
          last = idx;
          soma += v;
          cnt++;
        }
      });
      const mean = cnt ? soma / cnt : 0;
      let gaps = 0;
      meses.forEach((m, idx) => {
        const v = mapa.get(`${t.processo}|${m.key}`) ?? 0;
        if (v === 0 && idx > first && idx < last) gaps++;
      });
      gapsTotal += gaps;
      titMeta.set(t.processo, { first, last, mean, gaps });
    }
    return { meses, titulos, mapa, titMeta, gapsTotal };
  }, [abertura]);

  const [estimar, setEstimar] = React.useState(false);
  const ehGap = (processo: string, idx: number, v: number) => {
    const meta = pivot.titMeta.get(processo);
    return v === 0 && !!meta && idx > meta.first && idx < meta.last;
  };
  const totaisMes = React.useMemo(
    () =>
      pivot.meses.map((m, idx) =>
        pivot.titulos.reduce((s, t) => {
          const v = pivot.mapa.get(`${t.processo}|${m.key}`) ?? 0;
          if (v > 0) return s + v;
          if (estimar && ehGap(t.processo, idx, v))
            return s + (pivot.titMeta.get(t.processo)?.mean ?? 0);
          return s;
        }, 0)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivot, estimar]
  );

  // Preço médio: automático (mercado) com override manual.
  const [precoManual, setPrecoManual] = React.useState<string>("");
  const precoAuto = precoMercado ?? 50;
  const preco = precoManual.trim() ? Number(precoManual) || 0 : precoAuto;

  const linhas = React.useMemo(
    () =>
      (projecao ?? [])
        .slice()
        .sort((a, b) => b.ano - a.ano || b.mes - a.mes)
        .map((r) => ({
          ...r,
          toneladas: preco > 0 ? Math.round(r.faturamento / preco) : null,
        })),
    [projecao, preco]
  );

  const totFat = linhas.reduce((s, r) => s + r.faturamento, 0);
  const totTon = preco > 0 ? Math.round(totFat / preco) : null;

  if (loadingT || loadingP) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if ((titulos ?? []).length === 0 && (projecao ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum registro de CFEM/ANM encontrado para o CNPJ {cnpj ?? "—"} (busca
          pela raiz do CNPJ).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Licenciamento — SIGMINE/ANM */}
      {sigmine && sigmine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Licenciamento — títulos minerários ({sigmine.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Substância</TableHead>
                  <TableHead className="text-right">Área (ha)</TableHead>
                  <TableHead>Último evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sigmine.map((t) => (
                  <TableRow key={`${t.numero}-${t.ano}`}>
                    <TableCell className="font-medium">{t.processo}</TableCell>
                    <TableCell>{t.fase ?? "—"}</TableCell>
                    <TableCell>{t.substancia ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.area_ha != null ? fmtNumero(t.area_ha) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {t.ult_evento ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Títulos / processos minerários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Títulos minerários ({titulos?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Substância</TableHead>
                <TableHead>Município</TableHead>
                <TableHead className="text-right">CFEM total</TableHead>
                <TableHead className="text-right">Último</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(titulos ?? []).map((t) => (
                <TableRow key={`${t.cpf_cnpj}-${t.processo}-${t.substancia}`}>
                  <TableCell className="font-medium">{t.processo}</TableCell>
                  <TableCell>{t.substancia}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.municipio ?? "—"}/{t.uf ?? ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtReais(t.cfem_total)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {t.ultimo_mes ? t.ultimo_mes.slice(0, 7) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Abertura mensal do CFEM por título */}
      {pivot.titulos.length > 0 && pivot.meses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Abertura mensal do CFEM por título (R$)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Cada título declara separadamente. Células{" "}
                <span className="rounded bg-amber-100 px-1 text-amber-700">
                  em âmbar
                </span>{" "}
                = mês incompleto (título ativo sem declaração no período).
                {pivot.gapsTotal > 0 && (
                  <strong className="ml-1 text-amber-700">
                    {pivot.gapsTotal} mês(es) incompleto(s).
                  </strong>
                )}
              </p>
              {pivot.gapsTotal > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={estimar}
                    onChange={(e) => setEstimar(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Estimar (média do título)
                </label>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 bg-background py-2 pr-2 text-left font-semibold">
                      Título
                    </th>
                    {pivot.meses.map((m) => (
                      <th
                        key={m.key}
                        className="px-2 py-2 text-right font-semibold tabular-nums"
                      >
                        {mesCurto(m.ano, m.mes)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivot.titulos.map((t) => (
                    <tr key={t.processo} className="border-b">
                      <td className="sticky left-0 bg-background py-1.5 pr-2 font-medium">
                        {t.processo}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {t.substancia}
                        </span>
                      </td>
                      {pivot.meses.map((m, idx) => {
                        const v = pivot.mapa.get(`${t.processo}|${m.key}`) ?? 0;
                        const gap = ehGap(t.processo, idx, v);
                        const mean = pivot.titMeta.get(t.processo)?.mean ?? 0;
                        return (
                          <td
                            key={m.key}
                            title={
                              gap
                                ? "Mês incompleto — título ativo sem declaração"
                                : undefined
                            }
                            className={`px-2 py-1.5 text-right tabular-nums ${
                              gap
                                ? "bg-amber-100 text-amber-700"
                                : v
                                  ? ""
                                  : "text-muted-foreground"
                            }`}
                          >
                            {gap
                              ? estimar
                                ? `~${fmtK(mean)}`
                                : "⚠"
                              : fmtK(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="sticky left-0 bg-muted/40 py-1.5 pr-2">
                      Total{estimar ? " (c/ estimativa)" : ""}
                    </td>
                    {totaisMes.map((v, i) => (
                      <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                        {fmtK(v)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projeção cruzada CFEM → faturamento → toneladas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Faturamento e volume projetados (via CFEM)</span>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Preço R$/t</Label>
              <Input
                type="number"
                value={precoManual}
                placeholder={String(precoAuto)}
                onChange={(e) => setPrecoManual(e.target.value)}
                className="h-8 w-24 text-right"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Faturamento = CFEM ÷ alíquota da substância. Toneladas = faturamento ÷
            preço médio (auto do planejamento:{" "}
            <strong>{fmtReais(precoAuto)}/t</strong>; edite ao lado para sobrepor).
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">CFEM</TableHead>
                  <TableHead className="text-right">Faturamento est.</TableHead>
                  <TableHead className="text-right">Toneladas est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.slice(0, 24).map((r) => (
                  <TableRow key={`${r.ano}-${r.mes}`}>
                    <TableCell className="font-medium">
                      {MESES_LABEL[r.mes - 1]}/{r.ano}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtReais(r.cfem)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtReais(r.faturamento)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {r.toneladas != null ? `${fmtNumero(r.toneladas)} t` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total ({linhas.length} meses)</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtReais(linhas.reduce((s, r) => s + r.cfem, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtReais(totFat)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totTon != null ? `${fmtNumero(totTon)} t` : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
