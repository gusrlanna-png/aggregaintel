"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  MapPin,
  MonitorSmartphone,
  ShieldCheck,
  History,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAcessosRecentes,
  getDispositivos,
  setStatusDispositivo,
  type AcessoLog,
  type Dispositivo,
} from "@/lib/supabase/auditoria";
import {
  descreverDispositivo,
  descreverLocal,
  linkMapa,
} from "@/lib/utils/dispositivo";

const STATUS_BADGE: Record<Dispositivo["status"], { label: string; cls: string }> = {
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  bloqueado: { label: "Bloqueado", cls: "bg-destructive/15 text-destructive" },
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function IconeTipo({ tipo }: { tipo: "Celular" | "Tablet" | "Computador" }) {
  const I = tipo === "Celular" ? Smartphone : tipo === "Tablet" ? Tablet : Monitor;
  return <I className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function LinkLocal({ a }: { a: AcessoLog | Dispositivo }) {
  const texto = descreverLocal(a);
  if (!texto) return <span>{("ip" in a && a.ip) || "—"}</span>;
  const href = linkMapa(a);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin className="h-3 w-3" /> {texto}
    </a>
  ) : (
    <span>{texto}</span>
  );
}

type Ordenacao = "recentes" | "usuario" | "pagina" | "local";

export default function AuditoriaPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = React.useState("");
  const [agrupar, setAgrupar] = React.useState(true);
  const [ordem, setOrdem] = React.useState<Ordenacao>("recentes");
  const [abertoUser, setAbertoUser] = React.useState<string | null>(null);

  const { data: dispositivos = [] } = useQuery({
    queryKey: ["auditoria-dispositivos"],
    queryFn: getDispositivos,
  });
  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ["auditoria-acessos"],
    queryFn: () => getAcessosRecentes(1000),
  });

  async function alterar(id: string, status: Dispositivo["status"]) {
    try {
      await setStatusDispositivo(id, status);
      qc.invalidateQueries({ queryKey: ["auditoria-dispositivos"] });
      toast.success("Dispositivo atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return acessos;
    return acessos.filter((a) =>
      [a.email, a.recurso, a.acao, a.geo_cidade, a.geo_uf, descreverDispositivo(a.user_agent).label]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [acessos, busca]);

  const ordenados = React.useMemo(() => {
    const arr = [...filtrados];
    if (ordem === "usuario") arr.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    else if (ordem === "pagina") arr.sort((a, b) => (a.recurso ?? "").localeCompare(b.recurso ?? ""));
    else if (ordem === "local")
      arr.sort((a, b) => (a.geo_cidade ?? "").localeCompare(b.geo_cidade ?? ""));
    // "recentes": já vem desc por criado_em do servidor
    return arr;
  }, [filtrados, ordem]);

  // Agrupamento por usuário: total, último acesso, páginas e ações com contagem.
  const grupos = React.useMemo(() => {
    const m = new Map<
      string,
      {
        email: string;
        total: number;
        ultimo: string;
        local: AcessoLog | null;
        paginas: Map<string, number>;
        acoes: Map<string, number>;
      }
    >();
    for (const a of filtrados) {
      const k = a.email ?? "—";
      let g = m.get(k);
      if (!g) {
        g = { email: k, total: 0, ultimo: a.criado_em, local: a, paginas: new Map(), acoes: new Map() };
        m.set(k, g);
      }
      g.total++;
      if (a.criado_em > g.ultimo) {
        g.ultimo = a.criado_em;
        g.local = a;
      }
      if (a.recurso) g.paginas.set(a.recurso, (g.paginas.get(a.recurso) ?? 0) + 1);
      if (a.tipo === "acao" && a.acao) g.acoes.set(a.acao, (g.acoes.get(a.acao) ?? 0) + 1);
    }
    const lista = [...m.values()];
    if (ordem === "usuario") lista.sort((a, b) => a.email.localeCompare(b.email));
    else if (ordem === "pagina") lista.sort((a, b) => b.paginas.size - a.paginas.size);
    else lista.sort((a, b) => b.total - a.total); // recentes/local → por volume
    return lista;
  }, [filtrados, ordem]);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Auditoria e acessos</h1>
          <p className="text-sm text-muted-foreground">
            Dispositivos registrados e histórico de acessos/ações (apenas administradores).
          </p>
        </div>
      </div>

      {/* Dispositivos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4" /> Dispositivos ({dispositivos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dispositivos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum dispositivo registrado ainda.</p>
          ) : (
            <div className="divide-y">
              {dispositivos.map((d) => {
                const b = STATUS_BADGE[d.status];
                const dev = descreverDispositivo(d.user_agent);
                return (
                  <div key={d.id} className="flex items-center gap-2 p-3 text-sm">
                    <IconeTipo tipo={dev.tipo} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{dev.label}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>
                          {b.label}
                        </span>
                        {d.email && (
                          <span className="truncate text-xs text-muted-foreground">{d.email}</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {dev.tipo} · <LinkLocal a={d} /> · {d.ip ?? "—"} · {d.n_acessos} acessos ·{" "}
                        {fmt(d.ultimo_acesso)}
                      </span>
                    </span>
                    {d.status !== "aprovado" && (
                      <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => alterar(d.id, "aprovado")}>
                        Aprovar
                      </Button>
                    )}
                    {d.status !== "bloqueado" && (
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs text-destructive" onClick={() => alterar(d.id, "bloqueado")}>
                        Bloquear
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acessos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Acessos {agrupar ? "por usuário" : "recentes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuário, página, ação, cidade…"
              className="sm:col-span-1"
            />
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordenacao)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes / volume</SelectItem>
                <SelectItem value="usuario">Usuário (A–Z)</SelectItem>
                <SelectItem value="pagina">Página</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agrupar ? "grupo" : "lista"} onValueChange={(v) => setAgrupar(v === "grupo")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grupo">Agrupar por usuário</SelectItem>
                <SelectItem value="lista">Lista cronológica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem registros (ou sem permissão de administrador).
            </p>
          ) : agrupar ? (
            <div className="divide-y rounded-md border">
              {grupos.map((g) => {
                const aberto = abertoUser === g.email;
                const topPaginas = [...g.paginas.entries()].sort((a, b) => b[1] - a[1]);
                const topAcoes = [...g.acoes.entries()].sort((a, b) => b[1] - a[1]);
                return (
                  <div key={g.email}>
                    <button
                      type="button"
                      onClick={() => setAbertoUser(aberto ? null : g.email)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{g.email}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.total} acessos · {g.paginas.size} páginas ·{" "}
                          {g.local ? <LinkLocal a={g.local} /> : "—"} · {fmt(g.ultimo)}
                        </span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">{g.total}</Badge>
                    </button>
                    {aberto && (
                      <div className="space-y-2 bg-muted/30 px-3 pb-3 pt-1 text-xs">
                        <div>
                          <p className="mb-1 font-medium text-muted-foreground">Páginas</p>
                          <div className="flex flex-wrap gap-1">
                            {topPaginas.map(([p, n]) => (
                              <Badge key={p} variant="outline" className="font-normal">
                                {p} · {n}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {topAcoes.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-muted-foreground">Ações</p>
                            <div className="flex flex-wrap gap-1">
                              {topAcoes.map(([p, n]) => (
                                <Badge key={p} variant="warning" className="font-normal">
                                  {p} · {n}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-h-[32rem] divide-y overflow-y-auto rounded-md border">
              {ordenados.map((a) => (
                <div key={a.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      <span className="font-medium">{a.email ?? "—"}</span>
                      {a.tipo === "acao" ? (
                        <Badge variant="warning" className="ml-1.5 text-[10px]">{a.acao}</Badge>
                      ) : null}{" "}
                      <span className="text-muted-foreground">{a.recurso}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <LinkLocal a={a} /> · {descreverDispositivo(a.user_agent).label} · {fmt(a.criado_em)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {agrupar ? `${grupos.length} usuário(s)` : `${ordenados.length} registro(s)`}
            {busca ? " no filtro" : ""} · janela das últimas 1000 entradas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
