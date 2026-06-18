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
 * Usa KQL search (participantes = remetente ou destinatário).
 */
export async function fetchEmailsByContact(
  providerToken: string,
  email: string,
  limit = 20
): Promise<GraphMessage[]> {
  const params = new URLSearchParams({
    $search: `"participants:${email}"`,
    $top: String(limit),
    $select:
      "id,subject,bodyPreview,receivedDateTime,isRead,isDraft,from,toRecipients,webLink",
    $orderby: "receivedDateTime desc",
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
  return json.value ?? [];
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
