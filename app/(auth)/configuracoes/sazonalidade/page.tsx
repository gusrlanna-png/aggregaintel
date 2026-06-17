"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MESES_LABEL,
  SAZONALIDADE_PADRAO,
  getSazonalidade,
  setSazonalidade,
} from "@/lib/utils/sazonalidade";
import { SEGMENTOS, fmtPct, type Segmento } from "@/lib/utils/agregados";

const ANO_ATUAL = 2026;
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL + 1];

export default function SazonalidadePage() {
  const [ano, setAno] = React.useState(ANO_ATUAL);
  const [segmento, setSegmento] = React.useState("geral");
  const [pesos, setPesos] = React.useState<number[]>(SAZONALIDADE_PADRAO);

  React.useEffect(() => {
    setPesos(getSazonalidade(ano, segmento));
  }, [ano, segmento]);

  const soma = pesos.reduce((s, v) => s + (Number(v) || 0), 0);

  function salvar() {
    setSazonalidade(ano, segmento, pesos.map((p) => Number(p) || 0));
    toast.success(
      `Sazonalidade salva (${ano} · ${segmento === "geral" ? "geral" : SEGMENTOS[segmento as Segmento]?.label ?? segmento}).`
    );
  }

  function restaurar() {
    setPesos(SAZONALIDADE_PADRAO);
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Sazonalidade mensal
        </h1>
        <p className="text-sm text-muted-foreground">
          Distribuição do volume anual por mês. Aplicada às projeções. Pode
          variar por ano e por segmento de cliente.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Segmento</Label>
            <Select value={segmento} onValueChange={setSegmento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral (todos)</SelectItem>
                {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEGMENTOS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Pesos por mês</span>
            <span
              className={
                Math.abs(soma - 1) > 0.005
                  ? "text-sm font-normal text-destructive"
                  : "text-sm font-normal text-muted-foreground"
              }
            >
              Soma: {fmtPct(soma * 100)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pesos.map((p, i) => (
            <div key={i} className="space-y-1.5">
              <Label className="text-xs">{MESES_LABEL[i]}</Label>
              <Input
                type="number"
                step="0.0001"
                value={p}
                onChange={(e) => {
                  const v = e.target.value;
                  setPesos((prev) =>
                    prev.map((x, j) => (j === i ? (v as unknown as number) : x))
                  );
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                {fmtPct((Number(p) || 0) * 100)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {Math.abs(soma - 1) > 0.005 && (
        <p className="text-xs text-amber-600">
          A soma dos pesos é {fmtPct(soma * 100)} — o ideal é 100%. As projeções
          normalizam automaticamente, mas ajuste se possível.
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={restaurar} className="flex-1">
          <RotateCcw className="h-4 w-4" /> Restaurar padrão
        </Button>
        <Button onClick={salvar} className="flex-1">
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}
