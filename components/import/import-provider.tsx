"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { emptyForm, ocrToForm, type NFFormValues } from "@/lib/utils/ocr-map";
import { parseNFText } from "@/lib/utils/nf-text-parse";
import { getEmissores } from "@/lib/supabase/emissores";
import { findDuplicateNF } from "@/lib/supabase/nf";
import type { Emissor } from "@/lib/supabase/types";
import { isValidCNPJ, onlyDigits } from "@/lib/utils/masks";

export interface QueueItem {
  file: File;
  previewUrl: string;
  isPdf: boolean;
  form: NFFormValues;
  provider: string;
}

export const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  claude: "Claude",
  groq: "Groq",
  openrouter: "OpenRouter",
  ocrspace: "OCR.space",
  ia: "IA",
  local: "OCR local",
  manual: "manual",
};

interface ImportState {
  files: File[];
  previews: string[];
  items: QueueItem[] | null;
  current: number;
  loading: boolean;
  progress: { done: number; total: number };
  espera: string | null;
  salvandoTodas: boolean;
  addFiles: (list: FileList | File[] | null) => void;
  removeFile: (idx: number) => void;
  extrair: () => Promise<void>;
  avancar: () => void;
  pular: () => void;
  salvarTodas: () => Promise<void>;
  setCurrent: (i: number) => void;
  updateCurrentForm: (form: NFFormValues) => void;
  reset: () => void;
}

const Ctx = React.createContext<ImportState | null>(null);

export function useImport(): ImportState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useImport deve ser usado dentro de ImportProvider");
  return ctx;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isRateLimited = (status: number, json: { error?: string }) => {
  const e = String(json?.error ?? "");
  return (
    status === 429 ||
    status === 503 ||
    /\b429\b|\b503\b|quota|high demand|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(e)
  );
};

async function callExtract(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/nf/extract", { method: "POST", body: fd });
  let json: {
    ocr?: unknown;
    form?: NFFormValues;
    provider?: string;
    error?: string;
  } = {};
  try {
    json = await res.json();
  } catch {
    /* sem corpo */
  }
  return { json, status: res.status };
}

/** Casa o emissor da NF (por CNPJ ou razão social) com um produtor já cadastrado. */
function matchEmissorId(
  form: NFFormValues,
  emissores: Emissor[]
): string | null {
  const cnpj = (form.emissor_cnpj || "").replace(/\D/g, "");
  if (cnpj.length >= 11) {
    const e = emissores.find(
      (x) => (x.cnpj || "").replace(/\D/g, "") === cnpj
    );
    if (e) return e.id;
  }
  const nome = (form.emissor_razao || "").trim().toLowerCase();
  if (nome) {
    const e = emissores.find(
      (x) => x.razao_social.trim().toLowerCase() === nome
    );
    if (e) return e.id;
  }
  return null;
}

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [items, setItems] = React.useState<QueueItem[] | null>(null);
  const [current, setCurrent] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [espera, setEspera] = React.useState<string | null>(null);
  const [salvandoTodas, setSalvandoTodas] = React.useState(false);

  // Evita que soltar um arquivo fora da área abra-o em outra aba (app-wide).
  React.useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    const novos = Array.from(list).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (novos.length === 0) return;
    setItems(null);
    setFiles((prev) => [...prev, ...novos]);
    setPreviews((prev) => [
      ...prev,
      ...novos.map((f) => URL.createObjectURL(f)),
    ]);
  }

  function removeFile(idx: number) {
    setPreviews((prev) => {
      const u = prev[idx];
      if (u) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== idx);
    });
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function reset() {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviews([]);
    setItems(null);
    setCurrent(0);
    setProgress({ done: 0, total: 0 });
    setEspera(null);
  }

  function updateCurrentForm(form: NFFormValues) {
    setItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      if (copy[current]) copy[current] = { ...copy[current], form };
      return copy;
    });
  }

  async function extrair() {
    if (files.length === 0) return;
    setLoading(true);
    setProgress({ done: 0, total: files.length });
    const result: QueueItem[] = [];
    let okIA = 0;
    let okLocal = 0;
    let manual = 0;
    let jaMigradas = 0;
    let cnpjVerificados = 0;
    let cnpjRemovidos = 0;
    // Produtores cadastrados — para casar o emissor e detectar NFs já migradas.
    const emissoresCad = await getEmissores().catch(() => [] as Emissor[]);

    const workerRef: { current: import("tesseract.js").Worker | null } = {
      current: null,
    };
    const getWorker = async () => {
      if (!workerRef.current) {
        const { createOcrWorker } = await import("@/lib/ocr/tesseract-client");
        workerRef.current = await createOcrWorker();
      }
      return workerRef.current;
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === "application/pdf";
      let form = emptyForm();
      let usouIA = false;
      let provider = "manual";
      try {
        let { json, status } = await callExtract(file);
        for (let tent = 1; tent <= 4 && isRateLimited(status, json); tent++) {
          setEspera(`Limite da IA atingido — aguardando ${tent * 15}s (NF ${i + 1})…`);
          await sleep(15000);
          ({ json, status } = await callExtract(file));
        }
        setEspera(null);

        if (status === 200 && json.ocr) {
          form = ocrToForm(json.ocr as Parameters<typeof ocrToForm>[0]);
          okIA++;
          usouIA = true;
          provider = json.provider ?? "ia";
        } else if (status === 200 && json.form) {
          form = json.form;
          okIA++;
          usouIA = true;
          provider = json.provider ?? "ocrspace";
        } else if (status === 200 && json.provider === "none") {
          const { recognizeImage } = await import("@/lib/ocr/tesseract-client");
          if (isPdf) {
            const { pdfExtractText, pdfRenderFirstPage } = await import(
              "@/lib/ocr/pdf-client"
            );
            const texto = await pdfExtractText(file);
            if (texto.replace(/\s/g, "").length > 80) {
              form = parseNFText(texto);
            } else {
              const canvas = await pdfRenderFirstPage(file);
              form = parseNFText(await recognizeImage(await getWorker(), canvas));
            }
          } else {
            form = parseNFText(await recognizeImage(await getWorker(), file));
          }
          okLocal++;
          provider = "local";
        } else {
          manual++;
        }
      } catch {
        manual++;
      }

      // Valida o CNPJ do emissor na Receita (só para produtor novo, não casado):
      // completa a razão oficial e REMOVE CNPJ inexistente (não cria produtor
      // errado no "Salvar todas"). 404 = remove; 502/500 = mantém (transitório).
      if (!matchEmissorId(form, emissoresCad)) {
        const d = onlyDigits(form.emissor_cnpj);
        if (d.length === 14 && isValidCNPJ(d)) {
          try {
            const r = await fetch(`/api/cnpj/${d}`);
            if (r.ok) {
              const c = await r.json();
              form = {
                ...form,
                emissor_razao: c.razao_social || form.emissor_razao,
                emissor_municipio: c.municipio || form.emissor_municipio,
                emissor_uf: c.uf || form.emissor_uf,
              };
              cnpjVerificados++;
            } else if (r.status === 404) {
              form = { ...form, emissor_cnpj: "" };
              cnpjRemovidos++;
            }
          } catch {
            /* rede: mantém o que foi lido */
          }
        } else if (d.length > 0) {
          // dígito verificador inválido → remove (será preenchido na revisão)
          form = { ...form, emissor_cnpj: "" };
          cnpjRemovidos++;
        }
      }

      // Descarta NFs já migradas (mesma chave OU mesmo nº/série/produtor).
      const numeroNF = Number(form.numero_nf);
      const chaveNF = (form.chave_acesso || "").replace(/\D/g, "");
      const emissorMatch = matchEmissorId(form, emissoresCad);
      if (numeroNF > 0 && (chaveNF || emissorMatch)) {
        try {
          const dup = await findDuplicateNF({
            numero_nf: numeroNF,
            serie: form.serie || null,
            emissor_id: emissorMatch,
            chave_acesso: chaveNF || null,
          });
          if (dup) {
            jaMigradas++;
            setProgress({ done: i + 1, total: files.length });
            continue;
          }
        } catch {
          /* se a checagem falhar, segue para revisão manual */
        }
      }

      result.push({ file, previewUrl: previews[i], isPdf, form, provider });
      setProgress({ done: i + 1, total: files.length });
      if (usouIA && i < files.length - 1) await sleep(2500);
    }

    setEspera(null);
    if (workerRef.current) await workerRef.current.terminate();

    setItems(result.length ? result : null);
    setCurrent(0);
    setLoading(false);

    if (result.length === 0) {
      reset();
      if (jaMigradas > 0) {
        toast.info(
          `${jaMigradas} NF(s) já estavam migradas — descartadas. Nada novo para revisar.`
        );
      } else {
        toast.warning(
          "Não foi possível ler automaticamente. Tente outra foto ou cadastre manual."
        );
      }
      return;
    }

    const partes: string[] = [];
    if (okIA) partes.push(`${okIA} por IA`);
    if (okLocal) partes.push(`${okLocal} por OCR local`);
    if (manual) partes.push(`${manual} p/ preencher`);
    if (jaMigradas) partes.push(`${jaMigradas} já migrada(s) descartada(s)`);
    if (cnpjRemovidos)
      partes.push(`${cnpjRemovidos} CNPJ inválido(s) removido(s)`);
    void cnpjVerificados;
    toast.success(
      `Leitura concluída (${partes.join(" · ")}). Revise antes de salvar.`
    );
  }

  function avancar() {
    setItems((prev) => prev);
    if (!items) return;
    if (current < items.length - 1) {
      setCurrent(current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.success("Todas as NFs do lote foram processadas.");
      reset();
      router.push("/nf");
      router.refresh();
    }
  }

  function pular() {
    avancar();
  }

  async function salvarTodas() {
    if (!items) return;
    const { saveNFFromForm } = await import("@/lib/utils/save-nf-from-form");
    setSalvandoTodas(true);
    let salvas = 0;
    let dup = 0;
    let invalidas = 0;
    let erros = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        setProgress({ done: i, total: items.length });
        const r = await saveNFFromForm(items[i].form);
        if (r.status === "saved" || r.status === "updated") salvas++;
        else if (r.status === "duplicate") dup++;
        else if (r.status === "invalid") invalidas++;
        else erros++;
      }
      toast.success(
        `Lote salvo: ${salvas} nova(s)${dup ? ` · ${dup} duplicada(s)` : ""}${
          invalidas ? ` · ${invalidas} incompleta(s)` : ""
        }${erros ? ` · ${erros} erro(s)` : ""}.`
      );
      reset();
      router.push("/nf");
      router.refresh();
    } finally {
      setSalvandoTodas(false);
    }
  }

  const value: ImportState = {
    files,
    previews,
    items,
    current,
    loading,
    progress,
    espera,
    salvandoTodas,
    addFiles,
    removeFile,
    extrair,
    avancar,
    pular,
    salvarTodas,
    setCurrent,
    updateCurrentForm,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
