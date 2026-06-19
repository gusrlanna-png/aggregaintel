"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Play, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LoteResp {
  processados: number;
  geocodificados: number;
  restantes: number;
}

export default function GeocodeLotePage() {
  const [rodando, setRodando] = React.useState(false);
  const [geocodificados, setGeocodificados] = React.useState(0);
  const [restantes, setRestantes] = React.useState<number | null>(null);
  const pararRef = React.useRef(false);

  async function rodarLote(): Promise<LoteResp> {
    const res = await fetch("/api/geocode/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote: 30 }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Falha no lote.");
    return json as LoteResp;
  }

  async function iniciar() {
    setRodando(true);
    pararRef.current = false;
    setGeocodificados(0);
    try {
      for (;;) {
        if (pararRef.current) break;
        const r = await rodarLote();
        setGeocodificados((g) => g + r.geocodificados);
        setRestantes(r.restantes);
        if (r.processados === 0 || r.restantes === 0) break;
      }
      toast.success("Geocodificação concluída (ou pausada).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na geocodificação.");
    } finally {
      setRodando(false);
    }
  }

  function parar() {
    pararRef.current = true;
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Geocodificar endereços</h1>
          <p className="text-sm text-muted-foreground">
            Localiza no mapa os cadastros com endereço mas sem coordenada
            (referencial do endereço). Não altera coordenadas salvas manualmente.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Processa em lotes de 30, respeitando o limite do serviço de mapas
            (~1 por segundo). Pode levar alguns minutos para milhares de
            cadastros — deixe a aba aberta. Você pode pausar e retomar quando
            quiser (continua de onde parou).
          </p>

          {(rodando || restantes !== null) && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p>
                Geocodificados nesta sessão:{" "}
                <strong className="tabular-nums">{geocodificados}</strong>
              </p>
              {restantes !== null && (
                <p>
                  Restantes (estimado):{" "}
                  <strong className="tabular-nums">{restantes}</strong>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!rodando ? (
              <Button onClick={iniciar}>
                <Play className="h-4 w-4" /> Iniciar geocodificação
              </Button>
            ) : (
              <Button variant="outline" onClick={parar}>
                <Square className="h-4 w-4" /> Pausar
              </Button>
            )}
            {rodando && <Loader2 className="h-5 w-5 animate-spin self-center text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
