export interface GraphContact {
  id: string;
  displayName: string;
  emailAddresses: { address: string; name?: string }[];
  mobilePhone: string | null;
  businessPhones: string[];
  homeAddress: {
    city?: string;
    state?: string;
    postalCode?: string;
    street?: string;
  } | null;
  businessAddress: {
    city?: string;
    state?: string;
    postalCode?: string;
    street?: string;
  } | null;
}

export interface GraphContactsResponse {
  value: GraphContact[];
  "@odata.nextLink"?: string;
}

/** Busca todos os contatos do Outlook via Microsoft Graph usando o provider_token do Supabase OAuth. */
export async function fetchOutlookContacts(
  providerToken: string
): Promise<GraphContact[]> {
  const all: GraphContact[] = [];
  let url: string | undefined =
    "https://graph.microsoft.com/v1.0/me/contacts" +
    "?$top=999" +
    "&$select=id,displayName,emailAddresses,mobilePhone,businessPhones,homeAddress,businessAddress" +
    "&$orderby=displayName";

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as GraphContactsResponse;
    all.push(...(json.value ?? []));
    url = json["@odata.nextLink"];
  }

  return all.filter((c) => c.displayName);
}

/** Extrai o melhor endereço disponível (business first, then home). */
export function enderecoDoContato(c: GraphContact) {
  const addr = c.businessAddress ?? c.homeAddress;
  return {
    logradouro: addr?.street ?? null,
    municipio: addr?.city ?? null,
    uf: addr?.state ?? null,
    cep: addr?.postalCode ?? null,
  };
}

/** Extrai o melhor telefone disponível. */
export function foneDoContato(c: GraphContact): string | null {
  return c.mobilePhone ?? c.businessPhones?.[0] ?? null;
}
