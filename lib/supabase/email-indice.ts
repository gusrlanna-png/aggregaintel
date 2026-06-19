import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { GraphMessage } from "@/lib/graph/mail";

export interface EmailIndice {
  id: string;
  user_id: string;
  message_id: string;
  assunto: string | null;
  preview: string | null;
  de_nome: string | null;
  de_email: string | null;
  para_emails: string[] | null;
  data: string | null;
  web_link: string | null;
  contato_email: string | null;
  pessoa_id: string | null;
  empresa_id: string | null;
  criado_em: string;
  email_dono?: string | null; // resolvido p/ visão master (admin)
}

/**
 * Grava no índice (metadados + trecho) os e-mails carregados de um contato.
 * Não armazena o corpo — só assunto, remetentes, data e bodyPreview. RLS força
 * user_id = auth.uid() (default no banco). Upsert por (user_id, message_id).
 */
export async function indexarEmailsContato(
  mensagens: GraphMessage[],
  contatoEmail: string,
  pessoaId?: string | null
): Promise<void> {
  if (!isSupabaseConfigured() || mensagens.length === 0) return;
  const s = createClient();
  const linhas = mensagens.map((m) => ({
    message_id: m.id,
    assunto: m.subject ?? null,
    preview: (m.bodyPreview ?? "").slice(0, 280) || null,
    de_nome: m.from?.emailAddress?.name ?? null,
    de_email: m.from?.emailAddress?.address ?? null,
    para_emails: (m.toRecipients ?? [])
      .map((t) => t.emailAddress?.address)
      .filter(Boolean) as string[],
    data: m.receivedDateTime ?? null,
    web_link: m.webLink ?? null,
    contato_email: contatoEmail,
    pessoa_id: pessoaId ?? null,
  }));
  // onConflict user_id,message_id — user_id vem do default auth.uid().
  await s.from("email_indice").upsert(linhas, { onConflict: "user_id,message_id" });
}

export interface BuscaEmailIndice {
  termo?: string;
  pessoaId?: string;
  contatoEmail?: string;
  limite?: number;
}

/** Busca no índice (RLS: cada um vê o seu; admin vê todos). */
export async function buscarEmailIndice(
  f: BuscaEmailIndice = {}
): Promise<EmailIndice[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  let q = s
    .from("email_indice")
    .select("*")
    .order("data", { ascending: false })
    .limit(f.limite ?? 300);
  if (f.pessoaId) q = q.eq("pessoa_id", f.pessoaId);
  if (f.contatoEmail) q = q.ilike("contato_email", f.contatoEmail);
  if (f.termo && f.termo.trim()) {
    const t = `%${f.termo.trim()}%`;
    q = q.or(`assunto.ilike.${t},preview.ilike.${t},de_email.ilike.${t},de_nome.ilike.${t}`);
  }
  const { data, error } = await q;
  if (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  const lista = (data as EmailIndice[]) ?? [];
  // Visão master (admin): resolve o e-mail/nome do dono de cada registro.
  const ids = [...new Set(lista.map((e) => e.user_id).filter(Boolean))];
  if (ids.length > 1) {
    const { data: us } = await s.from("app_usuarios").select("id, nome, email").in("id", ids);
    const mapa = new Map(
      (us ?? []).map((u: { id: string; nome: string | null; email: string | null }) => [
        u.id,
        u.nome || u.email,
      ])
    );
    for (const e of lista) e.email_dono = mapa.get(e.user_id) ?? null;
  }
  return lista;
}

export interface Correspondente {
  email: string;
  nome: string | null;
  n: number;
  ultima: string | null;
}

/** Correspondentes extraídos do índice (RPC respeita RLS: usuário/admin). */
export async function getCorrespondentes(): Promise<Correspondente[]> {
  if (!isSupabaseConfigured()) return [];
  const s = createClient();
  const { data, error } = await s.rpc("email_correspondentes");
  if (error) {
    if ((error as { code?: string }).code === "42883") return [];
    throw error;
  }
  return ((data as { email: string; nome: string | null; n: number; ultima: string | null }[]) ?? []).map(
    (r) => ({ email: r.email, nome: r.nome, n: Number(r.n), ultima: r.ultima })
  );
}
