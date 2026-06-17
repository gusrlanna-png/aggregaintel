"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  atualizarUsuario,
  getMeuPerfil,
  getUsuarios,
} from "@/lib/supabase/perfil";
import type { Perfil } from "@/lib/auth/rotas";

const PERFIS: { v: Perfil; label: string; hint: string }[] = [
  { v: "admin", label: "Admin", hint: "acesso total + gestão de usuários" },
  { v: "gestor", label: "Gestor", hint: "acesso total ao sistema" },
  { v: "vendedor", label: "Vendedor", hint: "campo: visitas, clientes, pessoas, intel" },
];

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { data: meuPerfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: getMeuPerfil,
  });
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["app-usuarios"],
    queryFn: getUsuarios,
    enabled: meuPerfil === "admin",
  });

  async function mudar(
    id: string,
    patch: Parameters<typeof atualizarUsuario>[1]
  ) {
    try {
      await atualizarUsuario(id, patch);
      qc.invalidateQueries({ queryKey: ["app-usuarios"] });
      toast.success("Usuário atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Usuários e permissões</h1>
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
          <Card>
            <CardContent className="divide-y p-0">
              {usuarios.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.nome || u.email || u.id}
                    </p>
                    {u.email && u.nome && (
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    )}
                  </div>
                  {!u.ativo && (
                    <Badge variant="secondary" className="text-[10px]">
                      inativo
                    </Badge>
                  )}
                  <Select
                    value={u.perfil}
                    onValueChange={(v) => mudar(u.id, { perfil: v as Perfil })}
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
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={u.ativo}
                      onCheckedChange={(v) => mudar(u.id, { ativo: v })}
                    />
                    <span className="text-xs text-muted-foreground">ativo</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-1 text-xs text-muted-foreground">
            {PERFIS.map((p) => (
              <p key={p.v}>
                <strong>{p.label}:</strong> {p.hint}
              </p>
            ))}
            <p className="pt-1">
              Novos cadastros entram como <strong>Vendedor</strong> (acesso
              restrito) até serem promovidos aqui.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
