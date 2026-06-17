"use client";

import * as React from "react";
import { Maximize2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Imagem que abre em tela cheia para conferência: zoom (+/−), rotação e
 * pan (arrastar / pinça no celular). Usada na revisão de NF para ler a foto.
 */
export function ZoomableImage({
  src,
  alt,
  className,
  thumbClassName,
}: {
  src: string;
  alt?: string;
  className?: string;
  thumbClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const [rot, setRot] = React.useState(0);

  function reset() {
    setScale(1);
    setRot(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted",
          className
        )}
        aria-label="Ampliar imagem"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          className={cn("h-auto w-full object-contain", thumbClassName)}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-90">
          <Maximize2 className="h-3.5 w-3.5" /> Ampliar
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[96vw] gap-0 border-0 bg-background/95 p-0 sm:max-w-[92vw]">
          <div className="flex items-center gap-1 border-b p-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(6, +(s + 0.5).toFixed(2)))}
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(1, +(s - 0.5).toFixed(2)))}
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setRot((r) => (r + 90) % 360)}
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Girar"
            >
              <RotateCw className="h-5 w-5" />
            </button>
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={reset}
              className="ml-auto mr-8 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
            >
              Restaurar
            </button>
          </div>
          <div
            className="max-h-[82vh] overflow-auto"
            style={{ touchAction: "pinch-zoom" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt ?? ""}
              draggable={false}
              style={{
                width: `${scale * 100}%`,
                maxWidth: "none",
                transform: `rotate(${rot}deg)`,
              }}
              className="mx-auto block h-auto origin-center select-none transition-[width]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
