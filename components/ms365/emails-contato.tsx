"use client";

import * as React from "react";
import { ExternalLink, Loader2, Mail, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMs365 } from "@/hooks/use-ms365";
import {
  fetchEmailsByContact,
  fetchEmailBody,
  fmtDataEmail,
  type GraphMessage,
  type GraphMessageBody,
} from "@/lib/graph/mail";
import { indexarEmailsContato } from "@/lib/supabase/email-indice";

interface Props {
  email: string;
  pessoaId?: string;
}

export function EmailsContato({ email, pessoaId }: Props) {
  const ms365 = useMs365();
  const [mensagens, setMensagens] = React.useState<GraphMessage[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [termo, setTermo] = React.useState("");
  // E-mail aberto para leitura DENTRO do sistema.
  const [aberto, setAberto] = React.useState<GraphMessageBody | null>(null);
  const [carregandoCorpo, setCarregandoCorpo] = React.useState(false);

  const carregar = React.useCallback(
    async (busca?: string) => {
      if (!ms365.providerToken) return;
      setLoading(true);
      setErro(null);
      try {
        const msgs = await fetchEmailsByContact(ms365.providerToken, email, 25, busca);
        setMensagens(msgs);
        // Indexa metadados+trecho (privado do usuário; RLS). Não bloqueia a UI.
        indexarEmailsContato(msgs, email, pessoaId).catch(() => {});
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar e-mails.");
      } finally {
        setLoading(false);
      }
    },
    [ms365.providerToken, email, pessoaId]
  );

  async function abrir(m: GraphMessage) {
    if (!ms365.providerToken) return;
    setCarregandoCorpo(true);
    setAberto(null);
    try {
      const corpo = await fetchEmailBody(ms365.providerToken, m.id);
      setAberto(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao abrir o e-mail.");
    } finally {
      setCarregandoCorpo(false);
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
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          E-mails com <span className="font-medium">{email}</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          onClick={() => carregar(termo)}
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

      {/* Busca por assunto + corpo (via Graph, na caixa do próprio usuário) */}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          carregar(termo);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar no assunto e no corpo dos e-mails…"
            className="h-8 pl-7 text-xs"
          />
          {termo && (
            <button
              type="button"
              onClick={() => {
                setTermo("");
                carregar("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={loading}>
          Buscar
        </Button>
      </form>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {erro}
        </p>
      )}

      {mensagens === null && !loading && !erro && (
        <p className="text-xs text-muted-foreground">
          Clique em &ldquo;Carregar&rdquo; ou pesquise um termo para buscar os e-mails.
        </p>
      )}

      {mensagens !== null && mensagens.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">
          {termo
            ? `Nenhum e-mail com &ldquo;${termo}&rdquo; neste contato.`
            : "Nenhum e-mail encontrado com este contato."}
        </p>
      )}

      {mensagens && mensagens.length > 0 && (
        <div className="divide-y rounded-md border">
          {mensagens.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => abrir(m)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
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
                  {m.bodyPreview?.slice(0, 70) || ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {fmtDataEmail(m.receivedDateTime)}
                </span>
                {m.isDraft && (
                  <Badge variant="secondary" className="text-[10px]">
                    Rascunho
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Leitor de e-mail DENTRO do sistema (não vai para o Outlook) */}
      {(aberto || carregandoCorpo) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAberto(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoCorpo ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : aberto ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {aberto.subject || "(sem assunto)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {aberto.from?.emailAddress?.name ??
                        aberto.from?.emailAddress?.address ??
                        "—"}{" "}
                      · {new Date(aberto.receivedDateTime).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={aberto.webLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Outlook"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setAberto(null)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* iframe isolado (sandbox sem scripts) p/ renderizar o e-mail com segurança */}
                <iframe
                  title="Conteúdo do e-mail"
                  sandbox=""
                  className="h-[60vh] w-full bg-white"
                  srcDoc={
                    aberto.body?.contentType === "html"
                      ? aberto.body.content
                      : `<pre style="white-space:pre-wrap;font-family:system-ui;padding:12px">${(
                          aberto.body?.content ?? ""
                        ).replace(/</g, "&lt;")}</pre>`
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
