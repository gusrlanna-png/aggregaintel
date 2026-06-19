"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Mail, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  buscarEmailIndice,
  getCorrespondentes,
  getEmpresasPorDominio,
  type Correspondente,
} from "@/lib/supabase/email-indice";
import { getIndicePessoas, criarPessoa } from "@/lib/supabase/pessoas";
import { logAcao } from "@/lib/audit/log";

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

  const multiUsuario = React.useMemo(
    () => new Set(emails.map((e) => e.user_id)).size > 1,
    [emails]
  );
  // Fase 4 — auditoria: registra quando a visão consolidada (master/admin) é usada.
  React.useEffect(() => {
    if (multiUsuario) {
      logAcao("visao_master_emails", "/configuracoes/emails", {
        registros: emails.length,
        termo: busca || null,
      });
    }
  }, [multiUsuario, emails.length, busca]);

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
            Busca e extração a partir dos e-mails abertos no sistema. Você vê os
            seus; administradores têm a visão consolidada (auditada).
          </p>
        </div>
      </div>

      <Tabs defaultValue="mensagens">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="correspondentes">Correspondentes</TabsTrigger>
        </TabsList>

        {/* ── Mensagens ───────────────────────────────────────────────────── */}
        <TabsContent value="mensagens" className="space-y-3">
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
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por assunto, trecho, remetente, contato…"
              className="pl-8"
            />
          </form>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum e-mail indexado ainda. O índice é montado conforme os
                  e-mails são abertos nos cadastros de pessoas (painel M365).
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
        </TabsContent>

        {/* ── Correspondentes (extração) ──────────────────────────────────── */}
        <TabsContent value="correspondentes" className="space-y-3">
          <Correspondentes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Correspondentes() {
  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState<"todos" | "novos" | "cadastrados">("novos");
  const [criando, setCriando] = React.useState<string | null>(null);

  const { data: correspondentes = [], isLoading } = useQuery({
    queryKey: ["email-correspondentes"],
    queryFn: getCorrespondentes,
  });
  const { data: indice, refetch } = useQuery({
    queryKey: ["indice-pessoas"],
    queryFn: getIndicePessoas,
  });
  const { data: dominios } = useQuery({
    queryKey: ["empresas-por-dominio"],
    queryFn: getEmpresasPorDominio,
  });

  const pessoaDe = React.useCallback(
    (email: string) => indice?.byEmail.get(email.toLowerCase()) ?? null,
    [indice]
  );
  const empresaDe = React.useCallback(
    (email: string) => {
      const dom = email.split("@")[1]?.toLowerCase();
      return dom ? dominios?.get(dom) ?? null : null;
    },
    [dominios]
  );

  const lista = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return correspondentes
      .filter((c) => {
        const p = pessoaDe(c.email);
        if (filtro === "novos" && p) return false;
        if (filtro === "cadastrados" && !p) return false;
        return !q || c.email.includes(q) || (c.nome ?? "").toLowerCase().includes(q);
      })
      .slice(0, 500);
  }, [correspondentes, busca, filtro, pessoaDe]);

  async function criar(c: Correspondente) {
    setCriando(c.email);
    try {
      const id = await criarPessoa({ nome: c.nome || c.email, email: c.email });
      logAcao("criar_pessoa_de_email", "/configuracoes/emails", { email: c.email });
      toast.success("Contato criado.");
      await refetch();
      window.open(`/pessoas/${id}`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar contato.");
    } finally {
      setCriando(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pessoas que aparecem como remetente/destinatário dos e-mails indexados.
        Crie o cadastro de quem ainda não existe e cruze com clientes.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar e-mail ou nome…"
        />
        <div className="flex gap-1">
          {(["novos", "cadastrados", "todos"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtro === f ? "default" : "outline"}
              className="flex-1 text-xs capitalize"
              onClick={() => setFiltro(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lista.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum correspondente {filtro === "novos" ? "novo " : ""}encontrado.
            </p>
          ) : (
            <ul className="divide-y">
              {lista.map((c) => {
                const p = pessoaDe(c.email);
                return (
                  <li key={c.email} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.nome || c.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email} · {c.n} e-mail(s) · {fmt(c.ultima)}
                      </p>
                      {(() => {
                        const emp = empresaDe(c.email);
                        return emp ? (
                          <Link
                            href={`/clientes/${emp.empresa_id}`}
                            className="mt-0.5 inline-block truncate text-[11px] text-emerald-700 hover:underline dark:text-emerald-400"
                            title="Empresa sugerida pelo domínio do e-mail"
                          >
                            🏢 {emp.razao_social ?? "Empresa"}
                            {emp.n > 1 ? ` (+${emp.n - 1})` : ""}
                          </Link>
                        ) : null;
                      })()}
                    </div>
                    {p ? (
                      <Link
                        href={`/pessoas/${p.id}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        {p.nome ? `${p.nome} →` : "Abrir →"}
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 gap-1 text-xs"
                        onClick={() => criar(c)}
                        disabled={criando === c.email}
                      >
                        {criando === c.email ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Criar contato
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
