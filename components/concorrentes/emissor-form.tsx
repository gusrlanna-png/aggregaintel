"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGruposEconomicos,
  upsertEmissor,
} from "@/lib/supabase/emissores";
import type { Emissor } from "@/lib/supabase/types";
import { mascararCnpj } from "@/lib/utils/cnpj";

type FormState = {
  razao_social: string;
  cnpj: string;
  inscricao_est: string;
  logradouro: string;
  municipio: string;
  uf: string;
  cep: string;
  fone: string;
  tipo: string;
  status_legal: string;
  capacidade_ton_mes: string;
  grupo_economico: string;
  eh_mbv: boolean;
  notas: string;
};

function fromEmissor(e?: Emissor | null): FormState {
  return {
    razao_social: e?.razao_social ?? "",
    cnpj: mascararCnpj(e?.cnpj ?? ""),
    inscricao_est: e?.inscricao_est ?? "",
    logradouro: e?.logradouro ?? "",
    municipio: e?.municipio ?? "",
    uf: e?.uf ?? "MG",
    cep: e?.cep ?? "",
    fone: e?.fone ?? "",
    tipo: e?.tipo ?? "concorrente",
    status_legal: e?.status_legal ?? "ativo",
    capacidade_ton_mes: e?.capacidade_ton_mes
      ? String(e.capacidade_ton_mes)
      : "",
    grupo_economico: e?.grupo_economico ?? "",
    eh_mbv: Boolean(e?.eh_mbv),
    notas: e?.notas ?? "",
  };
}

export function EmissorForm({ emissor }: { emissor?: Emissor | null }) {
  const router = useRouter();
  const [f, setF] = React.useState<FormState>(fromEmissor(emissor));
  const [saving, setSaving] = React.useState(false);
  const [buscando, setBuscando] = React.useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-economicos"],
    queryFn: () => getGruposEconomicos(),
  });

  async function buscarCnpj() {
    const digits = f.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(`/api/cnpj/${digits}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "CNPJ não encontrado.");
        return;
      }
      setF((p) => ({
        ...p,
        razao_social: json.razao_social ?? p.razao_social,
        cnpj: json.cnpj ?? p.cnpj,
        logradouro: json.logradouro ?? p.logradouro,
        municipio: json.municipio ?? p.municipio,
        uf: json.uf ?? p.uf,
        cep: json.cep ?? p.cep,
        fone: json.fone ?? p.fone,
      }));
      toast.success(
        `Dados de ${json.razao_social ?? "CNPJ"} preenchidos${
          json.situacao ? ` · ${json.situacao}` : ""
        }.`
      );
    } catch {
      toast.error("Falha ao consultar o CNPJ.");
    } finally {
      setBuscando(false);
    }
  }

  async function salvar() {
    if (!f.razao_social.trim()) {
      toast.error("Razão social é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertEmissor({
        id: emissor?.id,
        razao_social: f.razao_social,
        cnpj: f.cnpj || undefined,
        inscricao_est: f.inscricao_est || null,
        logradouro: f.logradouro || null,
        municipio: f.municipio || null,
        uf: f.uf || null,
        cep: f.cep || null,
        fone: f.fone || null,
        tipo: f.tipo,
        status_legal: f.status_legal,
        capacidade_ton_mes: f.capacidade_ton_mes
          ? Number(f.capacidade_ton_mes)
          : null,
        grupo_economico: f.grupo_economico.trim() || null,
        eh_mbv: f.eh_mbv,
        notas: f.notas || null,
      });
      toast.success(emissor ? "Produtor atualizado." : "Produtor cadastrado.");
      router.push(`/concorrentes/${saved.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* CNPJ com busca automática */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Label className="text-xs">
            CNPJ — informe e busque os dados cadastrais
          </Label>
          <div className="flex gap-2">
            <Input
              value={f.cnpj}
              onChange={(e) => set("cnpj", mascararCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={buscarCnpj}
              disabled={buscando}
            >
              {buscando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Preenche razão social, endereço, município, UF, CEP e telefone via
            Receita Federal (BrasilAPI).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Razão social *</Label>
            <Input
              value={f.razao_social}
              onChange={(e) => set("razao_social", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Inscrição estadual</Label>
            <Input
              value={f.inscricao_est}
              onChange={(e) => set("inscricao_est", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input value={f.fone} onChange={(e) => set("fone", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input
              value={f.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Município</Label>
            <Input
              value={f.municipio}
              onChange={(e) => set("municipio", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">UF</Label>
              <Input value={f.uf} onChange={(e) => set("uf", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CEP</Label>
              <Input value={f.cep} onChange={(e) => set("cep", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concorrente">Concorrente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status legal</Label>
            <Select
              value={f.status_legal}
              onValueChange={(v) => set("status_legal", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="rec_judicial">Rec. judicial</SelectItem>
                <SelectItem value="falido">Falido</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Capacidade (t/mês)</Label>
            <NumberInput
              value={f.capacidade_ton_mes}
              onChange={(v) => set("capacidade_ton_mes", v)}
              decimals={0}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Grupo econômico</Label>
            <Input
              list="grupos-economicos"
              value={f.grupo_economico}
              onChange={(e) => set("grupo_economico", e.target.value)}
              placeholder="Selecione ou crie um grupo"
            />
            <datalist id="grupos-economicos">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Use o mesmo nome para vincular várias empresas ao grupo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Nossa empresa (MBV) */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <Label htmlFor="eh-mbv" className="text-sm font-medium">
              Nossa empresa (MBV)
            </Label>
            <p className="text-xs text-muted-foreground">
              Trata este produtor como a MBV nas análises e no market share.
            </p>
          </div>
          <Switch
            id="eh-mbv"
            checked={f.eh_mbv}
            onCheckedChange={(v) => set("eh_mbv", v)}
          />
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={saving} className="w-full" size="lg">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {emissor ? "Salvar alterações" : "Salvar produtor"}
      </Button>
    </div>
  );
}
