"use client";

import { createWorker, type ImageLike, type Worker } from "tesseract.js";

/**
 * OCR local no navegador (sem chave). Usado como fallback quando não há
 * GEMINI_API_KEY nem ANTHROPIC_API_KEY. Funciona apenas com imagens.
 */
export async function createOcrWorker(): Promise<Worker> {
  // Português + inglês melhora números/acentos das DANFEs.
  return createWorker(["por", "eng"]);
}

export async function recognizeImage(
  worker: Worker,
  image: ImageLike
): Promise<string> {
  const {
    data: { text },
  } = await worker.recognize(image);
  return text;
}
