"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Mail, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buscarEmailIndice } from "@/lib/supabase/email-indice";

function fmt(ts: string | null) {
  return ts ? new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export default function EmailsIndicePage() {
  const [termo, setTermo] = React.useState("");
  const [busca, setBusca] = React.useState("");

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["email-indice", busca],
    queryFn: () => buscarEmailIndice({ termo: busca, limite: 400 }),
  });

  // Detecta se há mais de um dono (visão master/admin).
  const multiUsuario = React.useMemo(
    () => new Set(emails.map((e) => e.user_id)).size > 1,
    [emails]
  );

  return (
    <div className="space-y-4">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Configurações
      </Link>
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">E-mails indexados (M365)</h1>
          <p className="text-sm text-muted-foreground">
            Busca em assunto, trecho e remetente dos e-mails já abertos no sistema.
            Você vê os seus; administradores têm a visão consolidada.
          </p>
        </div>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setBusca(termo);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por assunto, trecho, remetente, contato…"
            className="pl-8"
          />
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum e-mail indexado ainda. O índice é montado conforme os e-mails
              são abertos nos cadastros de pessoas (painel Microsoft 365).
            </p>
          ) : (
            <ul className="divide-y">
              {emails.map((e) => (
                <li key={e.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.assunto || "(sem assunto)"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.de_nome || e.de_email || "—"}
                      {e.contato_email ? ` · contato: ${e.contato_email}` : ""}
                      {" · "}
                      {fmt(e.data)}
                    </p>
                    {e.preview && (
                      <p className="truncate text-xs text-muted-foreground/80">{e.preview}</p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {multiUsuario && e.email_dono && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {e.email_dono}
                        </Badge>
                      )}
                      {e.pessoa_id && (
                        <Link
                          href={`/pessoas/${e.pessoa_id}`}
                          className="text-[11px] font-medium text-primary hover:underline"
                        >
                          Abrir contato →
                        </Link>
                      )}
                    </div>
                  </div>
                  {e.web_link && (
                    <a
                      href={e.web_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Outlook"
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        {emails.length} e-mail(s){busca ? " no filtro" : ""} · só metadados/trecho
        (o corpo completo é lido ao vivo, com segurança, no cadastro).
      </p>
    </div>
  );
}
