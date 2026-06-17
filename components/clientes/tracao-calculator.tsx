"use client";

import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMINHOES,
  FAIXAS_ASFALTO,
  FAIXAS_CONCRETO,
  SEGMENTOS,
  TRACOS_PREMOLDADO,
  fmtToneladas1,
  labelProduto,
  type CaminhaoTipo,
  type ProdutoTipo,
  type Segmento,
  type SubtipoPremoldado,
} from "@/lib/utils/agregados";

export interface ConsumoResult {
  segmento: Segmento;
  subtipo?: string;
  periodo_tipo: string;
  periodo_ref: string | null;
  producao_volume: number;
  producao_unit: string;
  traco_kg: Record<string, number>;
  consumo_ton: Record<string, number>; // produto -> toneladas/mês
  total_ton: number;
  caminhao_tipo?: string;
  caminhao_peso_t?: number;
}

const anos = ["2026", "2025", "2024", "2023"];
const meses = [
  "01","02","03","04","05","06","07","08","09","10","11","12",
];

export function TracaoCalculator({
  onChange,
}: {
  onChange?: (r: ConsumoResult) => void;
}) {
  const [segmento, setSegmento] = React.useState<Segmento>("concreto");
  const [periodoTipo, setPeriodoTipo] = React.useState("mes");
  const [ano, setAno] = React.useState("2026");
  const [mes, setMes] = React.useState("06");

  // Concreto
  const [prodConcreto, setProdConcreto] = React.useState(10000);
  const [tracoConcreto, setTracoConcreto] = React.useState({
    b1: 550,
    b2: 250,
    ai: 1000,
    aq: 200,
    pp: 0,
  });

  // Asfalto
  const [prodAsfalto, setProdAsfalto] = React.useState(8000);
  const [tracoAsfalto, setTracoAsfalto] = React.useState({
    bg: 300,
    ai_pp: 400,
    filer: 40,
    cap: 50,
  });

  // Pré-moldado
  const [subtipo, setSubtipo] = React.useState<SubtipoPremoldado>("bloco");
  const [prodPre, setProdPre] = React.useState(50000);
  const [tracoPre, setTracoPre] = React.useState(
    TRACOS_PREMOLDADO.bloco.traco
  );
  React.useEffect(() => {
    setTracoPre(TRACOS_PREMOLDADO[subtipo].traco);
  }, [subtipo]);

  // Varejo
  const [cargasBrita, setCargasBrita] = React.useState(20);
  const [camBrita, setCamBrita] = React.useState<CaminhaoTipo>("truck");
  const [cargasAreia, setCargasAreia] = React.useState(15);
  const [camAreia, setCamAreia] = React.useState<CaminhaoTipo>("truck");
  const [camBritaCustom, setCamBritaCustom] = React.useState(14);
  const [camAreiaCustom, setCamAreiaCustom] = React.useState(14);

  const periodoRef =
    periodoTipo === "ano" ? ano : periodoTipo === "mes" ? `${ano}-${mes}` : null;

  const result: ConsumoResult = React.useMemo(() => {
    let consumo: Record<string, number> = {};
    let traco_kg: Record<string, number> = {};
    let producao_volume = 0;
    let producao_unit = "";
    let subt: string | undefined;
    let caminhao_tipo: string | undefined;
    let caminhao_peso_t: number | undefined;

    if (segmento === "concreto") {
      producao_volume = prodConcreto;
      producao_unit = "m3";
      traco_kg = { ...tracoConcreto };
      consumo = mapKgToTon(tracoConcreto, prodConcreto);
    } else if (segmento === "asfalto") {
      producao_volume = prodAsfalto;
      producao_unit = "t";
      traco_kg = { ...tracoAsfalto };
      // ai_pp -> ai ; filer -> pp ; cap não soma
      consumo = {
        bg: (tracoAsfalto.bg * prodAsfalto) / 1000,
        ai: (tracoAsfalto.ai_pp * prodAsfalto) / 1000,
        pp: (tracoAsfalto.filer * prodAsfalto) / 1000,
      };
    } else if (segmento === "premoldado") {
      producao_volume = prodPre;
      producao_unit = "unid";
      subt = subtipo;
      traco_kg = { ...tracoPre };
      consumo = mapKgToTon(tracoPre, prodPre);
    } else if (segmento === "varejo") {
      producao_unit = "cargas";
      const pBrita =
        camBrita === "custom" ? camBritaCustom : CAMINHOES[camBrita].pesoT;
      const pAreia =
        camAreia === "custom" ? camAreiaCustom : CAMINHOES[camAreia].pesoT;
      consumo = {
        b1: cargasBrita * pBrita,
        ai: cargasAreia * pAreia,
      };
      producao_volume = cargasBrita + cargasAreia;
      caminhao_tipo = `brita:${camBrita}/areia:${camAreia}`;
      caminhao_peso_t = pBrita;
    }

    // remove zeros
    consumo = Object.fromEntries(
      Object.entries(consumo).filter(([, v]) => v > 0)
    );
    const total_ton = Object.values(consumo).reduce((s, v) => s + v, 0);

    return {
      segmento,
      subtipo: subt,
      periodo_tipo: periodoTipo,
      periodo_ref: periodoRef,
      producao_volume,
      producao_unit,
      traco_kg,
      consumo_ton: consumo,
      total_ton,
      caminhao_tipo,
      caminhao_peso_t,
    };
  }, [
    segmento,
    periodoTipo,
    periodoRef,
    prodConcreto,
    tracoConcreto,
    prodAsfalto,
    tracoAsfalto,
    subtipo,
    prodPre,
    tracoPre,
    cargasBrita,
    camBrita,
    cargasAreia,
    camAreia,
    camBritaCustom,
    camAreiaCustom,
  ]);

  React.useEffect(() => {
    onChange?.(result);
  }, [result, onChange]);

  return (
    <div className="space-y-4">
      {/* Segmento + período */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs">Segmento</Label>
            <Select
              value={segmento}
              onValueChange={(v) => setSegmento(v as Segmento)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SEGMENTOS) as Segmento[])
                  .filter((s) => s !== "outro")
                  .map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEGMENTOS[s].label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={periodoTipo} onValueChange={setPeriodoTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="macro">Macro</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodoTipo !== "macro" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {periodoTipo === "mes" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form por segmento */}
      <Card>
        <CardContent className="space-y-4 p-4">
          {segmento === "concreto" && (
            <>
              <NumField
                label="Produção (m³/mês)"
                value={prodConcreto}
                onChange={setProdConcreto}
              />
              {(["b1", "b2", "ai", "aq", "pp"] as const).map((k) => (
                <TracoSlider
                  key={k}
                  produto={k}
                  value={tracoConcreto[k]}
                  faixa={FAIXAS_CONCRETO[k]}
                  unidade="kg/m³"
                  onChange={(v) =>
                    setTracoConcreto((t) => ({ ...t, [k]: v }))
                  }
                />
              ))}
            </>
          )}

          {segmento === "asfalto" && (
            <>
              <NumField
                label="Produção de massa (t/mês)"
                value={prodAsfalto}
                onChange={setProdAsfalto}
              />
              <TracoRow
                label="Brita graduada (bg)"
                value={tracoAsfalto.bg}
                faixa={FAIXAS_ASFALTO.bg}
                unidade="kg/t"
                onChange={(v) => setTracoAsfalto((t) => ({ ...t, bg: v }))}
              />
              <TracoRow
                label="Areia / Pó (ai/pp)"
                value={tracoAsfalto.ai_pp}
                faixa={FAIXAS_ASFALTO.ai_pp}
                unidade="kg/t"
                onChange={(v) => setTracoAsfalto((t) => ({ ...t, ai_pp: v }))}
              />
              <TracoRow
                label="Filer"
                value={tracoAsfalto.filer}
                faixa={FAIXAS_ASFALTO.filer}
                unidade="kg/t"
                onChange={(v) => setTracoAsfalto((t) => ({ ...t, filer: v }))}
              />
              <TracoRow
                label="CAP (ligante — informativo)"
                value={tracoAsfalto.cap}
                faixa={FAIXAS_ASFALTO.cap}
                unidade="kg/t"
                onChange={(v) => setTracoAsfalto((t) => ({ ...t, cap: v }))}
              />
              <p className="text-xs text-muted-foreground">
                O CAP (ligante asfáltico) não entra no total de agregados.
              </p>
            </>
          )}

          {segmento === "premoldado" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de peça</Label>
                <Select
                  value={subtipo}
                  onValueChange={(v) =>
                    setSubtipo(v as SubtipoPremoldado)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRACOS_PREMOLDADO) as SubtipoPremoldado[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {TRACOS_PREMOLDADO[s].label} (
                          {TRACOS_PREMOLDADO[s].pesoKg} kg)
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <NumField
                label="Produção (unid/mês)"
                value={prodPre}
                onChange={setProdPre}
              />
              {(["b0", "ai", "pp"] as const).map((k) => (
                <TracoRow
                  key={k}
                  label={labelProduto(k)}
                  value={tracoPre[k]}
                  faixa={{ min: 0, max: 20, step: 0.05 }}
                  unidade="kg/unid"
                  onChange={(v) => setTracoPre((t) => ({ ...t, [k]: v }))}
                />
              ))}
            </>
          )}

          {segmento === "varejo" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Brita</p>
                <NumField
                  label="Cargas/mês"
                  value={cargasBrita}
                  onChange={setCargasBrita}
                />
                <CaminhaoSelect
                  value={camBrita}
                  onChange={setCamBrita}
                  custom={camBritaCustom}
                  onCustom={setCamBritaCustom}
                />
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Areia</p>
                <NumField
                  label="Cargas/mês"
                  value={cargasAreia}
                  onChange={setCargasAreia}
                />
                <CaminhaoSelect
                  value={camAreia}
                  onChange={setCamAreia}
                  custom={camAreiaCustom}
                  onCustom={setCamAreiaCustom}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado do consumo */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Consumo estimado de agregados</p>
            <p className="text-lg font-bold tabular-nums text-primary">
              {fmtToneladas1(result.total_ton)} t/mês
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {Object.entries(result.consumo_ton).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{labelProduto(k)}</span>
                <span className="font-medium tabular-nums">
                  {fmtToneladas1(v)} t
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function mapKgToTon(
  traco: Record<string, number>,
  producao: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, kg] of Object.entries(traco)) {
    out[k] = (kg * producao) / 1000;
  }
  return out;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function TracoSlider({
  produto,
  value,
  faixa,
  unidade,
  onChange,
}: {
  produto: ProdutoTipo;
  value: number;
  faixa: { min: number; max: number; step: number };
  unidade: string;
  onChange: (v: number) => void;
}) {
  return (
    <TracoRow
      label={labelProduto(produto)}
      value={value}
      faixa={faixa}
      unidade={unidade}
      onChange={onChange}
    />
  );
}

function TracoRow({
  label,
  value,
  faixa,
  unidade,
  onChange,
}: {
  label: string;
  value: number;
  faixa: { min: number; max: number; step: number };
  unidade: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-xs">{label}</Label>
        <span className="tabular-nums text-muted-foreground">
          {value} {unidade}
        </span>
      </div>
      <Slider
        value={[value]}
        min={faixa.min}
        max={faixa.max}
        step={faixa.step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function CaminhaoSelect({
  value,
  onChange,
  custom,
  onCustom,
}: {
  value: CaminhaoTipo;
  onChange: (v: CaminhaoTipo) => void;
  custom: number;
  onCustom: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Tipo de caminhão</Label>
      <Select value={value} onValueChange={(v) => onChange(v as CaminhaoTipo)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CAMINHOES) as CaminhaoTipo[]).map((c) => (
            <SelectItem key={c} value={c}>
              {CAMINHOES[c].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "custom" && (
        <Input
          type="number"
          value={custom}
          onChange={(e) => onCustom(Number(e.target.value) || 0)}
          placeholder="Peso útil (t)"
        />
      )}
    </div>
  );
}
