"use client";

/**
 * Extrai texto de documentos de vários formatos para a ingestão de inteligência.
 * Roda no cliente (browser). Formatos: txt, md, csv, json, vcf, zip (export do
 * WhatsApp com mídia/localizações/contatos), pdf e docx (Word).
 * O texto resultante é enviado ao /api/whatsapp/parse (camada de IA).
 */
export interface DocExtraido {
  texto: string;
  aviso?: string;
}

const ehTipo = (file: File, ext: string, mimes: string[]) =>
  file.name.toLowerCase().endsWith(ext) || mimes.includes(file.type);

export async function extrairTextoDocumento(file: File): Promise<DocExtraido> {
  // .zip — export do WhatsApp (chat + anexos)
  if (
    ehTipo(file, ".zip", [
      "application/zip",
      "application/x-zip-compressed",
      "multipart/x-zip",
    ])
  ) {
    return extrairZip(file);
  }

  // .docx (Word)
  if (
    ehTipo(file, ".docx", [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ])
  ) {
    const mammoth = await import("mammoth/mammoth.browser");
    const { value } = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return { texto: value };
  }

  // .pdf — extração de texto (reusa o leitor de PDF do OCR)
  if (ehTipo(file, ".pdf", ["application/pdf"])) {
    const { pdfExtractText } = await import("@/lib/ocr/pdf-client");
    const texto = await pdfExtractText(file);
    if (texto.replace(/\s/g, "").length > 40) return { texto };
    return {
      texto,
      aviso:
        "PDF com pouco texto (provavelmente digitalizado/imagem) — extração limitada.",
    };
  }

  // texto puro: .txt, .md, .csv, .json, .vcf, etc.
  return { texto: await file.text() };
}

async function extrairZip(file: File): Promise<DocExtraido> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  // 1) textos do chat (.txt) — formato padrão do export do WhatsApp
  let texto = "";
  for (const n of nomes.filter((n) => n.toLowerCase().endsWith(".txt"))) {
    texto += (await zip.files[n].async("string")) + "\n";
  }
  // 2) se não houver .txt, concatena outros textos (md/csv/json/vcf)
  if (!texto.trim()) {
    for (const n of nomes.filter((n) => /\.(md|csv|json|vcf)$/i.test(n))) {
      texto += (await zip.files[n].async("string")) + "\n";
    }
  }

  // 3) anota anexos (mídia/contatos) como contexto para a IA
  const midias = nomes.filter((n) =>
    /\.(jpe?g|png|webp|gif|opus|mp3|m4a|mp4|3gp|pdf|vcf)$/i.test(n)
  );
  if (midias.length) {
    const lista = midias
      .slice(0, 50)
      .map((m) => m.split("/").pop())
      .join(", ");
    texto += `\n\n[Anexos no .zip: ${midias.length} arquivo(s): ${lista}${
      midias.length > 50 ? " …" : ""
    }]`;
  }

  return {
    texto: texto.trim(),
    aviso: texto.trim() ? undefined : "Nenhum texto encontrado no .zip.",
  };
}
