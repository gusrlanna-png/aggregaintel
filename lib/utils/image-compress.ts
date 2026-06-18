/**
 * Compressão de imagem para armazenamento (roda no browser).
 *
 * Documentos fotografados (NFs) vêm com vários MB e resolução muito maior do que
 * o necessário para leitura. Aqui reduzimos a maior dimensão para `maxDim` e
 * exportamos em WebP (melhor relação qualidade/tamanho; ~30% menor que JPEG na
 * mesma qualidade), com fallback para JPEG se o browser não suportar WebP.
 *
 * PDFs e arquivos não-imagem passam direto, sem alteração.
 */
export async function compressImageForStorage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<File> {
  if (typeof document === "undefined") return file; // SSR guard
  if (!file.type.startsWith("image/")) return file; // PDF etc. passam direto

  const maxDim = opts.maxDim ?? 1600; // suficiente para ler o texto da NF
  const quality = opts.quality ?? 0.72;

  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await loadImage(file);
  } catch {
    return file; // não conseguiu decodificar -> mantém original
  }

  const width = (src as HTMLImageElement).naturalWidth || src.width;
  const height = (src as HTMLImageElement).naturalHeight || src.height;
  if (!width || !height) return file;

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(src, 0, 0, w, h);
  (src as ImageBitmap).close?.();

  // tenta WebP; se vier null (sem suporte), cai para JPEG
  const blob =
    (await canvasToBlob(canvas, "image/webp", quality)) ??
    (await canvasToBlob(canvas, "image/jpeg", quality));
  if (!blob) return file;

  // se a imagem já era pequena e a "comprimida" ficou maior, mantém o original
  if (blob.size >= file.size) return file;

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "nf";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}
