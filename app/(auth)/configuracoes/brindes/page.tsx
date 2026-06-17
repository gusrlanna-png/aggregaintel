"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Gift, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  entradaEstoque,
  getBrindes,
  getHistoricoBrindes,
  upsertBrinde,
} from "@/lib/supabase/brindes";

export default function BrindesPage() {
  const qc = useQueryClient();
  const [novo, setNovo] = React.useState("");
  const [qtd, setQtd] = React.useState<Record<string, string>>({});
  const { data: brindes = [], isLoading } = useQuery({
    queryKey: ["brindes"],
    queryFn: getBrindes,
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["brinde-historico"],
    queryFn: () => getHistoricoBrindes(),
  });

  function exportarCSV() {
    const linhas: string[][] = [["Data", "Brinde", "Qtd", "Cliente", "Pessoa"]];
    for (const h of historico) {
      linhas.push([
        (h.criado_em ?? "").slice(0, 10),
        h.brinde?.nome ?? "",
        String(h.quantidade),
        h.cliente?.razao_social ?? "",
        h.pessoa?.nome ?? "",
      ]);
    }
    const csv = linhas
      .map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brindes-entregues.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function criar() {
    if (!novo.trim()) return;
    try {
      await upsertBrinde({ nome: novo.trim() });
      setNovo("");
      qc.invalidateQueries({ queryKey: ["brindes"] });
      toast.success("Brinde cadastrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function darEntrada(id: string) {
    const n = Number(qtd[id]);
    if (!n || n <= 0) {
      toast.error("Informe a quantidade.");
      return;
    }
    try {
      await entradaEstoque(id, n);
      setQtd((q) => ({ ...q, [id]: "" }));
      qc.invalidateQueries({ queryKey: ["brindes"] });
      toast.success(`+${n} em estoque.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Brindes</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Catálogo e estoque de brindes. A baixa acontece na entrega durante a
        visita (categoria “Entrega de brindes”).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo brinde</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Ex.: Boné, Camiseta, Caneca…"
          />
          <Button onClick={criar} variant="secondary">
            <Plus className="h-4 w-4" /> Cadastrar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : brindes.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum brinde cadastrado.
            </p>
          ) : (
            brindes.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Estoque:{" "}
                    <Badge
                      variant={b.estoque > 0 ? "secondary" : "warning"}
                      className="text-[10px]"
                    >
                      {b.estoque}
                    </Badge>
                  </p>
                </div>
                <Input
                  value={qtd[b.id] ?? ""}
                  onChange={(e) =>
                    setQtd((q) => ({ ...q, [b.id]: e.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="qtd"
                  className="h-9 w-20"
                />
                <Button size="sm" variant="outline" onClick={() => darEntrada(b.id)}>
                  <Plus className="h-4 w-4" /> Entrada
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Histórico de entregas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Histórico de entregas ({historico.length})
          </CardTitle>
          {historico.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportarCSV}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="divide-y p-0">
          {historico.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega registrada ainda.
            </p>
          ) : (
            historico.slice(0, 200).map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{h.brinde?.nome ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {h.cliente?.razao_social ?? "—"}
                    {h.pessoa?.nome ? ` · ${h.pessoa.nome}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(h.criado_em ?? "").slice(0, 10)}
                </span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {h.quantidade} un.
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
