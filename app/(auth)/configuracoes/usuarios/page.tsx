"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aprovarUsuario,
  atualizarUsuario,
  bloquearUsuario,
  getMeuPerfil,
  getUsuarios,
  statusUsuario,
  type AppUsuario,
} from "@/lib/supabase/perfil";
import type { Perfil } from "@/lib/auth/rotas";

const PERFIS: { v: Perfil; label: string; hint: string }[] = [
  { v: "admin", label: "Admin", hint: "acesso total + gestão de usuários" },
  { v: "gestor", label: "Gestor", hint: "acesso total ao sistema" },
  { v: "vendedor", label: "Vendedor", hint: "campo: visitas, clientes, pessoas, intel" },
];

function fmt(ts: string | null) {
  return ts ? new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { data: meuPerfil } = useQuery({ queryKey: ["meu-perfil"], queryFn: getMeuPerfil });
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["app-usuarios"],
    queryFn: getUsuarios,
    enabled: meuPerfil === "admin",
  });
  // Perfil escolhido na aprovação de cada pendente.
  const [perfilEscolhido, setPerfilEscolhido] = React.useState<Record<string, Perfil>>({});

  function invalida() {
    qc.invalidateQueries({ queryKey: ["app-usuarios"] });
  }

  async function mudar(id: string, patch: Parameters<typeof atualizarUsuario>[1]) {
    try {
      await atualizarUsuario(id, patch);
      invalida();
      toast.success("Usuário atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }
  async function aprovar(u: AppUsuario) {
    try {
      await aprovarUsuario(u.id, perfilEscolhido[u.id] ?? "vendedor");
      invalida();
      toast.success("Acesso aprovado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar.");
    }
  }
  async function bloquear(u: AppUsuario) {
    try {
      await bloquearUsuario(u.id);
      invalida();
      toast.success("Acesso bloqueado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao bloquear.");
    }
  }

  const pendentes = usuarios.filter((u) => statusUsuario(u) === "pendente");
  const ativos = usuarios.filter((u) => statusUsuario(u) !== "pendente");

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usuários e acessos</h1>
          <p className="text-sm text-muted-foreground">
            Aprove novos acessos, defina o perfil e bloqueie quando necessário.
            Acesso corporativo entra por Microsoft 365.
          </p>
        </div>
      </div>

      {meuPerfil !== "admin" ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar usuários.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Pendentes de aprovação */}
          <Card className={pendentes.length ? "border-amber-300" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4" /> Aguardando aprovação ({pendentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendentes.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  Nenhum acesso pendente. Quando alguém entrar (Microsoft 365 ou
                  link mágico) pela primeira vez, aparece aqui para você aprovar.
                </p>
              ) : (
                <div className="divide-y">
                  {pendentes.map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.nome || u.email || u.id}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.email} · tentou em {fmt(u.criado_em)}
                        </p>
                      </div>
                      <Select
                        value={perfilEscolhido[u.id] ?? "vendedor"}
                        onValueChange={(v) =>
                          setPerfilEscolhido((m) => ({ ...m, [u.id]: v as Perfil }))
                        }
                      >
                        <SelectTrigger className="h-9 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERFIS.map((p) => (
                            <SelectItem key={p.v} value={p.v}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => aprovar(u)}>
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => bloquear(u)}
                      >
                        Bloquear
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usuários ativos / bloqueados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Usuários ({ativos.length})</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {ativos.map((u) => {
                const st = statusUsuario(u);
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.nome || u.email || u.id}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {st === "bloqueado" && (
                      <Badge variant="secondary" className="text-[10px]">bloqueado</Badge>
                    )}
                    <Select value={u.perfil} onValueChange={(v) => mudar(u.id, { perfil: v as Perfil })}>
                      <SelectTrigger className="h-9 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERFIS.map((p) => (
                          <SelectItem key={p.v} value={p.v}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={u.ativo} onCheckedChange={(v) => mudar(u.id, { ativo: v })} />
                      <span className="text-xs text-muted-foreground">ativo</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-1 text-xs text-muted-foreground">
            {PERFIS.map((p) => (
              <p key={p.v}>
                <strong>{p.label}:</strong> {p.hint}
              </p>
            ))}
            <p className="pt-1">
              Novos acessos entram <strong>pendentes</strong> e só navegam após a
              aprovação. As páginas que cada perfil vê são definidas em{" "}
              <Link href="/configuracoes/permissoes" className="text-primary hover:underline">
                Permissões por perfil
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}
