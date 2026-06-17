"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  getGruposEconomicosClientes,
  upsertCliente,
  vincularGrupoPorCnpj,
} from "@/lib/supabase/clientes";
import { SEGMENTOS, type Segmento } from "@/lib/utils/agregados";
import type { Cliente, ClienteContato } from "@/lib/supabase/types";
import { mascararCnpj } from "@/lib/utils/cnpj";
import { maskCPF, onlyDigits } from "@/lib/utils/masks";
import { PORTES, getRegioes } from "@/lib/supabase/carteiras";

type FormState = {
  razao_social: string;
  cnpj: string;
  cpf: string;
  segmento: string;
  fone: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  grupo_economico: string;
  porte: string;
  regiao_id: string;
  notas: string;
};

function fromCliente(c?: Cliente | null): FormState {
  return {
    razao_social: c?.razao_social ?? "",
    cnpj: mascararCnpj(c?.cnpj ?? ""),
    cpf: c?.cpf ?? "",
    segmento: c?.segmento ?? "outro",
    fone: c?.fone ?? "",
    logradouro: c?.logradouro ?? "",
    bairro: c?.bairro ?? "",
    municipio: c?.municipio ?? "",
    uf: c?.uf ?? "MG",
    cep: c?.cep ?? "",
    grupo_economico: c?.grupo_economico ?? "",
    porte: c?.porte ?? "",
    regiao_id: c?.regiao_id ?? "",
    notas: c?.notas ?? "",
  };
}

function contatosFromCliente(c?: Cliente | null): ClienteContato[] {
  if (c?.contatos && c.contatos.length) return c.contatos;
  if (c?.contato_nome) return [{ nome: c.contato_nome }];
  return [];
}

export function ClienteForm({ cliente }: { cliente?: Cliente | null }) {
  const router = useRouter();
  const [f, setF] = React.useState<FormState>(fromCliente(cliente));
  const [contatos, setContatos] = React.useState<ClienteContato[]>(
    contatosFromCliente(cliente)
  );
  const [saving, setSaving] = React.useState(false);
  const [buscando, setBuscando] = React.useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-clientes"],
    queryFn: () => getGruposEconomicosClientes(),
  });
  const { data: regioes = [] } = useQuery({
    queryKey: ["regioes"],
    queryFn: getRegioes,
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
        bairro: json.bairro ?? p.bairro,
        municipio: json.municipio ?? p.municipio,
        uf: json.uf ?? p.uf,
        cep: json.cep ?? p.cep,
        fone: json.fone ?? p.fone,
      }));
      toast.success("Dados preenchidos via Receita Federal.");
    } catch {
      toast.error("Falha ao consultar o CNPJ.");
    } finally {
      setBuscando(false);
    }
  }

  function addContato() {
    setContatos((p) => [...p, { nome: "", cargo: "", fone: "", email: "" }]);
  }
  function setContato(i: number, patch: Partial<ClienteContato>) {
    setContatos((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }
  function removeContato(i: number) {
    setContatos((p) => p.filter((_, j) => j !== i));
  }

  async function salvar() {
    if (!f.razao_social.trim()) {
      toast.error("Razão social / nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const contatosLimpos = contatos.filter((c) => c.nome.trim());
      const saved = await upsertCliente({
        id: cliente?.id,
        razao_social: f.razao_social,
        cnpj: f.cnpj || null,
        cpf: f.cpf || null,
        segmento: f.segmento,
        fone: f.fone || null,
        logradouro: f.logradouro || null,
        bairro: f.bairro || null,
        municipio: f.municipio || null,
        uf: f.uf || null,
        cep: f.cep || null,
        grupo_economico: f.grupo_economico.trim() || null,
        porte: f.porte || null,
        regiao_id: f.regiao_id || null,
        contatos: contatosLimpos,
        contato_nome: contatosLimpos[0]?.nome ?? null,
        notas: f.notas || null,
      });
      // Vincula automaticamente por raiz de CNPJ (mesma empresa-mãe/filiais).
      if (saved.cnpj) await vincularGrupoPorCnpj(saved.id);
      toast.success(cliente ? "Cliente atualizado." : "Cliente cadastrado.");
      router.push(`/clientes/${saved.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* CNPJ + busca */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Label className="text-xs">CNPJ — busca automática (opcional)</Label>
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
            Clientes com a mesma raiz de CNPJ (8 primeiros dígitos) são
            vinculados automaticamente ao mesmo grupo econômico.
          </p>
        </CardContent>
      </Card>

      {/* Dados da empresa */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Razão social / nome *</Label>
            <Input
              value={f.razao_social}
              onChange={(e) => set("razao_social", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Segmento</Label>
            <Select value={f.segmento} onValueChange={(v) => set("segmento", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEGMENTOS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF</Label>
            <Input
              value={maskCPF(f.cpf)}
              onChange={(e) => set("cpf", onlyDigits(e.target.value).slice(0, 11))}
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone (empresa)</Label>
            <Input value={f.fone} onChange={(e) => set("fone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Grupo econômico</Label>
            <Input
              list="grupos-clientes"
              value={f.grupo_economico}
              onChange={(e) => set("grupo_economico", e.target.value)}
              placeholder="Selecione ou crie um grupo"
            />
            <datalist id="grupos-clientes">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Porte</Label>
            <Select value={f.porte || "none"} onValueChange={(v) => set("porte", v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Porte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— não definido —</SelectItem>
                {PORTES.map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Região (carteira)</Label>
            <Select value={f.regiao_id || "none"} onValueChange={(v) => set("regiao_id", v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— não definida —</SelectItem>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input
              value={f.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bairro</Label>
            <Input
              value={f.bairro}
              onChange={(e) => set("bairro", e.target.value)}
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={f.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contatos (à parte do cadastro da empresa) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contatos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum contato. Adicione as pessoas de contato da empresa.
            </p>
          )}
          {contatos.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-2"
            >
              <Input
                placeholder="Nome"
                value={c.nome}
                onChange={(e) => setContato(i, { nome: e.target.value })}
              />
              <Input
                placeholder="Cargo / função"
                value={c.cargo ?? ""}
                onChange={(e) => setContato(i, { cargo: e.target.value })}
              />
              <Input
                placeholder="Telefone"
                value={c.fone ?? ""}
                onChange={(e) => setContato(i, { fone: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="E-mail"
                  value={c.email ?? ""}
                  onChange={(e) => setContato(i, { email: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive"
                  onClick={() => removeContato(i)}
                  aria-label="Remover contato"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addContato} className="w-full">
            <Plus className="h-4 w-4" /> Adicionar contato
          </Button>
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={saving} className="w-full" size="lg">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {cliente ? "Salvar alterações" : "Salvar cliente"}
      </Button>
    </div>
  );
}
