"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getClientes } from "@/lib/supabase/clientes";
import { mascararCnpj } from "@/lib/utils/cnpj";
import type { Cliente } from "@/lib/supabase/types";

/** Diálogo de busca para vincular a NF a um cliente já cadastrado. */
export function ClientePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (c: Cliente) => void;
}) {
  const [q, setQ] = React.useState("");
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes-all-picker"],
    queryFn: () => getClientes(),
    enabled: open,
  });

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const td = q.replace(/\D/g, "");
    const list = clientes as Cliente[];
    if (!t) return list.slice(0, 80);
    return list
      .filter(
        (c) =>
          c.razao_social.toLowerCase().includes(t) ||
          (td.length >= 3 && (c.cnpj || c.cpf || "").replace(/\D/g, "").includes(td))
      )
      .slice(0, 80);
  }, [q, clientes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Vincular a cliente cadastrado</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razão social, CNPJ ou CPF"
          />
        </div>
        <div className="max-h-[55vh] space-y-1 overflow-auto px-2 pb-3">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                  setQ("");
                }}
                className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-accent"
              >
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.razao_social}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.cnpj ? mascararCnpj(c.cnpj) : c.cpf ? c.cpf : "sem doc"}
                    {c.municipio ? ` · ${c.municipio}${c.uf ? "/" + c.uf : ""}` : ""}
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
