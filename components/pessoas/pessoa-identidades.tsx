"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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
  getPessoaIdentidades,
  addPessoaIdentidade,
  deletePessoaIdentidade,
  FONTES_IDENTIDADE,
} from "@/lib/supabase/pessoas";

/**
 * Identidades de origem da pessoa: vincula o mesmo contato a várias fontes
 * (M365, 365/três-meia-cinco, LinkedIn, Instagram, WhatsApp, contrato…), cada
 * uma com seu id/handle. Base para unificar contatos vindos de fontes distintas.
 */
export function PessoaIdentidades({ pessoaId }: { pessoaId: string }) {
  const qc = useQueryClient();
  const { data: idents = [] } = useQuery({
    queryKey: ["pessoa-identidades", pessoaId],
    queryFn: () => getPessoaIdentidades(pessoaId),
  });

  const [fonte, setFonte] = React.useState("linkedin");
  const [handle, setHandle] = React.useState("");
  const [externalId, setExternalId] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  async function adicionar() {
    if (!handle.trim() && !externalId.trim() && !url.trim()) {
      toast.error("Informe ao menos o id, @ ou link da origem.");
      return;
    }
    setSalvando(true);
    try {
      await addPessoaIdentidade(pessoaId, {
        fonte,
        handle: handle.trim() || null,
        external_id: externalId.trim() || null,
        url: url.trim() || null,
      });
      setHandle("");
      setExternalId("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["pessoa-identidades", pessoaId] });
      toast.success("Identidade vinculada.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao vincular.";
      toast.error(/duplicate|unique/i.test(msg) ? "Esse id já está vinculado a alguém." : msg);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    try {
      await deletePessoaIdentidade(id);
      qc.invalidateQueries({ queryKey: ["pessoa-identidades", pessoaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4 text-muted-foreground" /> Identidades / origens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {idents.length > 0 && (
          <div className="divide-y rounded-md border">
            {idents.map((it) => (
              <div key={it.id} className="flex items-center gap-2 p-2 text-sm">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {FONTES_IDENTIDADE[it.fonte] ?? it.fonte}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {it.handle || it.external_id || it.url || "—"}
                </span>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    aria-label="Abrir"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => remover(it.id)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Select value={fonte} onValueChange={setFonte}>
            <SelectTrigger className="col-span-2">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FONTES_IDENTIDADE).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@ / usuário" />
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ID na origem" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (perfil/contrato)"
            className="col-span-2"
          />
        </div>
        <Button onClick={adicionar} disabled={salvando} size="sm" variant="outline" className="w-full">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Vincular identidade
        </Button>
      </CardContent>
    </Card>
  );
}
