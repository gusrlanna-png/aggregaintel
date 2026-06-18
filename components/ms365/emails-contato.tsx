"use client";

import * as React from "react";
import { ExternalLink, Loader2, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMs365 } from "@/hooks/use-ms365";
import {
  fetchEmailsByContact,
  fmtDataEmail,
  type GraphMessage,
} from "@/lib/graph/mail";

interface Props {
  email: string;
}

export function EmailsContato({ email }: Props) {
  const ms365 = useMs365();
  const [mensagens, setMensagens] = React.useState<GraphMessage[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function carregar() {
    if (!ms365.providerToken) return;
    setLoading(true);
    setErro(null);
    try {
      const msgs = await fetchEmailsByContact(ms365.providerToken, email);
      setMensagens(msgs);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar e-mails.");
    } finally {
      setLoading(false);
    }
  }

  if (!ms365.connected) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <Mail className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Faça{" "}
          <Link href="/login" className="font-medium underline">
            login com Microsoft 365
          </Link>{" "}
          para ver os e-mails trocados com este contato.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          E-mails com <span className="font-medium">{email}</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={carregar}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {mensagens === null ? "Carregar" : "Atualizar"}
        </Button>
      </div>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {erro}
        </p>
      )}

      {mensagens === null && !loading && !erro && (
        <p className="text-xs text-muted-foreground">
          Clique em &ldquo;Carregar&rdquo; para buscar o histórico de e-mails.
        </p>
      )}

      {mensagens !== null && mensagens.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum e-mail encontrado com este contato.
        </p>
      )}

      {mensagens && mensagens.length > 0 && (
        <div className="divide-y rounded-md border">
          {mensagens.map((m) => (
            <a
              key={m.id}
              href={m.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {!m.isRead && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <p className={`truncate text-xs ${m.isRead ? "text-muted-foreground" : "font-semibold"}`}>
                    {m.subject || "(sem assunto)"}
                  </p>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? "—"}
                  {" · "}
                  {m.bodyPreview?.slice(0, 60) || ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {fmtDataEmail(m.receivedDateTime)}
                </span>
                {m.isDraft && (
                  <Badge variant="secondary" className="text-[10px]">
                    Rascunho
                  </Badge>
                )}
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
