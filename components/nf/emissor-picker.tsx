"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getEmissores } from "@/lib/supabase/emissores";
import { mascararCnpj } from "@/lib/utils/cnpj";
import type { Emissor } from "@/lib/supabase/types";

/** Diálogo de busca para vincular a NF a um produtor já cadastrado. */
export function EmissorPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (e: Emissor) => void;
}) {
  const [q, setQ] = React.useState("");
  const { data: emissores = [], isLoading } = useQuery({
    queryKey: ["emissores-all"],
    queryFn: () => getEmissores(),
    enabled: open,
  });

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const td = q.replace(/\D/g, "");
    if (!t) return emissores.slice(0, 80);
    return emissores
      .filter(
        (e) =>
          e.razao_social.toLowerCase().includes(t) ||
          (td.length >= 3 && (e.cnpj || "").replace(/\D/g, "").includes(td))
      )
      .slice(0, 80);
  }, [q, emissores]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Vincular a produtor cadastrado</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razão social ou CNPJ"
          />
        </div>
        <div className="max-h-[55vh] space-y-1 overflow-auto px-2 pb-3">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhum produtor encontrado.
            </p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onSelect(e);
                  onOpenChange(false);
                  setQ("");
                }}
                className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-accent"
              >
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {e.razao_social}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {e.cnpj ? mascararCnpj(e.cnpj) : "sem CNPJ"}
                    {e.municipio
                      ? ` · ${e.municipio}${e.uf ? "/" + e.uf : ""}`
                      : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
