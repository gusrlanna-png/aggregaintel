"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CALENDARIO_PADRAO,
  feriadosNacionais,
  getCalendarioConfig,
  listarFeriados,
  setCalendarioConfig,
  valorDoDia,
  type CalendarioConfig,
} from "@/lib/utils/dias-uteis";
import { MESES_LABEL } from "@/lib/utils/sazonalidade";

const ANO_ATUAL = 2026;
const ANOS = [ANO_ATUAL - 2, ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];

/** Dias úteis ponderados de um mês usando a config em edição (sem persistir). */
function diasUteisMesPreview(
  year: number,
  mes0: number,
  cfg: CalendarioConfig
): number {
  const feriados = feriadosNacionais(year, cfg);
  const ultimo = new Date(year, mes0 + 1, 0).getDate();
  let total = 0;
  for (let d = 1; d <= ultimo; d++) {
    total += valorDoDia(new Date(year, mes0, d), feriados, cfg);
  }
  return +total.toFixed(2);
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DiasUteisPage() {
  const [ano, setAno] = React.useState(ANO_ATUAL);
  const [pesoSemana, setPesoSemana] = React.useState(
    CALENDARIO_PADRAO.pesoSemana
  );
  const [pesoSabado, setPesoSabado] = React.useState(
    CALENDARIO_PADRAO.pesoSabado
  );
  const [pesoDomingo, setPesoDomingo] = React.useState(
    CALENDARIO_PADRAO.pesoDomingo
  );
  const [pesoFeriado, setPesoFeriado] = React.useState(
    CALENDARIO_PADRAO.pesoFeriado
  );
  const [feriadosExtra, setFeriadosExtra] = React.useState<string[]>([]);
  const [novoFeriado, setNovoFeriado] = React.useState("");

  React.useEffect(() => {
    const c = getCalendarioConfig();
    setPesoSemana(c.pesoSemana);
    setPesoSabado(c.pesoSabado);
    setPesoDomingo(c.pesoDomingo);
    setPesoFeriado(c.pesoFeriado);
    setFeriadosExtra(c.feriadosExtra);
  }, []);

  const cfg: CalendarioConfig = {
    id: "global",
    pesoSemana: Number(pesoSemana) || 0,
    pesoSabado: Number(pesoSabado) || 0,
    pesoDomingo: Number(pesoDomingo) || 0,
    pesoFeriado: Number(pesoFeriado) || 0,
    feriadosExtra,
  };

  const meses = MESES_LABEL.map((label, i) => ({
    label,
    dias: diasUteisMesPreview(ano, i, cfg),
  }));
  const totalAno = +meses.reduce((s, m) => s + m.dias, 0).toFixed(2);

  function adicionarFeriado() {
    if (!novoFeriado) return;
    if (feriadosExtra.includes(novoFeriado)) {
      toast.info("Feriado já cadastrado.");
      return;
    }
    setFeriadosExtra((prev) => [...prev, novoFeriado].sort());
    setNovoFeriado("");
  }

  function removerFeriado(iso: string) {
    setFeriadosExtra((prev) => prev.filter((f) => f !== iso));
  }

  function salvar() {
    setCalendarioConfig(cfg);
    toast.success("Configuração de dias úteis salva.");
  }

  function restaurar() {
    setPesoSemana(CALENDARIO_PADRAO.pesoSemana);
    setPesoSabado(CALENDARIO_PADRAO.pesoSabado);
    setPesoDomingo(CALENDARIO_PADRAO.pesoDomingo);
    setPesoFeriado(CALENDARIO_PADRAO.pesoFeriado);
    setFeriadosExtra([]);
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Peso de dias / mês</h1>
        <p className="text-sm text-muted-foreground">
          Peso de cada tipo de dia e feriados. Define os dias úteis ponderados
          de cada mês, usados para distribuir a produção diária nas projeções.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesos por tipo de dia</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Dia útil (seg–sex)</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoSemana}
              onChange={(e) => setPesoSemana(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sábado</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoSabado}
              onChange={(e) => setPesoSabado(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Domingo</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoDomingo}
              onChange={(e) => setPesoDomingo(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Feriado</Label>
            <Input
              type="number"
              step="0.1"
              value={pesoFeriado}
              onChange={(e) => setPesoFeriado(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feriados extras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Feriados nacionais (fixos e móveis) já são considerados
            automaticamente. Adicione aqui feriados municipais/estaduais ou
            pontos facultativos (peso 0 no dia).
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={novoFeriado}
                onChange={(e) => setNovoFeriado(e.target.value)}
              />
            </div>
            <Button type="button" onClick={adicionarFeriado}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Feriados considerados em {ano}</Label>
            <ul className="divide-y rounded-md border">
              {listarFeriados(ano, cfg).map((f) => (
                <li
                  key={f.iso}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmtData(f.iso)}
                    </span>
                    <span className="truncate">{f.nome}</span>
                    {f.tipo === "extra" && (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        extra
                      </span>
                    )}
                  </span>
                  {f.tipo === "extra" ? (
                    <button
                      onClick={() => removerFeriado(f.iso)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remover feriado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      nacional
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Dias úteis ponderados</span>
            <Select
              value={String(ano)}
              onValueChange={(v) => setAno(Number(v))}
            >
              <SelectTrigger className="h-8 w-24 text-xs">
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Dias úteis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((m) => (
                  <TableRow key={m.label}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.dias}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Total {ano}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totalAno}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Prévia com os pesos acima. Salve para aplicar nas projeções.
          </p>
        </CardContent>
      </Card>

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
