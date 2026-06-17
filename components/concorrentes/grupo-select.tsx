"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { definirGrupoEmissores } from "@/lib/supabase/emissores";

const SEM = "__none__";
const NOVO = "__new__";

/**
 * Seletor para vincular um produtor a um grupo econômico existente, removê-lo
 * do grupo, ou criar um novo grupo na hora.
 */
export function GrupoSelect({
  emissorId,
  grupoAtual,
  grupos,
  onChanged,
  compact = false,
}: {
  emissorId: string;
  grupoAtual: string | null;
  grupos: string[];
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [criando, setCriando] = React.useState(false);
  const [novo, setNovo] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  async function aplicar(valor: string | null) {
    setSalvando(true);
    try {
      await definirGrupoEmissores([emissorId], valor);
      toast.success(valor ? `Vinculado ao grupo "${valor}".` : "Removido do grupo.");
      setCriando(false);
      setNovo("");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao vincular grupo.");
    } finally {
      setSalvando(false);
    }
  }

  if (criando) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          autoFocus
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Novo grupo"
          className={compact ? "h-7 w-36 text-xs" : "h-9"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && novo.trim()) aplicar(novo.trim());
            if (e.key === "Escape") setCriando(false);
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          disabled={!novo.trim() || salvando}
          onClick={() => aplicar(novo.trim())}
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => setCriando(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={grupoAtual ?? SEM}
        onValueChange={(v) => {
          if (v === NOVO) setCriando(true);
          else aplicar(v === SEM ? null : v);
        }}
      >
        <SelectTrigger
          className={compact ? "h-7 w-40 text-xs" : "h-9"}
          disabled={salvando}
        >
          <SelectValue placeholder="Grupo econômico" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM}>Sem grupo</SelectItem>
          {grupos.map((g) => (
            <SelectItem key={g} value={g}>{g}</SelectItem>
          ))}
          <SelectItem value={NOVO}>➕ Criar novo grupo…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
