"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers, Loader2, Plus, Trash2, X } from "lucide-react";
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
import { normalizar } from "@/components/ui/busca-tabela";
import { GrupoEditor } from "@/components/concorrentes/grupo-editor";
import {
  getProdutoresMercado,
  definirGrupoEmissores,
  type ProdutorMercado,
} from "@/lib/supabase/emissores";
import { getSugestoesGrupo, type SugestaoGrupo } from "@/lib/supabase/sugestoes-grupo";
import {
  addMembro,
  criarMercado,
  excluirMercado,
  getMercados,
  removeMembro,
  type Mercado,
} from "@/lib/supabase/mercados";

export default function MercadosPage() {
  const qc = useQueryClient();
  const [nome, setNome] = React.useState("");
  const [grupoEdit, setGrupoEdit] = React.useState<string | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const abrirEditor = (g: string) => {
    setGrupoEdit(g);
    setEditorOpen(true);
  };

  const { data: mercados, isLoading } = useQuery({
    queryKey: ["mercados"],
    queryFn: getMercados,
  });
  const { data: produtores } = useQuery({
    queryKey: ["produtores-mercado"],
    queryFn: getProdutoresMercado,
  });
  const { data: sugestoes = [], isLoading: loadingSug } = useQuery({
    queryKey: ["sugestoes-grupo"],
    queryFn: getSugestoesGrupo,
  });

  const grupos = React.useMemo(
    () =>
      Array.from(
        new Set((produtores ?? []).map((p) => p.grupo_economico).filter(Boolean))
      ).sort() as string[],
    [produtores]
  );
  const nomeProdutor = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of produtores ?? []) m.set(p.id, p.razao_social);
    return m;
  }, [produtores]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["mercados"] });

  async function criar() {
    if (!nome.trim()) return;
    try {
      await criarMercado(nome);
      toast.success(`Mercado "${nome.trim()}" criado.`);
      setNome("");
      invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar mercado.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/concorrentes">
            <ArrowLeft className="h-4 w-4" /> Produtores
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Layers className="h-5 w-5" /> Mercados
        </h1>
        <p className="text-sm text-muted-foreground">
          Agrupe grupos econômicos e/ou produtores específicos em um mercado (ex.:
          “Agregados RMBH”) para restringir as visões e o Mapa de decisão.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do mercado (ex.: Agregados RMBH)"
            className="h-9 w-72"
            onKeyDown={(e) => e.key === "Enter" && criar()}
          />
          <Button size="sm" onClick={criar} disabled={!nome.trim()}>
            <Plus className="h-4 w-4" /> Criar mercado
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setGrupoEdit(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo grupo econômico
          </Button>
        </CardContent>
      </Card>

      {/* Sugestões automáticas por sócios em comum */}
      {(loadingSug || sugestoes.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Sugestões de grupo — sócios em comum {sugestoes.length > 0 && `(${sugestoes.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingSug ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> analisando sócios…
              </p>
            ) : (
              sugestoes.slice(0, 12).map((sg) => (
                <SugestaoRow key={sg.chave} sg={sg} onChange={invalidar} />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (mercados ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum mercado criado ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {(mercados ?? []).map((m) => (
            <MercadoCard
              key={m.id}
              mercado={m}
              grupos={grupos}
              produtores={produtores ?? []}
              nomeProdutor={nomeProdutor}
              onChange={invalidar}
              onEditarGrupo={abrirEditor}
            />
          ))}
        </div>
      )}

      <GrupoEditor
        grupo={grupoEdit}
        produtores={produtores ?? []}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  );
}

function SugestaoRow({ sg, onChange }: { sg: SugestaoGrupo; onChange: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = React.useState(sg.nomeSugerido);
  const [salvando, setSalvando] = React.useState(false);

  async function aplicar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await definirGrupoEmissores(sg.membros.map((m) => m.id), nome.trim());
      toast.success(`${sg.membros.length} empresas vinculadas ao grupo "${nome.trim()}".`);
      qc.invalidateQueries({ queryKey: ["sugestoes-grupo"] });
      qc.invalidateQueries({ queryKey: ["produtores-mercado"] });
      qc.invalidateQueries({ queryKey: ["grupos-economicos"] });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar grupo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-md border p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-8 w-56 text-sm"
        />
        <Button size="sm" onClick={aplicar} disabled={salvando || !nome.trim()}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Agrupar {sg.membros.length}
        </Button>
        {sg.socios.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            sócios: {sg.socios.slice(0, 3).join(", ")}
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {sg.membros.map((m) => (
          <li key={m.id}>
            <Link
              href={`/concorrentes/${m.id}`}
              className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
              title={m.grupo_economico ? `Atual: ${m.grupo_economico}` : "Sem grupo"}
            >
              {m.razao_social}
              {m.grupo_economico ? ` · ${m.grupo_economico}` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MercadoCard({
  mercado,
  grupos,
  produtores,
  nomeProdutor,
  onChange,
  onEditarGrupo,
}: {
  mercado: Mercado;
  grupos: string[];
  produtores: ProdutorMercado[];
  nomeProdutor: Map<string, string>;
  onChange: () => void;
  onEditarGrupo: (g: string) => void;
}) {
  const [grupoSel, setGrupoSel] = React.useState("");
  const [buscaProd, setBuscaProd] = React.useState("");

  const sugestoes = React.useMemo(() => {
    const q = normalizar(buscaProd);
    if (q.length < 2) return [];
    return produtores
      .filter((p) => normalizar(p.razao_social).includes(q))
      .slice(0, 6);
  }, [buscaProd, produtores]);

  async function add(tipo: "grupo" | "produtor", valor: string) {
    try {
      await addMembro(mercado.id, tipo, valor);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar.");
    }
  }
  async function remover(id: string) {
    try {
      await removeMembro(id);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }
  async function excluir() {
    try {
      await excluirMercado(mercado.id);
      toast.success("Mercado excluído.");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{mercado.nome}</CardTitle>
        <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Membros */}
        <div className="flex flex-wrap gap-1.5">
          {mercado.membros.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Sem membros — adicione grupos ou produtores abaixo.
            </span>
          )}
          {mercado.membros.map((mb) => (
            <Badge
              key={mb.id}
              variant="secondary"
              className={mb.tipo === "grupo" ? "gap-1 cursor-pointer" : "gap-1"}
              title={mb.tipo === "grupo" ? "Duplo-clique para editar o grupo" : undefined}
              onDoubleClick={mb.tipo === "grupo" ? () => onEditarGrupo(mb.valor) : undefined}
            >
              {mb.tipo === "grupo" ? "📦 " : "🏭 "}
              {mb.tipo === "grupo" ? mb.valor : nomeProdutor.get(mb.valor) ?? "produtor"}
              <button onClick={() => remover(mb.id)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        {/* Adicionar grupo */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={grupoSel} onValueChange={(v) => { setGrupoSel(v); add("grupo", v); setGrupoSel(""); }}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="+ Adicionar grupo econômico" />
            </SelectTrigger>
            <SelectContent>
              {grupos.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Adicionar produtor por busca */}
          <div className="relative">
            <Input
              value={buscaProd}
              onChange={(e) => setBuscaProd(e.target.value)}
              placeholder="+ Adicionar produtor (buscar nome)"
              className="h-8 w-64 text-xs"
            />
            {sugestoes.length > 0 && (
              <div className="absolute z-10 mt-1 w-72 rounded-md border bg-background shadow-md">
                {sugestoes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { add("produtor", p.id); setBuscaProd(""); }}
                    className="block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    {p.razao_social}
                    <span className="text-muted-foreground"> · {p.municipio ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
