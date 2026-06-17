"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MBV, labelProduto } from "@/lib/utils/agregados";
import type { Emissor } from "@/lib/supabase/types";

export interface MixRow {
  id: string;
  emissor_id: string | null;
  nome_fornecedor: string;
  produto_tipo: string;
  share_pct: number;
}

let counter = 0;
const nextId = () => `mix-${++counter}`;

export function FornecedorMix({
  produtos,
  emissores,
  rows,
  onChange,
}: {
  produtos: string[];
  emissores: Emissor[];
  rows: MixRow[];
  onChange: (rows: MixRow[]) => void;
}) {
  const fornecedorOptions = React.useMemo(() => {
    const mbvFirst = emissores.find((e) => e.cnpj === MBV.cnpj);
    const others = emissores.filter((e) => e.cnpj !== MBV.cnpj);
    return mbvFirst ? [mbvFirst, ...others] : emissores;
  }, [emissores]);

  function add() {
    onChange([
      ...rows,
      {
        id: nextId(),
        emissor_id: fornecedorOptions[0]?.id ?? null,
        nome_fornecedor: fornecedorOptions[0]?.razao_social ?? "Fornecedor",
        produto_tipo: produtos[0] ?? "b1",
        share_pct: 50,
      },
    ]);
  }

  function update(id: string, patch: Partial<MixRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  // "Outros" por produto
  const restantePorProduto = new Map<string, number>();
  for (const p of produtos) {
    const soma = rows
      .filter((r) => r.produto_tipo === p)
      .reduce((s, r) => s + r.share_pct, 0);
    restantePorProduto.set(p, Math.max(0, 100 - soma));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum fornecedor adicionado. Informe quem abastece este cliente para
          calcular a oportunidade da MBV.
        </p>
      )}

      {rows.map((r) => {
        const isMbv =
          r.nome_fornecedor === MBV.razao ||
          r.nome_fornecedor.toLowerCase().includes("mbv");
        return (
          <Card key={r.id} className={isMbv ? "border-primary/50" : undefined}>
            <CardContent className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fornecedor</Label>
                  <Select
                    value={r.emissor_id ?? "outro"}
                    onValueChange={(v) => {
                      const em = emissores.find((e) => e.id === v);
                      update(r.id, {
                        emissor_id: em ? em.id : null,
                        nome_fornecedor: em ? em.razao_social : "Outro",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedorOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.razao_social}
                        </SelectItem>
                      ))}
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Produto</Label>
                  <Select
                    value={r.produto_tipo}
                    onValueChange={(v) => update(r.id, { produto_tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p} value={p}>
                          {labelProduto(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label className="text-xs">Participação</Label>
                  <span className="font-semibold tabular-nums">
                    {r.share_pct}%
                  </span>
                </div>
                <Slider
                  value={[r.share_pct]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => update(r.id, { share_pct: v[0] })}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(r.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {produtos.length > 0 && rows.length > 0 && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="mb-1 font-medium">Restante (Outros) por produto</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {produtos.map((p) => (
              <div key={p} className="flex justify-between">
                <span className="text-muted-foreground">{labelProduto(p)}</span>
                <span className="tabular-nums">
                  {restantePorProduto.get(p)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="h-4 w-4" /> Adicionar fornecedor
      </Button>
    </div>
  );
}
