"use client";

/**
 * Leitura de PDF no navegador (sem chave), via pdf.js:
 *  - pdfExtractText: extrai a camada de texto (DANFE digital) — preciso e rápido.
 *  - pdfRenderFirstPage: rasteriza a 1ª página (PDF escaneado) para OCR.
 */

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Worker correspondente à versão instalada (via CDN).
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

export async function pdfExtractText(file: File, maxPages = 3): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return text;
}

export async function pdfRenderFirstPage(
  file: File,
  scale = 3
): Promise<HTMLCanvasElement> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}
