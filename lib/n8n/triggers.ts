/**
 * Disparadores de webhooks n8n (Seção 5 do documento).
 * As URLs vêm das variáveis de ambiente N8N_WEBHOOK_*.
 */

const headers = () => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_API_KEY) h["X-N8N-API-KEY"] = process.env.N8N_API_KEY;
  return h;
};

export async function triggerCfemSync(): Promise<{ ok: boolean; message: string }> {
  const url = process.env.N8N_WEBHOOK_CFEM;
  if (!url) return { ok: false, message: "N8N_WEBHOOK_CFEM não configurado." };
  const res = await fetch(url, { method: "POST", headers: headers() });
  return {
    ok: res.ok,
    message: res.ok ? "Sincronização CFEM disparada." : `Erro ${res.status}`,
  };
}

/**
 * Envia o conteúdo de uma exportação .txt do WhatsApp ao parser n8n.
 */
export async function triggerWhatsappParse(
  conteudo: string
): Promise<{ ok: boolean; total?: number; relevantes?: number; inseridas?: number; message: string }> {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_WHATSAPP ?? process.env.N8N_WEBHOOK_WHATSAPP;
  if (!url) return { ok: false, message: "N8N_WEBHOOK_WHATSAPP não configurado." };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conteudo }),
  });
  if (!res.ok) return { ok: false, message: `Erro ${res.status}` };
  const data = await res.json().catch(() => ({}));
  return {
    ok: true,
    total: data.total,
    relevantes: data.relevantes,
    inseridas: data.inseridas,
    message: "Arquivo processado.",
  };
}
