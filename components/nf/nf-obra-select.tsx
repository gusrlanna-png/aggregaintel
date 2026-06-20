"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClienteEnderecos } from "@/lib/supabase/cliente-enderecos";
import { setNFEndereco } from "@/lib/supabase/nf";

/** Seleciona/ajusta manualmente a obra/usina de entrega de uma NF. */
export function NfObraSelect({
  nfId,
  clienteId,
  enderecoId,
}: {
  nfId: string;
  clienteId: string | null;
  enderecoId: string | null;
}) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = React.useState(false);
  const { data: enderecos = [] } = useQuery({
    queryKey: ["cliente-enderecos", clienteId],
    queryFn: () => getClienteEnderecos(clienteId!),
    enabled: !!clienteId,
  });

  if (!clienteId || enderecos.length === 0) return null;

  async function mudar(v: string) {
    setSalvando(true);
    try {
      await setNFEndereco(nfId, v === "none" ? null : v);
      await qc.invalidateQueries({ queryKey: ["nf", nfId] });
      toast.success("Obra atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">Obra / usina</span>
      <Select value={enderecoId ?? "none"} onValueChange={mudar} disabled={salvando}>
        <SelectTrigger className="h-8 w-[230px] text-xs">
          <SelectValue placeholder="— Definir obra" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Sem obra específica</SelectItem>
          {enderecos.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {(e.nome || e.bairro || "Endereço") + (e.municipio ? ` · ${e.municipio}` : "")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
