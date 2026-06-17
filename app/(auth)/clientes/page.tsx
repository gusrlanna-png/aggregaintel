"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BuscaTabela } from "@/components/ui/busca-tabela";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClientes } from "@/lib/supabase/clientes";
import { getClienteIdsComTraco } from "@/lib/supabase/consumo";
import { SEGMENTOS, type Segmento } from "@/lib/utils/agregados";

const LIMITE = 150;
const soDigitos = (s: string) => s.replace(/\D/g, "");

export default function ClientesPage() {
  const [busca, setBusca] = React.useState("");
  const [segmento, setSegmento] = React.useState("all");
  const [grupo, setGrupo] = React.useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["clientes-list"],
    queryFn: async () => {
      const [clientes, comTraco] = await Promise.all([
        getClientes(),
        getClienteIdsComTraco(),
      ]);
      return { clientes, comTraco };
    },
  });

  const todos = React.useMemo(() => data?.clientes ?? [], [data]);

  const gruposDisponiveis = React.useMemo(
    () =>
      Array.from(
        new Set(
          todos.map((c) => c.grupo_economico).filter((g): g is string => Boolean(g))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [todos]
  );

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = soDigitos(busca);
    return todos.filter((c) => {
      if (segmento !== "all" && c.segmento !== segmento) return false;
      if (grupo !== "all" && c.grupo_economico !== grupo) return false;
      if (q) {
        const nome = c.razao_social?.toLowerCase() ?? "";
        const cnpj = c.cnpj ?? "";
        const hit =
          nome.includes(q) || (qDig.length >= 3 && soDigitos(cnpj).includes(qDig));
        if (!hit) return false;
      }
      return true;
    });
  }, [todos, busca, segmento, grupo]);

  const visiveis = filtrados.slice(0, LIMITE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/vendas"
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Planejamento de vendas
          </Link>
          <Link
            href="/clientes/novo"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            + Novo
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <BuscaTabela
          value={busca}
          onChange={setBusca}
          sugestoes={todos.map((c) => c.razao_social)}
          placeholder="Buscar por nome ou CNPJ…"
          id="clientes"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={segmento} onValueChange={setSegmento}>
            <SelectTrigger>
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SEGMENTOS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger>
              <SelectValue placeholder="Grupo econômico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {gruposDisponiveis.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contagem */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {filtrados.length.toLocaleString("pt-BR")}{" "}
          {filtrados.length === 1 ? "cliente" : "clientes"}
          {filtrados.length !== todos.length &&
            ` (de ${todos.length.toLocaleString("pt-BR")})`}
          {filtrados.length > LIMITE && ` · exibindo os primeiros ${LIMITE}`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : todos.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <p className="font-medium">Nenhum cliente cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Sincronize o sistema em Config → Integração ou cadastre manualmente.
            </p>
          </CardContent>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado para o filtro.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visiveis.map((c) => {
              const seg = SEGMENTOS[c.segmento as Segmento] ?? SEGMENTOS.outro;
              const ativo = (c.status ?? "ativo").toLowerCase() === "ativo";
              const fantasia =
                c.fantasia && c.fantasia !== c.razao_social ? c.fantasia : null;
              const local = [c.municipio, c.uf].filter(Boolean).join("/");
              const linha2 = [c.cnpj || "sem CNPJ", local, c.grupo_economico]
                .filter(Boolean)
                .join("  ·  ");
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  style={{ borderLeft: `3px solid ${seg.cor}` }}
                >
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{c.razao_social}</span>
                      {fantasia && (
                        <span className="shrink-0 truncate text-xs font-normal text-muted-foreground">
                          · {fantasia}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {linha2}
                    </p>
                  </div>
                  <Badge
                    variant={ativo ? "success" : "secondary"}
                    className="hidden shrink-0 sm:inline-flex"
                  >
                    {ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Badge className={`${seg.corClasse} shrink-0`}>{seg.label}</Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
