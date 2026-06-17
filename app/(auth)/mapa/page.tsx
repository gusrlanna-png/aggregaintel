"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Target, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { LocalPonto } from "@/components/maps/mapa-locais";
import type { CirculoRaio } from "@/components/maps/mapa-leaflet";
import { getProdutoresMercado, type ProdutorMercado } from "@/lib/supabase/emissores";
import { getClientesMapa, STATUS_CLIENTE } from "@/lib/supabase/mapa";
import { getMercados, emissoresDoMercado } from "@/lib/supabase/mercados";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fmtNumero, fmtReais } from "@/lib/utils/agregados";

const MapaLeaflet = dynamic(
  () => import("@/components/maps/mapa-leaflet").then((m) => m.MapaLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <MapPin className="h-8 w-8 animate-pulse" />
      </div>
    ),
  }
);

const COR_PRODUTOR = "#334155";
const SEM = "__none__";
// Zonas de análise de raio: A exclusiva, sobreposição (conflito), B exclusiva.
const COR_ZONA = { A: "#2563eb", AB: "#dc2626", B: "#ea580c" } as const;
const RAIOS = [5, 10, 15, 20, 30, 40, 50, 60];

const PALETA_GRUPO = [
  "#7c3aed", "#0891b2", "#ca8a04", "#be185d", "#15803d",
  "#b45309", "#4f46e5", "#0d9488", "#9333ea", "#c2410c",
];
function corDoGrupo(grupo: string | null): string {
  if (!grupo) return COR_PRODUTOR;
  let h = 0;
  for (let i = 0; i < grupo.length; i++) h = (h * 31 + grupo.charCodeAt(i)) >>> 0;
  return PALETA_GRUPO[h % PALETA_GRUPO.length];
}
const simboloSegmento = (seg?: string | null) =>
  (seg ?? "").trim().charAt(0).toUpperCase() || "•";

/** Distância em km (haversine). */
function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat);
  const dLng = toR(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface ZonaKpi {
  n: number;
  vol: number;
  seg: Record<string, number>;
}
const zonaVazia = (): ZonaKpi => ({ n: 0, vol: 0, seg: {} });

function ZonaCard({
  titulo,
  cor,
  dados,
  rotuloGrupo,
  zonaKey,
  zonaSel,
  segSel,
  onPick,
}: {
  titulo: string;
  cor: string;
  dados: ZonaKpi;
  rotuloGrupo?: string;
  zonaKey: "A" | "AB" | "B";
  zonaSel: string | null;
  segSel: string | null;
  onPick: (zona: "A" | "AB" | "B" | null, seg: string | null) => void;
}) {
  const topSeg = Object.entries(dados.seg).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const zonaAtiva = zonaSel === zonaKey;
  return (
    <Card
      className={zonaAtiva ? "ring-2" : undefined}
      style={zonaAtiva ? { ["--tw-ring-color" as string]: cor } : undefined}
    >
      <CardContent className="space-y-1.5 p-3">
        <button
          className="flex w-full items-center gap-1.5 text-left"
          onClick={() => onPick(zonaAtiva && !segSel ? null : zonaKey, null)}
          title="Clique para ver só esta zona no mapa"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
          <span className="text-xs font-semibold">{titulo}</span>
        </button>
        {rotuloGrupo && (
          <p className="truncate text-[11px] text-muted-foreground">{rotuloGrupo}</p>
        )}
        <p className="text-2xl font-bold tabular-nums">{dados.n}</p>
        <p className="text-xs text-muted-foreground">clientes na zona</p>
        <p className="text-sm font-medium tabular-nums">
          {fmtNumero(dados.vol)} t
          <span className="text-xs font-normal text-muted-foreground"> volume potencial (meta)</span>
        </p>
        {topSeg.length > 0 && (
          <ul className="space-y-0.5 pt-1 text-[11px]">
            {topSeg.map(([s, n]) => {
              const ativo = zonaAtiva && segSel === s;
              return (
                <li key={s}>
                  <button
                    className={`flex w-full justify-between gap-2 rounded px-1 py-0.5 hover:bg-muted ${ativo ? "bg-muted font-medium" : "text-muted-foreground"}`}
                    onClick={() => onPick(ativo ? zonaKey : zonaKey, ativo ? null : s)}
                  >
                    <span className="truncate">{s}</span>
                    <span className="tabular-nums">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function MapaPage() {
  const [verClientes, setVerClientes] = React.useState(true);
  const [verProdutores, setVerProdutores] = React.useState(true);
  const [segmento, setSegmento] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [grupoProd, setGrupoProd] = React.useState("all");
  const [mercadoId, setMercadoId] = React.useState("all");
  // Análise de raio (neutra: qualquer grupo de produtor como A/B)
  const [grupoA, setGrupoA] = React.useState("");
  const [grupoB, setGrupoB] = React.useState(SEM);
  const [raioKm, setRaioKm] = React.useState(15);
  // Navegação por zona/segmento a partir dos cards
  const [zonaSel, setZonaSel] = React.useState<"A" | "AB" | "B" | null>(null);
  const [segSel, setSegSel] = React.useState<string | null>(null);
  const pickZona = (z: "A" | "AB" | "B" | null, s: string | null) => {
    setZonaSel(z);
    setSegSel(s);
  };
  // Limpa a seleção de zona quando os parâmetros da análise mudam.
  React.useEffect(() => {
    setZonaSel(null);
    setSegSel(null);
  }, [grupoA, grupoB, raioKm]);

  const { data: clientes, isLoading: lc } = useQuery({
    queryKey: ["mapa-clientes"],
    queryFn: getClientesMapa,
    enabled: isSupabaseConfigured(),
  });
  const { data: produtores, isLoading: lp } = useQuery({
    queryKey: ["produtores-mercado"],
    queryFn: getProdutoresMercado,
    enabled: isSupabaseConfigured(),
  });
  const { data: mercados } = useQuery({
    queryKey: ["mercados"],
    queryFn: getMercados,
    enabled: isSupabaseConfigured(),
  });

  // Restringe os produtores ao mercado selecionado.
  const produtoresVis = React.useMemo(() => {
    const todos = produtores ?? [];
    if (mercadoId === "all") return todos;
    const merc = (mercados ?? []).find((m) => m.id === mercadoId) ?? null;
    const set = emissoresDoMercado(merc, todos);
    return set ? todos.filter((p) => set.has(p.id)) : todos;
  }, [produtores, mercados, mercadoId]);

  const segmentos = React.useMemo(
    () =>
      Array.from(
        new Set((clientes ?? []).map((c) => c.segmento).filter(Boolean))
      ).sort() as string[],
    [clientes]
  );
  const grupos = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of produtoresVis) if (p.grupo_economico) set.add(p.grupo_economico);
    return Array.from(set).sort();
  }, [produtoresVis]);

  const analiseOn = !!grupoA;
  const prodA = React.useMemo(
    () =>
      analiseOn
        ? produtoresVis.filter((p) => p.lat != null && p.grupo_economico === grupoA)
        : [],
    [produtoresVis, grupoA, analiseOn]
  );
  const prodB = React.useMemo(
    () =>
      grupoB !== SEM
        ? produtoresVis.filter((p) => p.lat != null && p.grupo_economico === grupoB)
        : [],
    [produtoresVis, grupoB]
  );

  const clientesFiltrados = React.useMemo(
    () =>
      (clientes ?? []).filter(
        (c) =>
          c.lat != null &&
          c.lng != null &&
          (segmento === "all" || c.segmento === segmento) &&
          (status === "all" || c.status === status)
      ),
    [clientes, segmento, status]
  );

  const zonas = React.useMemo(() => {
    const m = new Map<string, "A" | "AB" | "B">();
    if (!analiseOn) return m;
    const r = raioKm;
    for (const c of clientesFiltrados) {
      const inA = prodA.some((p) => distKm(c.lat!, c.lng!, p.lat!, p.lng!) <= r);
      const inB =
        prodB.length > 0 &&
        prodB.some((p) => distKm(c.lat!, c.lng!, p.lat!, p.lng!) <= r);
      if (inA && inB) m.set(c.id, "AB");
      else if (inA) m.set(c.id, "A");
      else if (inB) m.set(c.id, "B");
    }
    return m;
  }, [clientesFiltrados, prodA, prodB, raioKm, analiseOn]);

  const kpis = React.useMemo(() => {
    const z = { A: zonaVazia(), AB: zonaVazia(), B: zonaVazia() };
    for (const c of clientesFiltrados) {
      const k = zonas.get(c.id);
      if (!k) continue;
      z[k].n++;
      z[k].vol += c.peso_meta;
      const s = c.segmento || "—";
      z[k].seg[s] = (z[k].seg[s] ?? 0) + 1;
    }
    return z;
  }, [zonas, clientesFiltrados]);

  // Clientes efetivamente mostrados (respeita análise + seleção de zona/segmento).
  const clientesMostrados = React.useMemo(() => {
    return clientesFiltrados.filter((c) => {
      if (!analiseOn) return true;
      const z = zonas.get(c.id);
      if (!z) return false;
      if (zonaSel && z !== zonaSel) return false;
      if (segSel && (c.segmento || "—") !== segSel) return false;
      return true;
    });
  }, [clientesFiltrados, analiseOn, zonas, zonaSel, segSel]);

  // Relatório de consumo dos clientes mostrados.
  const relatorio = React.useMemo(() => {
    let potencial = 0;
    let realizado = 0;
    let naoAtendidos = 0;
    let potNaoAtend = 0;
    const porSeg = new Map<string, { potencial: number; realizado: number; n: number }>();
    for (const c of clientesMostrados) {
      potencial += c.peso_meta;
      realizado += c.peso_2025;
      const seg = c.segmento || "—";
      const o = porSeg.get(seg) ?? { potencial: 0, realizado: 0, n: 0 };
      o.potencial += c.peso_meta;
      o.realizado += c.peso_2025;
      o.n++;
      porSeg.set(seg, o);
      if (c.peso_2025 <= 0) {
        naoAtendidos++;
        potNaoAtend += c.peso_meta;
      }
    }
    const topNaoAtend = clientesMostrados
      .filter((c) => c.peso_2025 <= 0 && c.peso_meta > 0)
      .sort((a, b) => b.peso_meta - a.peso_meta)
      .slice(0, 8);
    return {
      potencial,
      realizado,
      gap: Math.max(0, potencial - realizado),
      naoAtendidos,
      potNaoAtend,
      porSeg: Array.from(porSeg, ([seg, v]) => ({ seg, ...v })).sort(
        (a, b) => b.potencial - a.potencial
      ),
      topNaoAtend,
    };
  }, [clientesMostrados]);

  const concorrentes = React.useMemo(() => {
    if (!analiseOn) return { lista: [] as ProdutorMercado[], cfem: 0 };
    const centros = [...prodA, ...prodB];
    const out: ProdutorMercado[] = [];
    for (const p of produtoresVis) {
      if (p.lat == null || p.lng == null) continue;
      if (p.grupo_economico === grupoA || (grupoB !== SEM && p.grupo_economico === grupoB))
        continue;
      if (centros.some((c) => distKm(p.lat!, p.lng!, c.lat!, c.lng!) <= raioKm))
        out.push(p);
    }
    out.sort((a, b) => (b.cfem_12m || 0) - (a.cfem_12m || 0));
    return { lista: out, cfem: out.reduce((s, p) => s + (p.cfem_12m || 0), 0) };
  }, [produtoresVis, prodA, prodB, grupoA, grupoB, raioKm, analiseOn]);

  const idsConcorrentes = React.useMemo(
    () => new Set(concorrentes.lista.map((p) => p.id)),
    [concorrentes]
  );

  const pontos: LocalPonto[] = React.useMemo(() => {
    const out: LocalPonto[] = [];
    if (verClientes) {
      for (const c of clientesMostrados) {
        const zona = zonas.get(c.id);
        const cor = analiseOn
          ? zona
            ? COR_ZONA[zona]
            : "#cbd5e1"
          : STATUS_CLIENTE[c.status].cor;
        const zlabel = zona
          ? zona === "AB"
            ? " · ZONA DE CONFLITO"
            : zona === "A"
              ? ` · zona ${grupoA}`
              : ` · zona ${grupoB}`
          : "";
        out.push({
          id: `c-${c.id}`,
          nome: c.fantasia || c.razao_social,
          lat: c.lat,
          lng: c.lng,
          cor,
          simbolo: simboloSegmento(c.segmento),
          detalhe: `Cliente · ${c.segmento ?? ""} · meta ${fmtNumero(c.peso_meta)} t · ${STATUS_CLIENTE[c.status].label}${zlabel}`,
        });
      }
    }
    if (verProdutores) {
      for (const p of produtoresVis) {
        if (p.lat == null || p.lng == null) continue;
        if (grupoProd !== "all" && p.grupo_economico !== grupoProd) continue;
        const ehA = analiseOn && p.grupo_economico === grupoA;
        const ehB = grupoB !== SEM && p.grupo_economico === grupoB;
        // Em análise, mostra só A/B + concorrentes na área (mapa limpo).
        if (analiseOn && !ehA && !ehB && !idsConcorrentes.has(p.id)) continue;
        out.push({
          id: `p-${p.id}`,
          nome: p.razao_social,
          lat: p.lat,
          lng: p.lng,
          cor: ehA ? COR_ZONA.A : ehB ? COR_ZONA.B : corDoGrupo(p.grupo_economico),
          destaque: ehA || ehB,
          detalhe: `Produtor · ${p.grupo_economico ? `${p.grupo_economico} · ` : ""}${p.substancias ?? "—"} · CFEM 12m ${fmtReais(p.cfem_12m)}`,
        });
      }
    }
    return out;
  }, [
    clientesMostrados, produtoresVis, verClientes, verProdutores, grupoProd,
    zonas, analiseOn, grupoA, grupoB, idsConcorrentes,
  ]);

  const circulos: CirculoRaio[] = React.useMemo(() => {
    if (!analiseOn) return [];
    const cs: CirculoRaio[] = [];
    for (const p of prodA)
      cs.push({ id: `ca-${p.id}`, lat: p.lat!, lng: p.lng!, raioM: raioKm * 1000, cor: COR_ZONA.A });
    for (const p of prodB)
      cs.push({ id: `cb-${p.id}`, lat: p.lat!, lng: p.lng!, raioM: raioKm * 1000, cor: COR_ZONA.B });
    return cs;
  }, [prodA, prodB, raioKm, analiseOn]);

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          O mapa de decisão usa os dados sincronizados (Supabase).
        </CardContent>
      </Card>
    );
  }

  const carregando = lc || lp;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mapa de decisão</h1>
        <p className="text-sm text-muted-foreground">
          Clientes (por status) e produtores (CFEM) no território. Use a análise de
          raio para mapear zonas de atendimento e sobreposição entre grupos.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2">
            <Switch id="cli" checked={verClientes} onCheckedChange={setVerClientes} />
            <Label htmlFor="cli" className="text-sm">
              Clientes ({clientesFiltrados.length})
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="prod" checked={verProdutores} onCheckedChange={setVerProdutores} />
            <Label htmlFor="prod" className="text-sm">
              Produtores ({produtoresVis.filter((p) => p.lat != null).length})
            </Label>
          </div>
          <Select value={mercadoId} onValueChange={setMercadoId}>
            <SelectTrigger><SelectValue placeholder="Mercado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os mercados</SelectItem>
              {(mercados ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={segmento} onValueChange={setSegmento}>
            <SelectTrigger><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {segmentos.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status do cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_CLIENTE).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grupoProd} onValueChange={setGrupoProd}>
            <SelectTrigger><SelectValue placeholder="Grupo de produtor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtores</SelectItem>
              {grupos.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Análise de raio e sobreposição */}
      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Target className="h-4 w-4" /> Análise de raio
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Grupo A (principal)</Label>
              <Select value={grupoA || SEM} onValueChange={(v) => setGrupoA(v === SEM ? "" : v)}>
                <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>— (desativado)</SelectItem>
                  {grupos.length === 0 && (
                    <SelectItem value="__vazio__" disabled>
                      nenhum grupo cadastrado
                    </SelectItem>
                  )}
                  {grupos.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Grupo B (comparar)</Label>
              <Select value={grupoB} onValueChange={setGrupoB} disabled={!analiseOn}>
                <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>— (nenhum)</SelectItem>
                  {grupos.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Raio</Label>
              <Select value={String(raioKm)} onValueChange={(v) => setRaioKm(Number(v))} disabled={!analiseOn}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RAIOS.map((r) => (
                    <SelectItem key={r} value={String(r)}>{r} km</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {analiseOn && (
              <Button variant="ghost" size="sm" onClick={() => { setGrupoA(""); setGrupoB(SEM); }}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>

          {grupos.length === 0 && (
            <p className="text-xs text-amber-700">
              Nenhum grupo econômico cadastrado. Defina grupos em{" "}
              <strong>Mercado › Produtores</strong> (selecione produtores → “Vincular ao grupo”).
            </p>
          )}

          {analiseOn && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ZonaCard titulo="Zona exclusiva A" rotuloGrupo={grupoA} cor={COR_ZONA.A} dados={kpis.A} zonaKey="A" zonaSel={zonaSel} segSel={segSel} onPick={pickZona} />
                <ZonaCard
                  titulo="Sobreposição (conflito)"
                  rotuloGrupo={grupoB !== SEM ? `${grupoA} × ${grupoB}` : "selecione o Grupo B"}
                  cor={COR_ZONA.AB}
                  dados={kpis.AB}
                  zonaKey="AB"
                  zonaSel={zonaSel}
                  segSel={segSel}
                  onPick={pickZona}
                />
                <ZonaCard
                  titulo="Zona exclusiva B"
                  rotuloGrupo={grupoB !== SEM ? grupoB : "—"}
                  cor={COR_ZONA.B}
                  dados={kpis.B}
                  zonaKey="B"
                  zonaSel={zonaSel}
                  segSel={segSel}
                  onPick={pickZona}
                />
                <Card>
                  <CardContent className="space-y-1.5 p-3">
                    <p className="text-xs font-semibold">Concorrentes na área</p>
                    <p className="text-2xl font-bold tabular-nums">{concorrentes.lista.length}</p>
                    <p className="text-xs text-muted-foreground">produtores de outros grupos no raio</p>
                    <p className="text-sm font-medium tabular-nums">
                      {fmtReais(concorrentes.cfem)}
                      <span className="text-xs font-normal text-muted-foreground"> CFEM 12m</span>
                    </p>
                    {concorrentes.lista.slice(0, 4).map((p) => (
                      <p key={p.id} className="truncate text-[11px] text-muted-foreground">
                        {p.razao_social} · {fmtReais(p.cfem_12m)}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  Clientes por zona: <span style={{ color: COR_ZONA.A }}>azul = só A</span>,{" "}
                  <span style={{ color: COR_ZONA.AB }}>vermelho = conflito</span>,{" "}
                  <span style={{ color: COR_ZONA.B }}>laranja = só B</span>. Clique numa zona/segmento para focar o mapa.
                </span>
                {(zonaSel || segSel) && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => pickZona(null, null)}>
                    <X className="h-3 w-3" /> {zonaSel ?? ""}{segSel ? ` · ${segSel}` : ""} — limpar foco
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legenda (status) — fora da análise */}
      {!analiseOn && (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.values(STATUS_CLIENTE).map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: s.cor }} />
                {s.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: COR_PRODUTOR }} />
              Produtor (sem grupo)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cliente: <strong>ícone = inicial do segmento</strong>, cor = status. Produtor:{" "}
            <strong>cor = grupo econômico</strong> (mesmo grupo, mesma cor).
          </p>
        </>
      )}

      {carregando ? (
        <div className="flex h-[520px] items-center justify-center rounded-lg border bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <MapaLeaflet pontos={pontos.slice(0, 2500)} circulos={circulos} altura={520} />
      )}
      <p className="text-xs text-muted-foreground">
        {pontos.length.toLocaleString("pt-BR")} pontos no mapa
        {pontos.length > 2500 && " (exibindo 2.500)"}.
      </p>

      {/* Relatório dos clientes selecionados */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">
            Consumo dos clientes selecionados ({clientesMostrados.length})
            {zonaSel && (
              <span className="font-normal text-muted-foreground">
                {" "}· zona {zonaSel}{segSel ? ` · ${segSel}` : ""}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xl font-bold tabular-nums">{fmtNumero(relatorio.potencial)} t</p>
              <p className="text-xs text-muted-foreground">Potencial de compra (meta)</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-emerald-600">{fmtNumero(relatorio.realizado)} t</p>
              <p className="text-xs text-muted-foreground">Já atendido pelo nosso grupo (2025)</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-amber-600">{fmtNumero(relatorio.gap)} t</p>
              <p className="text-xs text-muted-foreground">Oportunidade (potencial − atendido)</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{relatorio.naoAtendidos}</p>
              <p className="text-xs text-muted-foreground">
                clientes não direcionados · {fmtNumero(relatorio.potNaoAtend)} t
              </p>
            </div>
          </div>

          {/* Por segmento */}
          {relatorio.porSeg.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 text-left font-medium">Segmento</th>
                    <th className="py-1 text-right font-medium">Clientes</th>
                    <th className="py-1 text-right font-medium">Potencial (t)</th>
                    <th className="py-1 text-right font-medium">Atendido (t)</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.porSeg.map((r) => (
                    <tr key={r.seg} className="border-b last:border-0">
                      <td className="py-1">{r.seg}</td>
                      <td className="py-1 text-right tabular-nums">{r.n}</td>
                      <td className="py-1 text-right tabular-nums">{fmtNumero(r.potencial)}</td>
                      <td className="py-1 text-right tabular-nums text-emerald-600">{fmtNumero(r.realizado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clientes não direcionados (oportunidade) */}
          {relatorio.topNaoAtend.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">
                Clientes não direcionados — maior potencial
              </p>
              <ul className="space-y-0.5 text-xs">
                {relatorio.topNaoAtend.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.fantasia || c.razao_social}</span>
                    <span className="tabular-nums text-amber-600">{fmtNumero(c.peso_meta)} t</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Potencial e atendido vêm do planejamento (vendas_meta). O <em>volume vendido por
            produtor concorrente/terceiro a cada cliente</em> depende de dados de fornecimento
            (NF/mix) — ainda sem fonte carregada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
