"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PORTES,
  deleteCarteira,
  getCarteiras,
  getRegioes,
  getSegmentosClientes,
  upsertCarteira,
  upsertRegiao,
  type Carteira,
} from "@/lib/supabase/carteiras";
import { getUsuarios } from "@/lib/supabase/perfil";

const vazia = (): Partial<Carteira> & { nome: string } => ({
  nome: "",
  segmento: null,
  vendedor_id: null,
  regioes: [],
  portes: [],
});

export default function CarteirasPage() {
  const qc = useQueryClient();
  const [novaRegiao, setNovaRegiao] = React.useState("");
  const [form, setForm] = React.useState<Partial<Carteira> & { nome: string }>(
    vazia()
  );
  const [salvando, setSalvando] = React.useState(false);

  const { data: regioes = [] } = useQuery({ queryKey: ["regioes"], queryFn: getRegioes });
  const { data: carteiras = [] } = useQuery({ queryKey: ["carteiras"], queryFn: getCarteiras });
  const { data: segmentos = [] } = useQuery({
    queryKey: ["segmentos-clientes"],
    queryFn: getSegmentosClientes,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["app-usuarios"],
    queryFn: getUsuarios,
  });

  const nomeUsuario = (id: string | null) =>
    usuarios.find((u) => u.id === id)?.nome ||
    usuarios.find((u) => u.id === id)?.email ||
    "—";

  async function addRegiao() {
    if (!novaRegiao.trim()) return;
    try {
      await upsertRegiao({ nome: novaRegiao.trim() });
      setNovaRegiao("");
      qc.invalidateQueries({ queryKey: ["regioes"] });
      toast.success("Região adicionada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  function toggleArr(key: "regioes" | "portes", v: string) {
    setForm((f) => {
      const arr = f[key] ?? [];
      return {
        ...f,
        [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
      };
    });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da carteira.");
      return;
    }
    setSalvando(true);
    try {
      await upsertCarteira(form);
      qc.invalidateQueries({ queryKey: ["carteiras"] });
      toast.success(form.id ? "Carteira atualizada." : "Carteira criada.");
      setForm(vazia());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    try {
      await deleteCarteira(id);
      qc.invalidateQueries({ queryKey: ["carteiras"] });
      toast.success("Carteira removida.");
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
        <Briefcase className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Carteiras de vendas</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Carteira = segmento + região/porte → vendedor responsável. O cliente cai
        na carteira pelas regras; um cliente pode ter dono próprio (prevalece).
      </p>

      {/* Regiões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regiões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={novaRegiao}
              onChange={(e) => setNovaRegiao(e.target.value)}
              placeholder="Nova região (ex.: Região 1 — Betim/Contagem)"
            />
            <Button onClick={addRegiao} variant="secondary">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {regioes.map((r) => (
              <Badge key={r.id} variant="secondary">
                {r.nome}
              </Badge>
            ))}
            {regioes.length === 0 && (
              <span className="text-xs text-muted-foreground">
                Nenhuma região cadastrada.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form de carteira */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Editar carteira" : "Nova carteira"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Nome da carteira</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Pré-moldados 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Segmento</Label>
            <Select
              value={form.segmento ?? "all"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, segmento: v === "all" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer segmento</SelectItem>
                {segmentos.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendedor responsável</Label>
            <Select
              value={form.vendedor_id ?? "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, vendedor_id: v === "none" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— sem vendedor —</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome || u.email || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Regiões (vazio = todas)</Label>
            <div className="flex flex-wrap gap-1.5">
              {regioes.map((r) => {
                const on = (form.regioes ?? []).includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleArr("regioes", r.id)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {r.nome}
                  </button>
                );
              })}
              {regioes.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Cadastre regiões acima.
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Portes (vazio = todos)</Label>
            <div className="flex flex-wrap gap-1.5">
              {PORTES.map((p) => {
                const on = (form.portes ?? []).includes(p.v);
                return (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => toggleArr("portes", p.v)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {form.id ? "Salvar" : "Criar carteira"}
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm(vazia())}>
                Cancelar edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de carteiras */}
      <Card>
        <CardContent className="divide-y p-0">
          {carteiras.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma carteira criada.
            </p>
          ) : (
            carteiras.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      c.segmento ?? "qualquer segmento",
                      `vendedor: ${nomeUsuario(c.vendedor_id)}`,
                      c.regioes.length ? `${c.regioes.length} região(ões)` : null,
                      c.portes.length ? `portes: ${c.portes.join("/")}` : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setForm(c)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remover(c.id)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
