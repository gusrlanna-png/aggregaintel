"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Gift,
  LocateFixed,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
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
import { getPessoas } from "@/lib/supabase/pessoas";
import { getBrindes } from "@/lib/supabase/brindes";
import {
  cadastrarClientePendente,
  criarVisita,
  distanciaMetros,
  getCategorias,
  getMotivos,
  type BrindeEntregaInput,
  type VisitaConcorrenteInput,
  type VisitaPessoaInput,
} from "@/lib/supabase/visitas";
import { SEGMENTOS, type Segmento } from "@/lib/utils/agregados";

export default function NovaVisitaPage() {
  const router = useRouter();
  const aberturaRef = React.useRef<string>("");
  if (!aberturaRef.current) aberturaRef.current = new Date().toISOString();

  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null
  );
  const [geo, setGeo] = React.useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [avulsa, setAvulsa] = React.useState(false);
  const [chegada, setChegada] = React.useState("");
  const [saida, setSaida] = React.useState("");

  const [busca, setBusca] = React.useState("");
  const [clienteId, setClienteId] = React.useState<string | null>(null);
  const [modoNovo, setModoNovo] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [novoSegmento, setNovoSegmento] = React.useState("outro");

  const [pessoas, setPessoas] = React.useState<VisitaPessoaInput[]>([]);
  const [buscaPessoa, setBuscaPessoa] = React.useState("");

  const [motivoId, setMotivoId] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState("");
  const [segmento, setSegmento] = React.useState("");
  const [obs, setObs] = React.useState("");

  const [perda, setPerda] = React.useState(false);
  const [concorrentes, setConcorrentes] = React.useState<VisitaConcorrenteInput[]>([]);
  const [brindes, setBrindes] = React.useState<BrindeEntregaInput[]>([]);
  const [salvando, setSalvando] = React.useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-list-visita"],
    queryFn: () => getClientes(),
  });
  const { data: pessoasCad = [] } = useQuery({
    queryKey: ["pessoas"],
    queryFn: getPessoas,
  });
  const { data: motivos = [] } = useQuery({ queryKey: ["visita-motivos"], queryFn: getMotivos });
  const { data: categorias = [] } = useQuery({
    queryKey: ["visita-categorias"],
    queryFn: getCategorias,
  });
  const { data: catalogoBrindes = [] } = useQuery({ queryKey: ["brindes"], queryFn: getBrindes });

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

  const pessoasBuscadas = React.useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase();
    if (!q) return [];
    return pessoasCad
      .filter((p) => p.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [buscaPessoa, pessoasCad]);

  const clienteSel = clientes.find((c) => c.id === clienteId) ?? null;
  const distCliente =
    coords && clienteSel?.lat != null && clienteSel?.lng != null
      ? distanciaMetros(coords.lat, coords.lng, clienteSel.lat as number, clienteSel.lng as number)
      : null;
  const catSel = categorias.find((c) => c.id === categoriaId) ?? null;
  const exigeBrinde = catSel?.exige_brinde ?? false;

  function selecionar(id: string, seg?: string | null) {
    setClienteId(id);
    setModoNovo(false);
    if (seg) setSegmento(seg);
  }

  function addPessoa(p: VisitaPessoaInput) {
    setPessoas((arr) => [...arr, p]);
  }
  function rmPessoa(i: number) {
    setPessoas((arr) => arr.filter((_, j) => j !== i));
  }

  function setConc(i: number, patch: Partial<VisitaConcorrenteInput>) {
    setConcorrentes((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function setBrinde(i: number, patch: Partial<BrindeEntregaInput>) {
    setBrindes((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
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
    // valida estoque de brindes
    for (const b of brindes) {
      const cat = catalogoBrindes.find((x) => x.id === b.brinde_id);
      if (cat && b.quantidade > cat.estoque) {
        toast.error(`Estoque insuficiente de ${cat.nome} (${cat.estoque}).`);
        return;
      }
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
          motivo_id: motivoId,
          categoria_id: categoriaId || null,
          segmento: segmento || novoSegmento || null,
          lat: avulsa ? null : coords?.lat ?? null,
          lng: avulsa ? null : coords?.lng ?? null,
          distancia_m: avulsa ? null : distCliente,
          avulsa,
          checkin_at: avulsa
            ? chegada
              ? new Date(chegada).toISOString()
              : aberturaRef.current
            : aberturaRef.current,
          checkout_at: avulsa
            ? saida
              ? new Date(saida).toISOString()
              : null
            : new Date().toISOString(),
          perda_venda: perda,
          observacoes: obs || null,
        },
        {
          pessoas,
          concorrentes: perda ? concorrentes : [],
          brindes: exigeBrinde ? brindes : [],
        }
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

      {/* Localização / avulsa */}
      <Card>
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <LocateFixed
                className={geo === "ok" ? "h-5 w-5 text-emerald-600" : "h-5 w-5 text-muted-foreground"}
              />
              {avulsa
                ? "Visita avulsa (sem GPS no local)"
                : geo === "loading"
                  ? "Capturando localização…"
                  : geo === "ok" && coords
                    ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : geo === "erro"
                      ? "GPS indisponível"
                      : "—"}
            </div>
            <label className="flex items-center gap-2 text-xs">
              Avulsa
              <Switch checked={avulsa} onCheckedChange={setAvulsa} />
            </label>
          </div>
          {avulsa && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Chegada</Label>
                <Input type="datetime-local" value={chegada} onChange={(e) => setChegada(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Saída</Label>
                <Input type="datetime-local" value={saida} onChange={(e) => setSaida(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Sem GPS no local, a distância ao cliente não é medida.
              </p>
            </div>
          )}
          {!avulsa && geo === "erro" && (
            <Button variant="outline" size="sm" onClick={pegarLocal}>
              <LocateFixed className="h-4 w-4" /> Tentar localizar de novo
            </Button>
          )}
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
                <span className="block truncate font-medium">{clienteSel.razao_social}</span>
                <span className="text-xs text-muted-foreground">
                  {[clienteSel.municipio, clienteSel.uf].filter(Boolean).join("/")}
                  {clienteSel.segmento ? ` · ${clienteSel.segmento}` : ""}
                  {distCliente != null ? ` · ${(distCliente / 1000).toFixed(2)} km` : ""}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setClienteId(null)}>
                <X className="h-4 w-4" /> Trocar
              </Button>
            </div>
          ) : modoNovo ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Novo cliente — ficará <strong>pendente de validação</strong>.
              </p>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome / razão social ou obra" />
              <Select value={novoSegmento} onValueChange={setNovoSegmento}>
                <SelectTrigger><SelectValue placeholder="Segmento" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
                    <SelectItem key={s} value={s}>{SEGMENTOS[s].label}</SelectItem>
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
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Clientes próximos</p>
                  <div className="divide-y rounded-md border">
                    {proximos.map(({ c, dist }) => (
                      <button key={c.id} type="button" onClick={() => selecionar(c.id, c.segmento)}
                        className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{c.razao_social}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">{(dist / 1000).toFixed(2)} km</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente por nome…" />
              {buscados.length > 0 && (
                <div className="divide-y rounded-md border">
                  {buscados.map((c) => (
                    <button key={c.id} type="button" onClick={() => { selecionar(c.id, c.segmento); setBusca(""); }}
                      className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{c.razao_social}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => { setModoNovo(true); setClienteId(null); }}>
                <Plus className="h-4 w-4" /> Cadastrar novo cliente
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pessoas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pessoas na visita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pessoas.length > 0 && (
            <div className="divide-y rounded-md border">
              {pessoas.map((p, i) => (
                <div key={i} className="flex items-center gap-2 p-2 text-sm">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {p.pessoa_nome}
                    {p.cargo ? ` · ${p.cargo}` : ""}
                    {p.pessoa_id ? "" : " (nova)"}
                  </span>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => rmPessoa(i)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Input value={buscaPessoa} onChange={(e) => setBuscaPessoa(e.target.value)} placeholder="Buscar pessoa cadastrada…" />
          {pessoasBuscadas.length > 0 && (
            <div className="divide-y rounded-md border">
              {pessoasBuscadas.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => { addPessoa({ pessoa_id: p.id, pessoa_nome: p.nome }); setBuscaPessoa(""); }}
                  className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                </button>
              ))}
            </div>
          )}
          {buscaPessoa.trim() && pessoasBuscadas.length === 0 && (
            <Button variant="outline" className="w-full"
              onClick={() => { addPessoa({ pessoa_nome: buscaPessoa.trim() }); setBuscaPessoa(""); }}>
              <Plus className="h-4 w-4" /> Adicionar “{buscaPessoa.trim()}” (nova pessoa)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dados da visita */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (<SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Observações / ações de acompanhamento</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Brindes (quando a categoria exige) */}
      {exigeBrinde && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4" /> Brindes entregues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brindes.map((b, i) => {
              const cat = catalogoBrindes.find((x) => x.id === b.brinde_id);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select value={b.brinde_id} onValueChange={(v) => setBrinde(i, { brinde_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Brinde" /></SelectTrigger>
                    <SelectContent>
                      {catalogoBrindes.map((x) => (
                        <SelectItem key={x.id} value={x.id}>{x.nome} (estoque {x.estoque})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={b.quantidade ? String(b.quantidade) : ""}
                    onChange={(e) => setBrinde(i, { quantidade: Number(e.target.value) || 0 })}
                    inputMode="numeric" placeholder="qtd" className="w-20"
                  />
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => setBrindes((arr) => arr.filter((_, j) => j !== i))} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {cat && b.quantidade > cat.estoque && (
                    <span className="text-xs text-destructive">sem estoque</span>
                  )}
                </div>
              );
            })}
            <Button variant="outline" className="w-full"
              onClick={() => setBrindes((b) => [...b, { brinde_id: "", quantidade: 1 }])}>
              <Plus className="h-4 w-4" /> Adicionar brinde
            </Button>
            {catalogoBrindes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum brinde cadastrado. Cadastre em Configurações → Brindes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detalhamento comercial */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Detalhamento comercial</Label>
              <p className="text-xs text-muted-foreground">
                Concorrentes, produto, volume, preço e frete (gera R$/t/km).
                {clienteSel?.segmento ? ` Segmento: ${clienteSel.segmento}.` : ""}
              </p>
            </div>
            <Switch checked={perda} onCheckedChange={setPerda} />
          </div>

          {perda && (
            <div className="space-y-3">
              {concorrentes.map((c, i) => {
                const rtk = c.frete_valor != null && c.distancia_km ? c.frete_valor / c.distancia_km : null;
                return (
                  <div key={i} className="space-y-2 rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Input value={c.concorrente_nome ?? ""} onChange={(e) => setConc(i, { concorrente_nome: e.target.value })} placeholder="Concorrente (produtor)" />
                      <Button variant="ghost" size="icon" className="shrink-0 text-destructive"
                        onClick={() => setConcorrentes((p) => p.filter((_, j) => j !== i))} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={c.produto ?? ""} onChange={(e) => setConc(i, { produto: e.target.value })} placeholder="Produto" />
                      <NumberInput value={c.volume != null ? String(c.volume) : ""} onChange={(v) => setConc(i, { volume: v ? Number(v) : null })} placeholder="Volume (t)" />
                      <MoneyInput value={c.preco != null ? String(c.preco) : ""} onChange={(v) => setConc(i, { preco: v ? Number(v) : null })} placeholder="Preço (R$)" />
                      <MoneyInput value={c.frete_valor != null ? String(c.frete_valor) : ""} onChange={(v) => setConc(i, { frete_valor: v ? Number(v) : null })} placeholder="Frete (R$/t)" />
                      <NumberInput value={c.distancia_km != null ? String(c.distancia_km) : ""} onChange={(v) => setConc(i, { distancia_km: v ? Number(v) : null })} decimals={0} placeholder="Distância (km)" />
                    </div>
                    {rtk != null && (
                      <p className="text-xs text-muted-foreground">
                        R$/t/km: <strong className="tabular-nums">{rtk.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong>
                      </p>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" className="w-full" onClick={() => setConcorrentes((p) => [...p, {}])}>
                <Plus className="h-4 w-4" /> Adicionar concorrente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={salvando} className="w-full" size="lg">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Registrar visita
      </Button>
    </div>
  );
}
