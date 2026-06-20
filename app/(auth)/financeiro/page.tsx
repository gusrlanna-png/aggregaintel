"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buscarClientesCredito,
  getAnaliseCredito,
  getFichaCredito,
  salvarAnaliseCredito,
} from "@/lib/supabase/financeiro";
import { fmtReais, fmtToneladas1 } from "@/lib/utils/agregados";
import { mascararCnpj } from "@/lib/utils/cnpj";

const STATUS = [
  { v: "em_analise", label: "Em análise" },
  { v: "aprovado", label: "Aprovado" },
  { v: "recusado", label: "Recusado" },
  { v: "suspenso", label: "Suspenso" },
];
const RISCOS = [
  { v: "baixo", label: "Baixo" },
  { v: "medio", label: "Médio" },
  { v: "alto", label: "Alto" },
];

function fmtData(d: string | null) {
  return d ? d.split("-").reverse().join("/") : "—";
}

export default function FinanceiroPage() {
  const [termo, setTermo] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [sel, setSel] = React.useState<string | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["fin-clientes", busca],
    queryFn: () => buscarClientesCredito(busca),
    enabled: busca.trim().length >= 2,
  });
  const { data: ficha, isLoading: carregandoFicha } = useQuery({
    queryKey: ["fin-ficha", sel],
    queryFn: () => getFichaCredito(sel!),
    enabled: !!sel,
  });
  const { data: analise } = useQuery({
    queryKey: ["fin-analise", sel],
    queryFn: () => getAnaliseCredito(sel!),
    enabled: !!sel,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Financeiro · Crédito</h1>
          <p className="text-sm text-muted-foreground">
            Ficha de crédito do cliente: cadastro, histórico de compras e limite.
          </p>
        </div>
      </div>

      {!sel && (
        <>
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(termo);
            }}
          >
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setBusca(e.target.value);
              }}
              placeholder="Buscar cliente por nome ou CNPJ/CPF…"
              className="pl-8"
            />
          </form>
          <Card>
            <CardContent className="p-0">
              {busca.trim().length < 2 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar um cliente.
                </p>
              ) : clientes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </p>
              ) : (
                <ul className="divide-y">
                  {clientes.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSel(c.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.razao_social}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {(c.cnpj ? mascararCnpj(c.cnpj) : c.cpf) ?? "—"} ·{" "}
                            {[c.municipio, c.uf].filter(Boolean).join("/")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {sel && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSel(null)}>
            ← Outro cliente
          </Button>
          {carregandoFicha || !ficha ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <FichaCard
              ficha={ficha}
              analiseInicial={analise ?? null}
              onSalvo={() => {}}
            />
          )}
        </>
      )}
    </div>
  );
}

function FichaCard({
  ficha,
  analiseInicial,
}: {
  ficha: NonNullable<Awaited<ReturnType<typeof getFichaCredito>>>;
  analiseInicial: Awaited<ReturnType<typeof getAnaliseCredito>>;
  onSalvo: () => void;
}) {
  const e = ficha.empresa;
  const nf = ficha.nf;
  const [status, setStatus] = React.useState(analiseInicial?.status ?? "em_analise");
  const [risco, setRisco] = React.useState(analiseInicial?.risco ?? "");
  const [limite, setLimite] = React.useState(
    analiseInicial?.limite_aprovado != null ? String(analiseInicial.limite_aprovado) : ""
  );
  const [obs, setObs] = React.useState(analiseInicial?.observacoes ?? "");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarAnaliseCredito(e.id, {
        status,
        risco: risco || null,
        limite_aprovado: limite ? Number(limite.replace(/\./g, "").replace(",", ".")) : null,
        limite_sugerido: ficha.limite_sugerido ?? null,
        observacoes: obs || null,
      });
      toast.success("Análise de crédito salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {e.razao_social}
          <Link href={`/clientes/${e.id}`} className="text-xs font-normal text-primary hover:underline">
            abrir cadastro →
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {(e.cnpj ? mascararCnpj(e.cnpj) : e.cpf) ?? "—"} · {[e.municipio, e.uf].filter(Boolean).join("/")}
          {e.segmento ? ` · ${e.segmento}` : ""}
        </p>
      </div>

      {/* Cadastral */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-4 text-sm sm:grid-cols-3">
          <Info rotulo="Situação cadastral" valor={e.situacao_cadastral} />
          <Info rotulo="Natureza jurídica" valor={e.natureza_juridica} />
          <Info rotulo="Fundação" valor={fmtData(e.data_fundacao)} />
          <Info rotulo="Capital social" valor={e.capital_social ? fmtReais(e.capital_social) : "—"} />
          <Info rotulo="Sócios" valor={String(ficha.socios)} />
          <Info rotulo="Grupo econômico" valor={e.grupo_economico} />
        </CardContent>
      </Card>

      {/* Histórico de compras */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Histórico de compras (NFs)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric titulo="Faturamento total" valor={fmtReais(nf.faturamento)} />
            <Metric titulo="Volume" valor={`${fmtToneladas1(nf.ton)} t`} />
            <Metric titulo="Média mensal" valor={fmtReais(nf.media_mensal)} />
            <Metric titulo="NFs" valor={`${nf.nfs}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ticket médio {fmtReais(nf.ticket_medio)} · {nf.meses_ativos} meses ativos ·
            1ª compra {fmtData(nf.primeira)} · última {fmtData(nf.ultima)}
          </p>
          <div className="rounded-md bg-primary/10 p-3">
            <p className="text-xs text-muted-foreground">Limite sugerido (média mensal × 1,5)</p>
            <p className="text-xl font-bold tabular-nums text-primary">{fmtReais(ficha.limite_sugerido)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Decisão de crédito */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Análise de crédito</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Risco</Label>
              <Select value={risco || "none"} onValueChange={(v) => setRisco(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {RISCOS.map((r) => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limite aprovado (R$)</Label>
              <Input value={limite} onChange={(ev) => setLimite(ev.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(ev) => setObs(ev.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar análise
            </Button>
            {analiseInicial?.atualizado_em && (
              <Badge variant="secondary" className="font-normal">
                atualizado {new Date(analiseInicial.atualizado_em).toLocaleDateString("pt-BR")}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-medium">{valor || "—"}</p>
    </div>
  );
}
function Metric({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{titulo}</p>
    </div>
  );
}
