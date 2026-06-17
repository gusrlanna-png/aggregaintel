"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizar } from "@/components/ui/busca-tabela";
import {
  definirGrupoEmissores,
  renomearGrupo,
  type ProdutorMercado,
} from "@/lib/supabase/emissores";
import { renomearGrupoNosMercados } from "@/lib/supabase/mercados";

/**
 * Editor da composição de um grupo econômico. `grupo = null` abre em modo de
 * criação (digite o nome e adicione produtores). Recebe a lista completa de
 * produtores já carregada.
 */
export function GrupoEditor({
  grupo,
  produtores,
  open,
  onOpenChange,
}: {
  grupo: string | null;
  produtores: ProdutorMercado[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const novoModo = grupo == null;
  const [nome, setNome] = React.useState(grupo ?? "");
  const [busca, setBusca] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    setNome(grupo ?? "");
    setBusca("");
  }, [grupo, open]);

  // Grupo-alvo: existente usa o nome original; em criação usa o nome digitado.
  const chave = novoModo ? nome.trim() : grupo;

  const membros = React.useMemo(
    () => (chave ? produtores.filter((p) => p.grupo_economico === chave) : []),
    [produtores, chave]
  );

  const sugestoes = React.useMemo(() => {
    const q = normalizar(busca);
    if (q.length < 2) return [];
    return produtores
      .filter((p) => p.grupo_economico !== chave && normalizar(p.razao_social).includes(q))
      .slice(0, 8);
  }, [busca, produtores, chave]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["produtores-mercado"] });
    qc.invalidateQueries({ queryKey: ["mercados"] });
  };

  async function adicionar(id: string) {
    if (!chave) {
      toast.error("Defina o nome do grupo antes de adicionar produtores.");
      return;
    }
    try {
      await definirGrupoEmissores([id], chave);
      setBusca("");
      invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar.");
    }
  }
  async function remover(id: string) {
    try {
      await definirGrupoEmissores([id], null);
      invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }
  async function salvarNome() {
    if (novoModo || !grupo || !nome.trim() || nome.trim() === grupo) return;
    setSalvando(true);
    try {
      await renomearGrupo(grupo, nome);
      await renomearGrupoNosMercados(grupo, nome);
      toast.success(`Grupo renomeado para "${nome.trim()}".`);
      invalidar();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao renomear grupo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="block max-w-lg space-y-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {novoModo ? "Novo grupo econômico" : "Grupo econômico"}
          </DialogTitle>
        </DialogHeader>

        {/* Nome / renomear */}
        <div className="flex items-center gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-9"
            placeholder="Nome do grupo (ex.: PEMA, Grupo Santiago)"
          />
          {!novoModo && (
            <Button
              size="sm"
              onClick={salvarNome}
              disabled={salvando || !nome.trim() || nome.trim() === grupo}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Renomear"}
            </Button>
          )}
        </div>
        {novoModo && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Digite o nome e adicione produtores abaixo — o grupo é criado ao
            vincular o primeiro produtor.
          </p>
        )}

        {/* Membros */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {membros.length} produtor(es) no grupo
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
            {membros.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nenhum produtor neste grupo.
              </p>
            )}
            {membros.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Link
                  href={`/concorrentes/${p.id}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                  title="Abrir cadastro do produtor"
                >
                  {p.razao_social}
                  <span className="text-xs text-muted-foreground"> · {p.municipio ?? "—"}</span>
                </Link>
                <Link
                  href={`/concorrentes/${p.id}`}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Abrir cadastro"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => remover(p.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remover do grupo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Adicionar produtor */}
        <div className="relative">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Adicionar produtor ao grupo (buscar nome)…"
            className="h-9"
            disabled={!chave}
          />
          {sugestoes.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow-md">
              {sugestoes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => adicionar(p.id)}
                  className="flex w-full items-center gap-2 truncate px-3 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <Plus className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">
                    {p.razao_social}
                    <span className="text-muted-foreground"> · {p.municipio ?? "—"}</span>
                    {p.grupo_economico && (
                      <span className="text-amber-600"> (move de {p.grupo_economico})</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
