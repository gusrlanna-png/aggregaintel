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

async function isZipFile(file: File): Promise<boolean> {
  // detecta ZIP pelos magic bytes PK\x03\x04, independente de extensão ou MIME
  try {
    const buf = await file.slice(0, 4).arrayBuffer();
    const b = new Uint8Array(buf);
    return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  } catch {
    return false;
  }
}

export async function extrairTextoDocumento(file: File): Promise<DocExtraido> {
  // .zip — export do WhatsApp (chat + anexos)
  // verifica extensão, MIME type OU magic bytes (para exports sem extensão)
  if (
    ehTipo(file, ".zip", [
      "application/zip",
      "application/x-zip-compressed",
      "multipart/x-zip",
      "application/octet-stream",
    ]) ||
    (await isZipFile(file))
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
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(
      "Não foi possível abrir o arquivo como ZIP. Verifique se o arquivo não está corrompido."
    );
  }

  const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  // 1) textos do chat (.txt) — formato padrão do export do WhatsApp
  //    O Android exporta como "_chat.txt" (com underscore) ou "Conversa do WhatsApp com *.txt"
  let texto = "";
  const arquivosTxt = nomes.filter((n) => n.toLowerCase().endsWith(".txt"));

  // prioriza o arquivo de chat principal (maior .txt ou com "chat" no nome)
  const chatPrincipal = arquivosTxt.sort((a, b) => {
    const aChat = a.toLowerCase().includes("chat") ? 1 : 0;
    const bChat = b.toLowerCase().includes("chat") ? 1 : 0;
    return bChat - aChat;
  });

  for (const n of chatPrincipal) {
    const conteudo = await zip.files[n].async("string");
    texto += conteudo + "\n";
  }

  // 2) se não houver .txt, tenta outros formatos de texto
  if (!texto.trim()) {
    for (const n of nomes.filter((n) => /\.(md|csv|json|vcf)$/i.test(n))) {
      texto += (await zip.files[n].async("string")) + "\n";
    }
  }

  // 3) anota anexos (mídia/contatos/localizações) como contexto para a IA
  const midias = nomes.filter((n) =>
    /\.(jpe?g|png|webp|gif|opus|mp3|m4a|mp4|3gp|pdf|vcf)$/i.test(n)
  );
  if (midias.length) {
    const lista = midias
      .slice(0, 30)
      .map((m) => m.split("/").pop())
      .join(", ");
    texto += `\n\n[Anexos no ZIP: ${midias.length} arquivo(s): ${lista}${
      midias.length > 30 ? ` … e mais ${midias.length - 30}` : ""
    }]`;
  }

  if (!texto.trim()) {
    const listaArquivos = nomes.slice(0, 20).join(", ");
    return {
      texto: "",
      aviso: `Nenhum texto encontrado no ZIP. Arquivos encontrados: ${listaArquivos || "(vazio)"}`,
    };
  }

  return { texto: texto.trim() };
}
