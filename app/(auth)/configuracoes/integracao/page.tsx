"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dispararSync,
  fracoesPorMes,
  getAnosVendas,
  getUltimaSync,
  getVendasMensais,
  SISTEMA_TABELAS_LABEL,
  type VendaMensal,
} from "@/lib/supabase/sistema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MESES_LABEL, setSazonalidade } from "@/lib/utils/sazonalidade";
import { fmtPct } from "@/lib/utils/agregados";

function fmtQuando(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function IntegracaoPage() {
  const qc = useQueryClient();
  const configurado = isSupabaseConfigured();

  const { data: sync, isLoading: loadingSync } = useQuery({
    queryKey: ["sistema-sync"],
    queryFn: getUltimaSync,
    enabled: configurado,
  });

  const { data: anos } = useQuery({
    queryKey: ["sistema-anos"],
    queryFn: getAnosVendas,
    enabled: configurado,
  });

  const [ano, setAno] = React.useState<number | null>(null);
  const anoAtivo = ano ?? anos?.[0] ?? null;

  const { data: vendas } = useQuery({
    queryKey: ["sistema-vendas", anoAtivo],
    queryFn: () => getVendasMensais(anoAtivo ?? undefined),
    enabled: configurado && !!anoAtivo,
  });

  const sincronizar = useMutation({
    mutationFn: dispararSync,
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Sincronização concluída.");
        qc.invalidateQueries({ queryKey: ["sistema-sync"] });
        qc.invalidateQueries({ queryKey: ["sistema-vendas"] });
        qc.invalidateQueries({ queryKey: ["sistema-anos"] });
      } else {
        toast.error(`Falha na sincronização: ${r.erro ?? "erro"}`);
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar."),
  });

  // Sazonalidade por segmento (e média) a partir das vendas do ano.
  const porSegmento = React.useMemo(() => {
    const map = new Map<string, VendaMensal[]>();
    for (const v of vendas ?? []) {
      const k = v.segmento_nome ?? "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(v);
    }
    const linhas = Array.from(map.entries()).map(([segmento, vs]) => ({
      segmento,
      ton: vs.reduce((s, v) => s + v.ton, 0),
      fracoes: fracoesPorMes(vs),
    }));
    linhas.sort((a, b) => b.ton - a.ton);
    return linhas;
  }, [vendas]);

  const media = React.useMemo(
    () => fracoesPorMes(vendas ?? []),
    [vendas]
  );

  function aplicarSazonalidade() {
    if (!anoAtivo) return;
    setSazonalidade(anoAtivo, "geral", media);
    for (const l of porSegmento) {
      setSazonalidade(anoAtivo, l.segmento, l.fracoes);
    }
    toast.success(
      `Sazonalidade de ${anoAtivo} aplicada (média + ${porSegmento.length} segmentos).`
    );
  }

  if (!configurado) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/configuracoes">
            <ArrowLeft className="h-4 w-4" /> Configurações
          </Link>
        </Button>
        <Card>
          <CardContent className="space-y-2 p-6 text-center">
            <Database className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Supabase não configurado</p>
            <p className="text-sm text-muted-foreground">
              A integração com o sistema comercial usa o Supabase. Configure as
              credenciais para habilitar a sincronização.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totais = sync?.totais ?? {};

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Integração com o sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados do sistema comercial (propostas, clientes, produtos). Sincroniza
            automaticamente todo dia às 01:00 e sob demanda.
          </p>
        </div>
        <Button
          onClick={() => sincronizar.mutate()}
          disabled={sincronizar.isPending}
        >
          {sincronizar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar agora
        </Button>
      </div>

      {/* Status da última sincronização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Última sincronização</span>
            {sync &&
              (sync.status === "ok" ? (
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> OK
                </Badge>
              ) : sync.status === "erro" ? (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Erro
                </Badge>
              ) : (
                <Badge variant="secondary">{sync.status}</Badge>
              ))}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSync ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : sync ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Concluída em</p>
                  <p className="font-medium">{fmtQuando(sync.concluido_em)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="font-medium">
                    {sync.origem === "cron" ? "Automática (01:00)" : "Manual"}
                  </p>
                </div>
              </div>
              {sync.erro && (
                <p className="text-sm text-destructive">{sync.erro}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {Object.entries(totais).map(([tabela, n]) => (
                  <div
                    key={tabela}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {SISTEMA_TABELAS_LABEL[tabela] ?? tabela}
                    </span>
                    <span className="font-medium tabular-nums">
                      {n.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma sincronização ainda. Clique em “Atualizar agora”.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sazonalidade a partir das vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Sazonalidade pelas vendas</span>
            <div className="flex items-center gap-2">
              <Select
                value={anoAtivo ? String(anoAtivo) : ""}
                onValueChange={(v) => setAno(Number(v))}
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {(anos ?? []).map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={aplicarSazonalidade}
                disabled={!vendas || vendas.length === 0}
              >
                Aplicar à sazonalidade
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Distribuição mensal do volume vendido (por segmento e média), derivada
            das propostas. “Aplicar” grava como a sazonalidade do ano nas
            projeções.
          </p>
          {!vendas ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : vendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem vendas para {anoAtivo}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segmento</TableHead>
                    {MESES_LABEL.map((m) => (
                      <TableHead key={m} className="text-right">
                        {m}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell>Média</TableCell>
                    {media.map((f, i) => (
                      <TableCell key={i} className="text-right tabular-nums">
                        {fmtPct(f * 100)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {porSegmento.map((l) => (
                    <TableRow key={l.segmento}>
                      <TableCell className="font-medium">{l.segmento}</TableCell>
                      {l.fracoes.map((f, i) => (
                        <TableCell
                          key={i}
                          className="text-right tabular-nums text-muted-foreground"
                        >
                          {fmtPct(f * 100)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
