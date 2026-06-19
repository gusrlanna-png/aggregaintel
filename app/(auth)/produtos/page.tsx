"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Trash2, X } from "lucide-react";
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
  addAlias,
  addProduto,
  getNomesNaoCatalogados,
  getProdutos,
  mergeProdutos,
  removeAlias,
  removeProduto,
  updateProduto,
} from "@/lib/supabase/produtos";
import {
  PRODUTO_TIPOS,
  labelProduto,
  type ProdutoTipo,
} from "@/lib/utils/agregados";

export default function ProdutosPage() {
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = React.useState("");
  const [novoTipo, setNovoTipo] = React.useState<ProdutoTipo>("b1");
  const [busy, setBusy] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const [produtos, naoCat] = await Promise.all([
        getProdutos(),
        getNomesNaoCatalogados(),
      ]);
      return { produtos, naoCat };
    },
  });

  const [busca, setBusca] = React.useState("");
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setBusca(q);
  }, []);
  const nrm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const casa = React.useCallback(
    (...campos: (string | null | undefined)[]) => {
      const q = nrm(busca.trim());
      if (!q) return true;
      const hay = nrm(campos.filter(Boolean).join(" "));
      return q.split(/\s+/).every((t) => hay.includes(t));
    },
    [busca]
  );

  const todosProdutos = data?.produtos ?? []; // lista completa (alvos de mesclagem)
  const produtos = todosProdutos.filter((p) =>
    casa(p.nome, p.tipo, ...(p.aliases ?? []))
  );
  const naoCat = (data?.naoCat ?? []).filter((n) => casa(n.nome));

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["produtos"] });
  }

  async function criar() {
    if (!novoNome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    setBusy(true);
    try {
      await addProduto(novoNome, novoTipo, "manual");
      setNovoNome("");
      await refresh();
      toast.success("Produto cadastrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  async function cadastrarNome(nome: string, tipo: string) {
    setBusy(true);
    try {
      await addProduto(nome, tipo, "nf");
      await refresh();
      toast.success(`"${nome}" cadastrado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  async function mesclarNome(nome: string, produtoId: string) {
    setBusy(true);
    try {
      await addAlias(produtoId, nome);
      await refresh();
      toast.success(`"${nome}" mesclado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mesclar.");
    } finally {
      setBusy(false);
    }
  }

  async function mesclarProdutos(sourceId: string, targetId: string) {
    if (!targetId || sourceId === targetId) return;
    setBusy(true);
    try {
      await mergeProdutos(sourceId, targetId);
      await refresh();
      toast.success("Produtos mesclados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mesclar.");
    } finally {
      setBusy(false);
    }
  }

  async function excluir(id: string) {
    setBusy(true);
    try {
      await removeProduto(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function mudarTipo(id: string, tipo: ProdutoTipo) {
    setBusy(true);
    try {
      await updateProduto(id, { tipo });
      await refresh();
      toast.success(`Classificação alterada para ${labelProduto(tipo)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar.");
    } finally {
      setBusy(false);
    }
  }

  async function desvincular(produtoId: string, alias: string) {
    setBusy(true);
    try {
      await removeAlias(produtoId, alias);
      await refresh();
      toast.success(`"${alias}" desvinculado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desvincular.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/nf">
          <ArrowLeft className="h-4 w-4" /> NFs
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo baseado nos nomes extraídos das NFs. Cadastre novos e mescle
          similares.
        </p>
      </div>

      {/* Cadastrar novo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Novo produto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input
            placeholder="Nome do produto"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <Select
            value={novoTipo}
            onValueChange={(v) => setNovoTipo(v as ProdutoTipo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUTO_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {labelProduto(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={criar} disabled={busy}>
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto ou nome de NF…"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Catálogo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Catálogo ({produtos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {produtos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum produto cadastrado ainda.
                </p>
              ) : (
                produtos.map((p) => (
                  <div
                    key={p.id}
                    className="space-y-2 rounded-md border p-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.nome}</span>
                      {/* Classificação editável (mudar o vínculo do tipo) */}
                      <Select
                        value={p.tipo}
                        onValueChange={(v) => mudarTipo(p.id, v as ProdutoTipo)}
                      >
                        <SelectTrigger className="h-8 w-[170px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUTO_TIPOS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {labelProduto(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="ml-auto flex items-center gap-2">
                        {todosProdutos.length > 1 && (
                          <Select
                            onValueChange={(target) => mesclarProdutos(p.id, target)}
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue placeholder="Mesclar em…" />
                            </SelectTrigger>
                            <SelectContent>
                              {todosProdutos
                                .filter((o) => o.id !== p.id)
                                .map((o) => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {o.nome}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => excluir(p.id)}
                          title="Excluir produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Nomes vinculados (aliases) — removíveis para corrigir o vínculo */}
                    {(p.aliases ?? []).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">Nomes vinculados:</span>
                        {p.aliases.map((a) => (
                          <Badge key={a} variant="secondary" className="gap-1 font-normal">
                            {a}
                            <button
                              type="button"
                              onClick={() => desvincular(p.id, a)}
                              title="Desvincular este nome"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Não catalogados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Nomes nas NFs não catalogados ({naoCat.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {naoCat.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tudo catalogado. Capture NFs para descobrir novos nomes de
                  produto.
                </p>
              ) : (
                naoCat.map((n) => (
                  <div
                    key={n.nome}
                    className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                  >
                    <span className="font-medium">{n.nome}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {n.count}x
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      sugestão: {labelProduto(n.tipoInferido)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      {todosProdutos.length > 0 && (
                        <Select
                          onValueChange={(target) => mesclarNome(n.nome, target)}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="Mesclar em…" />
                          </SelectTrigger>
                          <SelectContent>
                            {todosProdutos.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => cadastrarNome(n.nome, n.tipoInferido)}
                      >
                        Cadastrar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
