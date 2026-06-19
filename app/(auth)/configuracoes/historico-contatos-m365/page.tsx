"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuscaTabela, matchBusca } from "@/components/ui/busca-tabela";
import {
  getHistoricoContatosM365,
  getUsuariosComContatosM365,
} from "@/lib/supabase/pessoas";

function lista(raw: Record<string, unknown> | null, campo: string): string[] {
  const v = raw?.[campo];
  return Array.isArray(v) ? (v as string[]).filter(Boolean) : [];
}

export default function HistoricoContatosM365Page() {
  const [usuario, setUsuario] = React.useState("all");
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<string | null>(null);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["m365-usuarios"],
    queryFn: getUsuariosComContatosM365,
  });
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["m365-historico", usuario],
    queryFn: () =>
      getHistoricoContatosM365(usuario === "all" ? undefined : usuario),
  });

  const filtrados = React.useMemo(
    () =>
      historico.filter((h) =>
        matchBusca(
          busca,
          h.pessoa_nome,
          h.conta_origem,
          h.criado_por_nome,
          ...lista(h.raw, "emails"),
          ...lista(h.raw, "telefones")
        )
      ),
    [historico, busca]
  );

  // Resumo por usuário (quantos contatos cada um vinculou no recorte atual).
  const porUsuario = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const h of filtrados) {
      const k = h.criado_por_nome ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Histórico de contatos M365
          </h1>
          <p className="text-sm text-muted-foreground">
            Contatos importados/vinculados do Microsoft 365, por usuário e conta
            de origem. Clique para ver os dados capturados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BuscaTabela
          value={busca}
          onChange={setBusca}
          placeholder="Buscar contato, conta, e-mail, telefone…"
          id="m365-historico"
        />
        <Select value={usuario} onValueChange={setUsuario}>
          <SelectTrigger>
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {porUsuario.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {porUsuario.map(([nome, n]) => (
            <Badge key={nome} variant="secondary" className="font-normal">
              {nome}: {n}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum contato M365 vinculado ainda. Importe em{" "}
              <Link
                href="/configuracoes/contatos-m365"
                className="text-primary hover:underline"
              >
                Contatos Microsoft 365
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {filtrados.map((h) => {
                const emails = lista(h.raw, "emails");
                const fones = lista(h.raw, "telefones");
                const endereco = (h.raw?.endereco as string) ?? null;
                const expandido = aberto === h.id;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setAberto(expandido ? null : h.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {h.pessoa_nome ?? "(contato removido)"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {h.criado_por_nome ?? "—"}
                          {h.conta_origem ? ` · ${h.conta_origem}` : ""} ·{" "}
                          {new Date(h.criado_em).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          expandido ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    {expandido && (
                      <div className="space-y-2 bg-muted/30 px-3 pb-3 pt-1 text-xs">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <Campo rotulo="Vinculado por" valor={h.criado_por_nome} />
                          <Campo rotulo="Conta de origem" valor={h.conta_origem} />
                          <Campo rotulo="ID na origem" valor={h.external_id} />
                          <Campo
                            rotulo="Data"
                            valor={new Date(h.criado_em).toLocaleString("pt-BR")}
                          />
                        </div>
                        {emails.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">E-mails: </span>
                            {emails.join(", ")}
                          </div>
                        )}
                        {fones.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">
                              Telefones:{" "}
                            </span>
                            {fones.join(", ")}
                          </div>
                        )}
                        {endereco && (
                          <div>
                            <span className="text-muted-foreground">
                              Endereço:{" "}
                            </span>
                            {endereco}
                          </div>
                        )}
                        <Link
                          href={`/pessoas/${h.pessoa_id}`}
                          className="inline-block pt-1 font-medium text-primary hover:underline"
                        >
                          Abrir cadastro →
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        {filtrados.length} registro(s){busca || usuario !== "all" ? " no filtro" : ""}.
      </p>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{rotulo}: </span>
      <span>{valor || "—"}</span>
    </div>
  );
}
