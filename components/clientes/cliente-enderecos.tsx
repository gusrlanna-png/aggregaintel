"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  deleteClienteEndereco,
  getClienteEnderecos,
  upsertClienteEndereco,
  TIPOS_ENDERECO,
  type ClienteEndereco,
} from "@/lib/supabase/cliente-enderecos";
import { SEGMENTOS, type Segmento } from "@/lib/utils/agregados";

const VAZIO = {
  nome: "",
  tipo: "obra",
  segmento: "",
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
};

export function ClienteEnderecos({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState<typeof VAZIO | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const { data: enderecos = [], isLoading } = useQuery({
    queryKey: ["cliente-enderecos", empresaId],
    queryFn: () => getClienteEnderecos(empresaId),
  });

  function set<K extends keyof typeof VAZIO>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim() && !form.logradouro.trim()) {
      toast.error("Informe ao menos o nome ou o endereço da obra.");
      return;
    }
    setSalvando(true);
    try {
      await upsertClienteEndereco({
        empresa_id: empresaId,
        nome: form.nome || null,
        tipo: form.tipo || null,
        segmento: form.segmento || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        municipio: form.municipio || null,
        uf: form.uf || null,
        cep: form.cep || null,
      });
      await qc.invalidateQueries({ queryKey: ["cliente-enderecos", empresaId] });
      toast.success("Endereço salvo.");
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(e: ClienteEndereco) {
    if (!confirm(`Remover "${e.nome || e.logradouro || "endereço"}"?`)) return;
    try {
      await deleteClienteEndereco(e.id);
      await qc.invalidateQueries({ queryKey: ["cliente-enderecos", empresaId] });
      toast.success("Endereço removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  function linhaEndereco(e: ClienteEndereco): string {
    return [
      [e.logradouro, e.numero].filter(Boolean).join(", "),
      e.bairro,
      [e.municipio, e.uf].filter(Boolean).join("/"),
      e.cep,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Building2 className="h-4 w-4" /> Endereços de obras / usinas
          </p>
          {!form && (
            <Button size="sm" variant="outline" onClick={() => setForm({ ...VAZIO })}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : enderecos.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma obra/usina cadastrada. Locais de entrega do mesmo CNPJ
            (obra, usina, fábrica) aparecem aqui — também alimentados pela
            importação da fonte.
          </p>
        ) : (
          <ul className="divide-y">
            {enderecos.map((e) => {
              const seg = e.segmento
                ? SEGMENTOS[e.segmento as Segmento]?.label ?? e.segmento
                : null;
              return (
                <li key={e.id} className="flex items-start gap-2 py-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {e.nome || linhaEndereco(e) || "Endereço"}
                      {e.tipo && (
                        <Badge variant="secondary" className="font-normal">
                          {TIPOS_ENDERECO[e.tipo] ?? e.tipo}
                        </Badge>
                      )}
                      {seg && (
                        <Badge variant="outline" className="font-normal">
                          {seg}
                        </Badge>
                      )}
                      {!e.ativo && (
                        <Badge variant="warning" className="font-normal">
                          inativo
                        </Badge>
                      )}
                    </p>
                    {e.nome && linhaEndereco(e) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {linhaEndereco(e)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => remover(e)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {form && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome da obra / usina</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Ex.: Obra Av. Brasil, Usina Contagem…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_ENDERECO).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Segmento</Label>
                <Select
                  value={form.segmento || "none"}
                  onValueChange={(v) => set("segmento", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(Object.keys(SEGMENTOS) as Segmento[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SEGMENTOS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Logradouro</Label>
                <Input
                  value={form.logradouro}
                  onChange={(e) => set("logradouro", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input
                  value={form.numero}
                  onChange={(e) => set("numero", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={form.bairro}
                  onChange={(e) => set("bairro", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Município</Label>
                <Input
                  value={form.municipio}
                  onChange={(e) => set("municipio", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Input
                    value={form.uf}
                    maxLength={2}
                    onChange={(e) => set("uf", e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => set("cep", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForm(null)}
                disabled={salvando}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
