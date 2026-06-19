export interface GraphMessage {
  id: string;
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  from: {
    emailAddress: { name: string; address: string };
  } | null;
  toRecipients: {
    emailAddress: { name: string; address: string };
  }[];
  webLink: string;
}

export interface GraphMessagesResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

/**
 * Busca e-mails enviados/recebidos com um endereço via Microsoft Graph.
 * Usa KQL search (participantes = remetente ou destinatário). O `termo`
 * opcional restringe por palavra no ASSUNTO ou no CORPO (KQL full-text).
 * SEGURANÇA: consulta sempre /me (caixa do próprio usuário logado); um
 * usuário nunca lê a caixa de outro por aqui.
 */
export async function fetchEmailsByContact(
  providerToken: string,
  email: string,
  limit = 25,
  termo?: string
): Promise<GraphMessage[]> {
  // KQL: participante = e-mail do contato; e, se houver, o termo livre
  // (o Graph busca em assunto + corpo). Aspas removidas para não quebrar a query.
  const t = (termo ?? "").replace(/"/g, "").trim();
  const search = t
    ? `"participants:${email}" AND "${t}"`
    : `"participants:${email}"`;
  // IMPORTANTE: o Graph NÃO aceita $orderby junto com $search (erro 400
  // SearchWithOrderBy). Buscamos por relevância e ordenamos por data no cliente.
  const params = new URLSearchParams({
    $search: search,
    $top: String(limit),
    $select:
      "id,subject,bodyPreview,receivedDateTime,isRead,isDraft,from,toRecipients,webLink",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?${params}`,
    {
      headers: {
        Authorization: `Bearer ${providerToken}`,
        ConsistencyLevel: "eventual",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph Mail error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as GraphMessagesResponse;
  return (json.value ?? []).sort((a, b) =>
    (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? "")
  );
}

export interface GraphMessageBody {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } } | null;
  toRecipients: { emailAddress: { name: string; address: string } }[];
  webLink: string;
  body: { contentType: "html" | "text"; content: string };
}

/**
 * Lê o conteúdo completo de UM e-mail (assunto + corpo) para exibir dentro do
 * sistema, sem ir ao Outlook. Sempre via /me (caixa do usuário logado).
 */
export async function fetchEmailBody(
  providerToken: string,
  id: string
): Promise<GraphMessageBody> {
  const params = new URLSearchParams({
    $select: "id,subject,receivedDateTime,from,toRecipients,webLink,body",
  });
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}?${params}`,
    { headers: { Authorization: `Bearer ${providerToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph Mail error ${res.status}: ${text}`);
  }
  return (await res.json()) as GraphMessageBody;
}

/** Formata data de e-mail para exibição compacta. */
export function fmtDataEmail(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  if (hoje.getTime() - d.getTime() < 7 * 24 * 3600 * 1000) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
