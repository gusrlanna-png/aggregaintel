"use client";

import type { VisitaCriadaWa } from "@/lib/supabase/visitas";

/**
 * Anexa as mídias de um ZIP de export do WhatsApp às visitas criadas a partir
 * dele. Correlaciona cada arquivo de mídia à DATA da mensagem que o referencia
 * (no _chat.txt) e anexa à visita com a mesma data. Quando há uma só visita
 * (caso comum: 1 conversa = 1 cliente), anexa todas as mídias a ela.
 */
const MIDIA_RE = /\.(jpe?g|png|webp|gif|opus|mp3|m4a|aac|ogg|mp4|3gp|mov|pdf|vcf)$/i;
const LINHA_DATA_RE = /^\[?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

function isoDe(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function mimeDe(nome: string): string {
  const e = nome.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    mp4: "video/mp4", "3gp": "video/3gpp", mov: "video/quicktime",
    opus: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
    pdf: "application/pdf", vcf: "text/vcard",
  };
  return map[e] || "application/octet-stream";
}

export async function anexarMidiasWhatsapp(
  zipFile: File,
  visitas: VisitaCriadaWa[],
  limite = 40
): Promise<{ anexadas: number; total: number }> {
  if (visitas.length === 0) return { anexadas: 0, total: 0 };
  const JSZip = (await import("jszip")).default;
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  } catch {
    return { anexadas: 0, total: 0 };
  }
  const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const midias = nomes.filter((n) => MIDIA_RE.test(n));
  if (midias.length === 0) return { anexadas: 0, total: 0 };

  // Mapa base-do-arquivo → data ISO (a partir das linhas do chat que o citam).
  const txts = nomes.filter((n) => n.toLowerCase().endsWith(".txt"));
  const dataPorArquivo = new Map<string, string>();
  for (const t of txts) {
    const conteudo = await zip.files[t].async("string");
    for (const linha of conteudo.split(/\r?\n/)) {
      if (!LINHA_DATA_RE.test(linha)) continue;
      const data = isoDe(linha);
      if (!data) continue;
      const m = linha.match(/([\w\-. ]+\.(?:jpe?g|png|webp|gif|opus|mp3|m4a|aac|ogg|mp4|3gp|mov|pdf|vcf))/i);
      if (m) dataPorArquivo.set(m[1].trim().toLowerCase(), data);
    }
  }

  const { addAnexoArquivo } = await import("@/lib/supabase/visita-anexos");
  const visitaUnica = visitas.length === 1 ? visitas[0] : null;
  let anexadas = 0;

  for (const n of midias.slice(0, limite)) {
    const base = (n.split("/").pop() || n).trim();
    const data = dataPorArquivo.get(base.toLowerCase()) ?? null;
    // Escolhe a visita: por data; senão a única; senão pula.
    const alvo =
      (data && visitas.find((v) => v.data === data)) || visitaUnica || null;
    if (!alvo) continue;
    try {
      const blob = await zip.files[n].async("blob");
      const file = new File([blob], base, { type: mimeDe(base) });
      await addAnexoArquivo(alvo.id, file);
      anexadas++;
    } catch {
      /* ignora arquivo problemático */
    }
  }
  return { anexadas, total: midias.length };
}
