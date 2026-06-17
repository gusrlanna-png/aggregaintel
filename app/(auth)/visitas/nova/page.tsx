"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  LocateFixed,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput, NumberInput } from "@/components/ui/masked-input";
import { getClientes } from "@/lib/supabase/clientes";
import {
  cadastrarClientePendente,
  criarVisita,
  distanciaMetros,
  getMotivos,
  type VisitaConcorrenteInput,
} from "@/lib/supabase/visitas";
import { SEGMENTOS, type Segmento } from "@/lib/utils/agregados";

export default function NovaVisitaPage() {
  const router = useRouter();
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null
  );
  const [geo, setGeo] = React.useState<"idle" | "loading" | "ok" | "erro">(
    "idle"
  );

  const [busca, setBusca] = React.useState("");
  const [clienteId, setClienteId] = React.useState<string | null>(null);
  const [modoNovo, setModoNovo] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [novoSegmento, setNovoSegmento] = React.useState<string>("outro");

  const [pessoaNome, setPessoaNome] = React.useState("");
  const [motivoId, setMotivoId] = React.useState<string>("");
  const [segmento, setSegmento] = React.useState<string>("");
  const [obs, setObs] = React.useState("");
  const [perda, setPerda] = React.useState(false);
  const [concorrentes, setConcorrentes] = React.useState<
    VisitaConcorrenteInput[]
  >([]);
  const [salvando, setSalvando] = React.useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-list-visita"],
    queryFn: () => getClientes(),
  });
  const { data: motivos = [] } = useQuery({
    queryKey: ["visita-motivos"],
    queryFn: getMotivos,
  });

  // Geolocalização no carregamento.
  const pegarLocal = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("erro");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo("ok");
      },
      () => setGeo("erro"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);
  React.useEffect(() => {
    pegarLocal();
  }, [pegarLocal]);

  // Clientes próximos (ordenados por distância do check-in).
  const proximos = React.useMemo(() => {
    if (!coords) return [];
    return clientes
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({
        c,
        dist: distanciaMetros(coords.lat, coords.lng, c.lat as number, c.lng as number),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);
  }, [coords, clientes]);

  const buscados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return clientes
      .filter(
        (c) =>
          c.razao_social.toLowerCase().includes(q) ||
          (c.fantasia ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busca, clientes]);

  const clienteSel = clientes.find((c) => c.id === clienteId) ?? null;
  const distCliente =
    coords && clienteSel?.lat != null && clienteSel?.lng != null
      ? distanciaMetros(
          coords.lat,
          coords.lng,
          clienteSel.lat as number,
          clienteSel.lng as number
        )
      : null;

  function selecionar(id: string, seg?: string | null) {
    setClienteId(id);
    setModoNovo(false);
    if (seg) setSegmento(seg);
  }

  function addConcorrente() {
    setConcorrentes((p) => [...p, {}]);
  }
  function setConc(i: number, patch: Partial<VisitaConcorrenteInput>) {
    setConcorrentes((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }
  function rmConc(i: number) {
    setConcorrentes((p) => p.filter((_, j) => j !== i));
  }

  async function salvar() {
    if (!clienteId && !modoNovo) {
      toast.error("Selecione um cliente ou cadastre um novo.");
      return;
    }
    if (modoNovo && !novoNome.trim()) {
      toast.error("Informe o nome do novo cliente.");
      return;
    }
    if (!motivoId) {
      toast.error("Selecione o motivo da visita.");
      return;
    }
    setSalvando(true);
    try {
      let cid = clienteId;
      if (modoNovo) {
        const novo = await cadastrarClientePendente({
          razao_social: novoNome.trim(),
          segmento: novoSegmento,
          municipio: clienteSel?.municipio ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });
        cid = novo.id;
        toast.info("Cliente novo cadastrado (pendente de validação).");
      }
      await criarVisita(
        {
          cliente_id: cid,
          pessoa_nome: pessoaNome || null,
          motivo_id: motivoId,
          segmento: segmento || novoSegmento || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          distancia_m: distCliente,
          perda_venda: perda,
          observacoes: obs || null,
        },
        perda ? concorrentes : []
      );
      toast.success("Visita registrada.");
      router.push("/visitas");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/visitas">
          <ArrowLeft className="h-4 w-4" /> Visitas
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Nova visita (check-in)</h1>

      {/* Check-in / localização */}
      <Card>
        <CardContent className="flex items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2 text-sm">
            <LocateFixed
              className={
                geo === "ok"
                  ? "h-5 w-5 text-emerald-600"
                  : "h-5 w-5 text-muted-foreground"
              }
            />
            {geo === "loading" && "Obtendo localização…"}
            {geo === "ok" && coords && (
              <span className="tabular-nums text-muted-foreground">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            )}
            {geo === "erro" && (
              <span className="text-amber-600">
                Localização indisponível (permita o GPS)
              </span>
            )}
            {geo === "idle" && "—"}
          </div>
          <Button variant="outline" size="sm" onClick={pegarLocal}>
            {geo === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {/* Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {clienteSel && !modoNovo ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {clienteSel.razao_social}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[clienteSel.municipio, clienteSel.uf].filter(Boolean).join("/")}
                  {distCliente != null
                    ? ` · ${(distCliente / 1000).toFixed(2)} km do check-in`
                    : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClienteId(null)}
              >
                <X className="h-4 w-4" /> Trocar
              </Button>
            </div>
          ) : modoNovo ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Novo cliente — ficará <strong>pendente de validação</strong>.
              </p>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome / razão social do cliente ou obra"
              />
              <Select value={novoSegmento} onValueChange={setNovoSegmento}>
                <SelectTrigger>
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEGMENTOS[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setModoNovo(false)}>
                <X className="h-4 w-4" /> Cancelar novo
              </Button>
            </div>
          ) : (
            <>
              {proximos.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Clientes próximos
                  </p>
                  <div className="divide-y rounded-md border">
                    {proximos.map(({ c, dist }) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selecionar(c.id, c.segmento)}
                        className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {c.razao_social}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {(dist / 1000).toFixed(2)} km
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente por nome…"
              />
              {buscados.length > 0 && (
                <div className="divide-y rounded-md border">
                  {buscados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        selecionar(c.id, c.segmento);
                        setBusca("");
                      }}
                      className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {c.razao_social}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setModoNovo(true);
                  setClienteId(null);
                }}
              >
                <Plus className="h-4 w-4" /> Cadastrar novo cliente
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dados da visita */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Pessoa de contato</Label>
            <Input
              value={pessoaNome}
              onChange={(e) => setPessoaNome(e.target.value)}
              placeholder="Com quem você falou"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Motivo da visita <span className="text-destructive">*</span>
            </Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="O que foi tratado, próximos passos…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Perda para concorrente */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Perda de venda para concorrente
              </Label>
              <p className="text-xs text-muted-foreground">
                Registre concorrente, produto, preço e frete (gera R$/t/km).
              </p>
            </div>
            <Switch checked={perda} onCheckedChange={setPerda} />
          </div>

          {perda && (
            <div className="space-y-3">
              {concorrentes.map((c, i) => {
                const rtk =
                  c.frete_valor != null && c.distancia_km
                    ? c.frete_valor / c.distancia_km
                    : null;
                return (
                  <div key={i} className="space-y-2 rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.concorrente_nome ?? ""}
                        onChange={(e) =>
                          setConc(i, { concorrente_nome: e.target.value })
                        }
                        placeholder="Concorrente (produtor)"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        onClick={() => rmConc(i)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={c.produto ?? ""}
                        onChange={(e) => setConc(i, { produto: e.target.value })}
                        placeholder="Produto"
                      />
                      <MoneyInput
                        value={c.preco != null ? String(c.preco) : ""}
                        onChange={(v) =>
                          setConc(i, { preco: v ? Number(v) : null })
                        }
                        placeholder="Preço (R$)"
                      />
                      <MoneyInput
                        value={c.frete_valor != null ? String(c.frete_valor) : ""}
                        onChange={(v) =>
                          setConc(i, { frete_valor: v ? Number(v) : null })
                        }
                        placeholder="Frete (R$/t)"
                      />
                      <NumberInput
                        value={
                          c.distancia_km != null ? String(c.distancia_km) : ""
                        }
                        onChange={(v) =>
                          setConc(i, { distancia_km: v ? Number(v) : null })
                        }
                        decimals={0}
                        placeholder="Distância (km)"
                      />
                    </div>
                    {rtk != null && (
                      <p className="text-xs text-muted-foreground">
                        R$/t/km:{" "}
                        <strong className="tabular-nums">
                          {rtk.toLocaleString("pt-BR", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                        </strong>
                      </p>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" className="w-full" onClick={addConcorrente}>
                <Plus className="h-4 w-4" /> Adicionar concorrente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={salvar}
        disabled={salvando}
        className="w-full"
        size="lg"
      >
        {salvando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Registrar visita
      </Button>
    </div>
  );
}
