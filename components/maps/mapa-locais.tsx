"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ExternalLink, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LocalPonto {
  id: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  detalhe?: string;
  /** Cor do marcador (ex.: por grupo econômico / segmento / status). */
  cor?: string;
  /** Símbolo curto exibido no marcador (ex.: inicial do segmento). */
  simbolo?: string;
  destaque?: boolean;
}

const COR_PADRAO = "#0F6E56";

// O Leaflet acessa window/document — carrega só no cliente.
const MapaLeaflet = dynamic(
  () => import("./mapa-leaflet").then((m) => m.MapaLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <MapPin className="h-8 w-8 animate-pulse" />
      </div>
    ),
  }
);

export function MapaLocais({
  pontos,
  altura = 360,
}: {
  pontos: LocalPonto[];
  altura?: number;
}) {
  const comGeo = pontos.filter((p) => p.lat != null && p.lng != null);

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-lg border bg-muted"
        style={{ height: altura }}
      >
        <MapaLeaflet pontos={pontos} altura={altura} />
      </div>

      {comGeo.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Nenhum local georreferenciado ainda. As coordenadas são preenchidas
          automaticamente pelo CNPJ no cadastro.
        </p>
      )}

      {pontos.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {pontos.map((p) => (
            <li key={p.id}>
              <span
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm",
                  p.destaque && "ring-1 ring-primary"
                )}
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: p.cor ?? COR_PADRAO }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.nome}</span>
                  {p.detalhe && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.detalhe}
                    </span>
                  )}
                </span>
                {p.lat != null && p.lng != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label="Abrir no mapa"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
