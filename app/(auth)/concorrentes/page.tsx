"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronRight, Loader2, MapPin, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuscaTabela, normalizar } from "@/components/ui/busca-tabela";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapaLocais, type LocalPonto } from "@/components/maps/mapa-locais";
import { GrupoSelect } from "@/components/concorrentes/grupo-select";
import {
  getProdutoresMercado,
  definirGrupoEmissores,
} from "@/lib/supabase/emissores";
import { getMercados, emissoresDoMercado } from "@/lib/supabase/mercados";
import { fmtReais } from "@/lib/utils/agregados";

const LIMITE = 150;
const soDig = (s?: string | null) => (s ?? "").replace(/\D/g, "");

function corGrupo(g?: string | null) {
  if (!g) return "#94a3b8";
  let h = 0;
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 42%)`;
}

export default function ConcorrentesPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [grupoFiltro, setGrupoFiltro] = React.useState("all");
  const [mercadoId, setMercadoId] = React.useState("all");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [grupoBulk, setGrupoBulk] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["produtores-mercado"],
    queryFn: getProdutoresMercado,
  });
  const { data: mercados } = useQuery({
    queryKey: ["mercados"],
    queryFn: getMercados,
  });

  const todos = React.useMemo(() => data ?? [], [data]);
  const mercadoSet = React.useMemo(() => {
    if (mercadoId === "all") return null;
    const merc = (mercados ?? []).find((m) => m.id === mercadoId) ?? null;
    return emissoresDoMercado(merc, todos);
  }, [mercadoId, mercados, todos]);
  const grupos = React.useMemo(
    () =>
      Array.from(
        new Set(todos.map((p) => p.grupo_economico).filter(Boolean))
      ).sort() as string[],
    [todos]
  );

  const filtrados = React.useMemo(() => {
    const q = normalizar(busca);
    const qDig = soDig(busca);
    return todos.filter((p) => {
      if (mercadoSet && !mercadoSet.has(p.id)) return false;
      if (status === "ativo" && !p.ativo) return false;
      if (status === "inativo" && p.ativo) return false;
      if (grupoFiltro === "__sem__" && p.grupo_economico) return false;
      if (grupoFiltro !== "all" && grupoFiltro !== "__sem__" && p.grupo_economico !== grupoFiltro)
        return false;
      if (q) {
        const campos = normalizar(
          `${p.razao_social} ${p.municipio ?? ""} ${p.substancias ?? ""} ${p.grupo_economico ?? ""}`
        );
        const hit =
          campos.includes(q) ||
          (qDig.length >= 3 && soDig(p.cnpj).includes(qDig));
        if (!hit) return false;
      }
      return true;
    });
  }, [todos, busca, status, grupoFiltro, mercadoSet]);

  const visiveis = filtrados.slice(0, LIMITE);

  // Mapa respeita os filtros (ex.: ao escolher um grupo, mostra só suas unidades).
  const pontos: LocalPonto[] = filtrados
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      nome: p.razao_social,
      lat: p.lat,
      lng: p.lng,
      detalhe: `${p.municipio ?? ""} · ${p.substancias ?? "—"}`,
      cor: corGrupo(p.grupo_economico),
      destaque: !!p.grupo_economico,
    }));

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function selecionarVisiveis() {
    setSel((s) => {
      const n = new Set(s);
      const todosMarcados = visiveis.every((p) => n.has(p.id));
      if (todosMarcados) visiveis.forEach((p) => n.delete(p.id));
      else visiveis.forEach((p) => n.add(p.id));
      return n;
    });
  }

  async function aplicarGrupo(limpar = false) {
    if (sel.size === 0) return;
    setSalvando(true);
    try {
      await definirGrupoEmissores([...sel], limpar ? null : grupoBulk);
      toast.success(
        limpar
          ? `Grupo removido de ${sel.size} produtor(es).`
          : `${sel.size} produtor(es) vinculados ao grupo "${grupoBulk.trim()}".`
      );
      setSel(new Set());
      setGrupoBulk("");
      qc.invalidateQueries({ queryKey: ["produtores-mercado"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar grupo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Mercado · Produtores</h1>
        <div className="flex items-center gap-2">
          <Link href="/pessoas" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Pessoas
          </Link>
          <Link href="/mercados" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Mercados
          </Link>
          <Link href="/mapa" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            Mapa de decisão
          </Link>
          <Link href="/concorrentes/novo" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            + Novo
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <BuscaTabela
            value={busca}
            onChange={setBusca}
            sugestoes={todos.map((p) => p.razao_social)}
            placeholder="Buscar por nome, CNPJ, município, substância…"
            id="produtores"
          />
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos (CFEM 12m)</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
          <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            <SelectItem value="__sem__">Sem grupo</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={selecionarVisiveis}>
          {visiveis.length > 0 && visiveis.every((p) => sel.has(p.id))
            ? "Desmarcar visíveis"
            : "Selecionar visíveis"}
        </Button>
      </div>

      {/* Barra de agrupamento (aparece com seleção) */}
      {sel.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Tag className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{sel.size} selecionado(s)</span>
            <Input
              value={grupoBulk}
              onChange={(e) => setGrupoBulk(e.target.value)}
              placeholder="Nome do grupo (ex.: PEMA, Grupo Santiago)"
              className="h-9 w-64"
              list="grupos-existentes"
            />
            <datalist id="grupos-existentes">
              {grupos.map((g) => (<option key={g} value={g} />))}
            </datalist>
            <Button size="sm" disabled={!grupoBulk.trim() || salvando} onClick={() => aplicarGrupo(false)}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
              Vincular ao grupo
            </Button>
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => aplicarGrupo(true)}>
              Remover grupo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
              <X className="h-4 w-4" /> Limpar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" /> Mapa de produtores ({pontos.length})
            {grupoFiltro !== "all" && grupoFiltro !== "__sem__" && (
              <span className="text-xs font-normal text-muted-foreground">· {grupoFiltro}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MapaLocais pontos={pontos.slice(0, 800)} altura={320} />
        </CardContent>
      </Card>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {filtrados.length.toLocaleString("pt-BR")} produtores
          {filtrados.length !== todos.length && ` (de ${todos.length.toLocaleString("pt-BR")})`}
          {filtrados.length > LIMITE && ` · exibindo os primeiros ${LIMITE}`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum produtor encontrado para o filtro.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visiveis.map((p) => {
              const local = [p.municipio, p.uf].filter(Boolean).join("/");
              const linha2 = [local, p.substancias, fmtReais(p.cfem_12m) + " CFEM 12m"]
                .filter(Boolean)
                .join("  ·  ");
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  style={{ borderLeft: `3px solid ${corGrupo(p.grupo_economico)}` }}
                >
                  <input
                    type="checkbox"
                    checked={sel.has(p.id)}
                    onChange={() => toggle(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 shrink-0"
                    title="Selecionar para agrupar"
                  />
                  <Link
                    href={`/concorrentes/${p.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <span className="truncate">{p.razao_social}</span>
                        {p.tambem_cliente && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">cliente</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{linha2}</p>
                    </div>
                  </Link>
                  <GrupoSelect
                    emissorId={p.id}
                    grupoAtual={p.grupo_economico}
                    grupos={grupos}
                    compact
                    onChanged={() =>
                      qc.invalidateQueries({ queryKey: ["produtores-mercado"] })
                    }
                  />
                  <Badge variant={p.ativo ? "success" : "secondary"} className="hidden shrink-0 sm:inline-flex">
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Link
                    href={`/concorrentes/${p.id}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Abrir cadastro"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
