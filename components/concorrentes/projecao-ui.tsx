"use client";

import * as React from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { calcProjecao, projetarSazonal } from "@/lib/utils/projecao";
import { getSazonalidade, MESES_LABEL } from "@/lib/utils/sazonalidade";
import {
  getProjecaoMensal,
  saveProjecao,
  saveProjecaoMensal,
} from "@/lib/supabase/projecao";
import {
  COR_PRIMARIA,
  fmtNumero,
  fmtPct,
  fmtTon,
  fmtToneladas1,
} from "@/lib/utils/agregados";
import type { NotaFiscal } from "@/lib/supabase/types";

type Granularidade = "diaria" | "mensal" | "anual";

/** Parse de data sem deslocamento de fuso: "YYYY-MM-DD" vira data local. */
function dataLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

interface SerieGroup {
  serie: string;
  nfs: { numero: number; data: Date; quantidade_ton: number }[];
}

export function ProjecaoUI({
  emissorId,
  nfs,
}: {
  emissorId: string;
  nfs: NotaFiscal[];
}) {
  const series: SerieGroup[] = React.useMemo(() => {
    const map = new Map<string, SerieGroup>();
    for (const nf of nfs) {
      const key = nf.serie ?? "—";
      if (!map.has(key)) map.set(key, { serie: key, nfs: [] });
      map.get(key)!.nfs.push({
        numero: nf.numero_nf,
        data: dataLocal(nf.data_emissao),
        quantidade_ton: nf.quantidade_ton,
      });
    }
    return Array.from(map.values()).filter((g) => g.nfs.length >= 1);
  }, [nfs]);

  const [serie, setSerie] = React.useState(series[0]?.serie ?? "—");
  const grupo = series.find((s) => s.serie === serie) ?? series[0];

  const pesoSugerido = React.useMemo(() => {
    if (!grupo?.nfs.length) return 28;
    return (
      grupo.nfs.reduce((s, n) => s + n.quantidade_ton, 0) / grupo.nfs.length
    );
  }, [grupo]);

  const [peso, setPeso] = React.useState<number>(
    Number(pesoSugerido.toFixed(1))
  );
  React.useEffect(() => {
    setPeso(Number(pesoSugerido.toFixed(1)));
  }, [pesoSugerido]);

  const proj = grupo
    ? calcProjecao({ nfs: grupo.nfs, peso_medio_override: peso })
    : null;

  const [granularidade, setGranularidade] =
    React.useState<Granularidade>("mensal");

  // Filtro por ano: padrão = ano do fim do período observado; pode ser trocado.
  const [anoManual, setAnoManual] = React.useState<number | null>(null);
  const anoBase = proj ? proj.periodo_fim.getFullYear() : 2026;
  const anoAlvo = anoManual ?? anoBase;
  const serieKey = grupo?.serie === "—" ? "" : grupo?.serie ?? "";

  const anosDisponiveis = React.useMemo(() => {
    const set = new Set<number>();
    for (const n of grupo?.nfs ?? []) set.add(n.data.getFullYear());
    for (let y = anoBase - 1; y <= anoBase + 2; y++) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [grupo, anoBase]);

  const sazonal = proj
    ? projetarSazonal({
        volumePeriodo: proj.volume_est_med,
        periodoInicio: proj.periodo_inicio,
        periodoFim: proj.periodo_fim,
        sazonalidade: getSazonalidade(anoAlvo),
        ano: anoAlvo,
      })
    : null;

  // Overrides manuais por mês (mês 1..12): volume (t) e peso médio (t/NF).
  const [overrides, setOverrides] = React.useState<Record<string, number>>({});
  const [pesoOverrides, setPesoOverrides] = React.useState<
    Record<string, number>
  >({});
  const [overridesDirty, setOverridesDirty] = React.useState(false);
  const [savingMensal, setSavingMensal] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    getProjecaoMensal(emissorId, serieKey, anoAlvo).then((d) => {
      if (ativo) {
        setOverrides(d.volumes);
        setPesoOverrides(d.pesos);
        setOverridesDirty(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, [emissorId, serieKey, anoAlvo]);

  // Volume efetivo por mês: override manual quando houver, senão o sazonal.
  const volumeMes = (mes: number, base: number) =>
    overrides[String(mes)] !== undefined ? overrides[String(mes)] : base;

  // Peso médio efetivo por mês: override manual quando houver, senão o global.
  const pesoMes = (mes: number) =>
    pesoOverrides[String(mes)] !== undefined ? pesoOverrides[String(mes)] : peso;

  // Ao editar um mês ele fica "fixo": fixamos volume E peso para que mover a
  // barra de peso médio global não altere mais os meses já editados.
  function editarMes(mes: number, valor: string) {
    const vazio = valor === "" || Number.isNaN(Number(valor));
    setOverrides((prev) => {
      const next = { ...prev };
      if (vazio) delete next[String(mes)];
      else next[String(mes)] = Number(valor);
      return next;
    });
    if (!vazio) {
      const pinPeso = pesoMes(mes);
      setPesoOverrides((prev) =>
        prev[String(mes)] !== undefined
          ? prev
          : { ...prev, [String(mes)]: pinPeso }
      );
    }
    setOverridesDirty(true);
  }

  function editarPeso(mes: number, valor: string, baseVolume: number) {
    const valido = !(
      valor === "" ||
      Number.isNaN(Number(valor)) ||
      Number(valor) <= 0
    );
    setPesoOverrides((prev) => {
      const next = { ...prev };
      if (!valido) delete next[String(mes)];
      else next[String(mes)] = Number(valor);
      return next;
    });
    if (valido) {
      const pinVol = Math.round(volumeMes(mes, baseVolume));
      setOverrides((prev) =>
        prev[String(mes)] !== undefined
          ? prev
          : { ...prev, [String(mes)]: pinVol }
      );
    }
    setOverridesDirty(true);
  }

  const temOverrides =
    Object.keys(overrides).length > 0 || Object.keys(pesoOverrides).length > 0;

  async function salvarMensal() {
    setSavingMensal(true);
    try {
      await saveProjecaoMensal(
        emissorId,
        serieKey,
        anoAlvo,
        overrides,
        pesoOverrides
      );
      setOverridesDirty(false);
      toast.success("Volumes mensais salvos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSavingMensal(false);
    }
  }

  async function resetarMensal() {
    setOverrides({});
    setPesoOverrides({});
    setOverridesDirty(false);
    try {
      await saveProjecaoMensal(emissorId, serieKey, anoAlvo, {}, {});
      toast.success("Volumes restaurados para a projeção automática.");
    } catch {
      /* ignore */
    }
  }

  const totalAjustado = sazonal
    ? sazonal.meses.reduce((s, m) => s + volumeMes(m.mes, m.volume), 0)
    : 0;

  const [saving, setSaving] = React.useState(false);

  async function salvar() {
    if (!proj) return;
    setSaving(true);
    try {
      await saveProjecao({
        emissor_id: emissorId,
        serie: grupo!.serie === "—" ? null : grupo!.serie,
        periodo_inicio: proj.periodo_inicio.toISOString().slice(0, 10),
        periodo_fim: proj.periodo_fim.toISOString().slice(0, 10),
        nf_inicio: proj.nf_min,
        nf_fim: proj.nf_max,
        delta_nf: proj.delta_nf,
        fator_cobertura: proj.fator_cobertura,
        peso_medio_ton: proj.peso_medio_ton,
        peso_medio_fonte: "manual",
        volume_est_min: proj.volume_est_min,
        volume_est_med: proj.volume_est_med,
        volume_est_max: proj.volume_est_max,
        ic_pct: proj.ic_pct,
      });
      toast.success("Projeção salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!grupo || grupo.nfs.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        São necessárias ao menos 2 NFs da mesma série para projetar a produção.
        {grupo ? ` (capturadas: ${grupo.nfs.length})` : ""}
      </p>
    );
  }

  const scatterData = grupo.nfs
    .slice()
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map((n) => ({
      x: n.data.getTime(),
      y: n.numero,
      label: n.data.toLocaleDateString("pt-BR"),
    }));

  return (
    <div className="space-y-4">
      {series.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Série</Label>
          <Select value={serie} onValueChange={setSerie}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {series.map((s) => (
                <SelectItem key={s.serie} value={s.serie}>
                  Série {s.serie} ({s.nfs.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm">Peso médio por NF (t)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value) || 0)}
                className="h-8 w-24 text-right"
              />
              <span className="text-sm text-muted-foreground">t</span>
            </div>
          </div>
          <Slider
            value={[peso]}
            min={1}
            max={60}
            step={0.5}
            onValueChange={(v) => setPeso(v[0])}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Sugestão (peso total ÷ nº de NFs): {pesoSugerido.toFixed(2)} t
            </span>
            {Number(peso.toFixed(2)) !== Number(pesoSugerido.toFixed(2)) && (
              <button
                className="font-medium text-primary hover:underline"
                onClick={() => setPeso(Number(pesoSugerido.toFixed(1)))}
              >
                usar sugestão
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {sazonal && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Projeção</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(anoAlvo)}
                  onValueChange={(v) => setAnoManual(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={granularidade}
                  onValueChange={(v) => setGranularidade(v as Granularidade)}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
                <Link
                  href="/configuracoes/sazonalidade"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> sazonalidade
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ResultCard
                label={`Anual (${sazonal.ano})`}
                value={fmtTon(totalAjustado)}
                highlight={granularidade === "anual"}
              />
              <ResultCard
                label="Mês de pico"
                value={fmtTon(
                  Math.max(
                    ...sazonal.meses.map((m) => volumeMes(m.mes, m.volume))
                  )
                )}
                highlight={granularidade === "mensal"}
              />
              <ResultCard
                label="Diária média"
                value={`${fmtToneladas1(
                  totalAjustado /
                    (sazonal.meses.reduce((s, m) => s + m.diasUteis, 0) || 1)
                )} t`}
                highlight={granularidade === "diaria"}
              />
              <ResultCard
                label="Peso médio (sug.)"
                value={`${pesoSugerido.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })} t`}
              />
            </div>

            {granularidade !== "anual" && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Sazon.</TableHead>
                        {granularidade === "mensal" ? (
                          <>
                            <TableHead className="text-right">
                              Peso méd. (t) ✎
                            </TableHead>
                            <TableHead className="text-right">Nº NFs</TableHead>
                            <TableHead className="text-right">
                              Volume (t) ✎
                            </TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="text-right">
                              Dias úteis
                            </TableHead>
                            <TableHead className="text-right">Nº NFs</TableHead>
                            <TableHead className="text-right">
                              t/dia útil
                            </TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sazonal.meses.map((m) => {
                        const efetivo = volumeMes(m.mes, m.volume);
                        const pmes = pesoMes(m.mes);
                        const nfsMes =
                          pmes > 0 ? Math.round(efetivo / pmes) : 0;
                        const volEditado =
                          overrides[String(m.mes)] !== undefined;
                        const pesoEditado =
                          pesoOverrides[String(m.mes)] !== undefined;
                        const editado = volEditado || pesoEditado;
                        const pctDin =
                          totalAjustado > 0
                            ? (efetivo / totalAjustado) * 100
                            : 0;
                        return (
                          <TableRow key={m.mes}>
                            <TableCell className="font-medium">
                              {MESES_LABEL[m.mes - 1]}
                              {editado && (
                                <span className="ml-1 text-[10px] text-primary">
                                  editado
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtPct(pctDin)}
                            </TableCell>
                            {granularidade === "mensal" ? (
                              <>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={pmes}
                                    onChange={(e) =>
                                      editarPeso(m.mes, e.target.value, m.volume)
                                    }
                                    className={`h-8 w-20 text-right tabular-nums ${
                                      pesoEditado ? "border-primary" : ""
                                    }`}
                                  />
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {fmtNumero(nfsMes)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={Math.round(efetivo)}
                                    onChange={(e) =>
                                      editarMes(m.mes, e.target.value)
                                    }
                                    className={`h-8 w-28 text-right tabular-nums ${
                                      volEditado ? "border-primary" : ""
                                    }`}
                                  />
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {m.diasUteis}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {fmtNumero(nfsMes)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {fmtToneladas1(
                                    m.diasUteis > 0 ? efetivo / m.diasUteis : 0
                                  )}{" "}
                                  t
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {granularidade === "mensal" && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      Total: {fmtTon(totalAjustado)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetarMensal}
                        disabled={!temOverrides}
                      >
                        <RotateCcw className="h-4 w-4" /> Restaurar
                      </Button>
                      <Button
                        size="sm"
                        onClick={salvarMensal}
                        disabled={!overridesDirty || savingMensal}
                      >
                        {savingMensal ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar volumes
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Volume anual implícito a partir do período observado (cobertura{" "}
              {fmtPct(sazonal.fracaoCoberta * 100)} do ano), distribuído pela
              sazonalidade mensal. O <strong>Nº de NFs</strong> = volume do mês ÷
              peso médio; ajuste o <strong>peso médio</strong> e o{" "}
              <strong>volume</strong> de cada mês nas colunas ✎. O percentual de
              sazonalidade é recalculado conforme a participação de cada mês no
              total ajustado.
            </p>
          </CardContent>
        </Card>
      )}

      {proj && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <ResultCard label="Mín. período" value={fmtTon(proj.volume_est_min)} />
            <ResultCard
              label="Est. período"
              value={fmtTon(proj.volume_est_med)}
            />
            <ResultCard label="Máx. período" value={fmtTon(proj.volume_est_max)} />
          </div>

          <Card>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm sm:grid-cols-4">
              <Metric label="NF inicial" value={fmtNumero(proj.nf_min)} />
              <Metric label="NF final" value={fmtNumero(proj.nf_max)} />
              <Metric label="Gap (Δ NF)" value={fmtNumero(proj.delta_nf)} />
              <Metric label="IC" value={fmtPct(proj.ic_pct)} />
              <Metric
                label="Cobertura"
                value={fmtPct(proj.fator_cobertura * 100)}
              />
              <Metric
                label="Período"
                value={`${proj.periodo_inicio.toLocaleDateString(
                  "pt-BR"
                )} → ${proj.periodo_fim.toLocaleDateString("pt-BR")}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">
                Evolução da numeração de NF
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart
                  margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t) =>
                      new Date(t).toLocaleDateString("pt-BR", {
                        month: "short",
                        year: "2-digit",
                      })
                    }
                    fontSize={11}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => fmtNumero(v)}
                    fontSize={11}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v) => fmtNumero(Number(v))}
                    labelFormatter={(t) =>
                      new Date(Number(t)).toLocaleDateString("pt-BR")
                    }
                  />
                  <Scatter data={scatterData} fill={COR_PRIMARIA} line />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Button onClick={salvar} disabled={saving} className="w-full">
            <Save className="h-4 w-4" /> Salvar projeção
          </Button>
        </>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary bg-primary/5" : undefined}>
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-sm font-bold tabular-nums ${
            highlight ? "text-primary" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
