"use client";

import * as React from "react";
import {
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  ScanLine,
  SkipForward,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { NFReviewForm } from "@/components/nf/nf-review-form";
import { PROVIDER_LABEL, useImport } from "@/components/import/import-provider";
import { cn } from "@/lib/utils";

/**
 * Fluxo de importação/cadastro de NF (seleção → extração → revisão em fila).
 * Reutilizável em /nf/nova e dentro da Inteligência (hub de entradas).
 * `mostrarTitulo=false` esconde o "Nova NF" (quando embutido numa aba).
 */
export function NFImport({
  mostrarTitulo = true,
}: {
  mostrarTitulo?: boolean;
}) {
  const {
    files,
    previews,
    items,
    current,
    loading,
    progress,
    espera,
    addFiles,
    removeFile,
    extrair,
    avancar,
    pular,
    setCurrent,
    updateCurrentForm,
    reset,
  } = useImport();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  // Recebe arquivo compartilhado do Android (Web Share Target): o service worker
  // guarda no cache "share-nf" e redireciona pra cá com ?compartilhado=1.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("compartilhado") || !("caches" in window)) return;
    (async () => {
      try {
        const cache = await caches.open("share-nf");
        const resp = await cache.match("shared-file");
        if (!resp) return;
        const blob = await resp.blob();
        const nome = resp.headers.get("x-filename") || "nf.jpg";
        const file = new File([blob], nome, {
          type: blob.type || "image/jpeg",
        });
        await cache.delete("shared-file");
        addFiles([file]);
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* ignora */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Modo revisão (fila) ──────────────────────────────────────────────
  if (items && items.length > 0) {
    const item = items[current];
    const last = current === items.length - 1;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              title="Cancelar e voltar para a seleção de arquivos"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            {mostrarTitulo && (
              <h1 className="text-xl font-bold tracking-tight">Nova NF</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={item.provider === "manual" ? "warning" : "secondary"}
            >
              {item.provider === "manual"
                ? "preencher manual"
                : `lida via ${PROVIDER_LABEL[item.provider] ?? item.provider}`}
            </Badge>
            <Badge variant="secondary">
              NF {current + 1} de {items.length}
            </Badge>
          </div>
        </div>

        {items.length > 1 && (
          <>
            <Progress value={((current + 1) / items.length) * 100} />
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {items.map((it, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border",
                    i === current
                      ? "ring-2 ring-primary"
                      : "opacity-70 hover:opacity-100"
                  )}
                  aria-label={`Ir para NF ${i + 1}`}
                >
                  {it.isPdf ? (
                    <span className="flex h-full w-full items-center justify-center bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {i < current && (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <NFReviewForm
          key={current}
          initial={item.form}
          imageUrl={item.isPdf ? null : item.previewUrl}
          onSaved={avancar}
          onFormChange={updateCurrentForm}
          submitLabel={last ? "Salvar NF" : "Salvar e próxima"}
        />

        {!last && (
          <Button variant="ghost" className="w-full" onClick={pular}>
            <SkipForward className="h-4 w-4" /> Pular esta NF
          </Button>
        )}
      </div>
    );
  }

  // ── Modo seleção ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {mostrarTitulo && (
        <h1 className="text-xl font-bold tracking-tight">Nova NF</h1>
      )}
      <Card>
        <CardContent className="space-y-4 p-4">
          <input
            ref={inputRef}
            id="nf-file-input"
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <input
            ref={cameraRef}
            id="nf-camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              if (cameraRef.current) cameraRef.current.value = "";
            }}
          />

          {previews.length === 0 ? (
            <label
              htmlFor="nf-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 text-muted-foreground transition-colors hover:border-primary hover:text-primary",
                dragOver
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted-foreground/30"
              )}
            >
              <Camera className="h-10 w-10" />
              <span className="font-medium">
                Clique para selecionar ou arraste os arquivos aqui
              </span>
              <span className="text-xs">
                Imagem (JPG/PNG) ou PDF · vários de uma vez · até 50MB cada
              </span>
            </label>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "grid grid-cols-3 gap-2 rounded-lg sm:grid-cols-4",
                dragOver && "ring-2 ring-primary"
              )}
            >
              {files.map((file, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {file.type === "application/pdf" ? (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-muted-foreground">
                      <FileText className="h-6 w-6" />
                      <span className="line-clamp-2 text-[10px]">
                        {file.name}
                      </span>
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[i]}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label
                htmlFor="nf-file-input"
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Adicionar mais"
              >
                <Upload className="h-6 w-6" />
                <span className="text-[10px]">Adicionar</span>
              </label>
            </div>
          )}

          {previews.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {files.length} arquivo(s) selecionado(s)
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <label htmlFor="nf-file-input" className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {previews.length
                  ? "Adicionar arquivos"
                  : "Selecionar arquivo(s)"}
              </label>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <label htmlFor="nf-camera-input" className="cursor-pointer">
                <Camera className="h-4 w-4" />
                Tirar foto
              </label>
            </Button>
            <Button
              className="flex-1"
              disabled={files.length === 0 || loading}
              onClick={extrair}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              {files.length > 1 ? `Extrair ${files.length} NFs` : "Extrair dados"}
            </Button>
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress
                value={
                  progress.total ? (progress.done / progress.total) * 100 : 0
                }
              />
              <p className="text-center text-xs text-muted-foreground">
                Lendo notas fiscais… {progress.done}/{progress.total}
              </p>
              {espera && (
                <p className="text-center text-xs font-medium text-amber-600">
                  {espera}
                </p>
              )}
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
