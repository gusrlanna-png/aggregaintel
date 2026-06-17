"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Pencil, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { removeIntel, updateIntel } from "@/lib/supabase/intel";
import type { InteligenciaMercado } from "@/lib/supabase/types";

const CONF_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  alta: "success",
  media: "secondary",
  baixa: "warning",
};

const TIPO_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  manual: "Manual",
  nf: "NF",
  anm: "ANM",
  outro: "Outro",
};

function IntelCard({
  item,
  onChanged,
}: {
  item: InteligenciaMercado;
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState(item);

  React.useEffect(() => setDraft(item), [item]);

  const when = item.criado_em
    ? formatDistanceToNow(new Date(item.criado_em), {
        addSuffix: true,
        locale: ptBR,
      })
    : "";

  async function toggleImportante() {
    setBusy(true);
    try {
      await updateIntel(item.id, { importante: !item.importante });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function excluir() {
    setBusy(true);
    try {
      await removeIntel(item.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function salvarEdicao() {
    setBusy(true);
    try {
      await updateIntel(item.id, {
        texto_extraido: draft.texto_extraido,
        classificacao: draft.classificacao,
        confianca: draft.confianca,
        cliente_nome: draft.cliente_nome,
        valor_num: draft.valor_num,
        unidade: draft.unidade,
        tags: draft.tags,
      });
      setEditing(false);
      onChanged();
      toast.success("Atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn(item.importante && "border-amber-400")}>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.is_sintese && (
            <Badge className="gap-1">
              <Sparkles className="h-3 w-3" /> Síntese
            </Badge>
          )}
          <Badge variant="outline">
            {TIPO_LABEL[item.tipo_fonte] ?? item.tipo_fonte}
          </Badge>
          {item.classificacao && (
            <Badge variant="info">{item.classificacao}</Badge>
          )}
          {item.confianca && (
            <Badge variant={CONF_VARIANT[item.confianca] ?? "secondary"}>
              {item.confianca}
            </Badge>
          )}
          {item.cliente_nome && (
            <span className="text-xs font-medium text-primary">
              {item.cliente_nome}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {item.data_info ?? when}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-snug">
          {item.texto_extraido}
        </p>

        {item.valor_num != null && (
          <p className="text-sm font-medium tabular-nums">
            {item.valor_num} {item.unidade ?? ""}
          </p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1", item.importante && "text-amber-500")}
            onClick={toggleImportante}
            disabled={busy}
          >
            <Star
              className={cn("h-4 w-4", item.importante && "fill-amber-400")}
            />
            {item.importante ? "Importante" : "Marcar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 gap-1 text-destructive"
            onClick={excluir}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar informação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Texto</Label>
              <Textarea
                rows={3}
                value={draft.texto_extraido ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, texto_extraido: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Classificação</Label>
                <Select
                  value={draft.classificacao ?? "outro"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, classificacao: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["preco", "volume", "concorrente", "cliente", "alerta", "outro"].map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confiança</Label>
                <Select
                  value={draft.confianca ?? "media"}
                  onValueChange={(v) => setDraft({ ...draft, confianca: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["alta", "media", "baixa"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente / empresa</Label>
              <Input
                value={draft.cliente_nome ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, cliente_nome: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (separadas por vírgula)</Label>
              <Input
                value={(draft.tags ?? []).join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function IntelFeed({
  items,
  onChanged,
  groupByCliente,
}: {
  items: InteligenciaMercado[];
  onChanged: () => void;
  groupByCliente?: boolean;
}) {
  if (!items.length)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma informação encontrada.
      </p>
    );

  if (!groupByCliente) {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <IntelCard key={item.id} item={item} onChanged={onChanged} />
        ))}
      </div>
    );
  }

  const grupos = new Map<string, InteligenciaMercado[]>();
  for (const it of items) {
    const key = it.cliente_nome?.trim() || "Geral";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(it);
  }

  return (
    <div className="space-y-4">
      {Array.from(grupos.entries()).map(([cliente, lista]) => (
        <div key={cliente} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {cliente}
            <Badge variant="secondary" className="text-[10px]">
              {lista.length}
            </Badge>
          </h3>
          {lista.map((item) => (
            <IntelCard key={item.id} item={item} onChanged={onChanged} />
          ))}
        </div>
      ))}
    </div>
  );
}
