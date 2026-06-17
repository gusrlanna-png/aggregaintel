"use client";

import * as React from "react";
import {
  MapContainer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CamadasBase } from "@/components/maps/mapa-leaflet";
import { salvarCoordenadas } from "@/lib/supabase/mapa";

const PIN = L.divIcon({
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#0F6E56;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);transform:rotate(-45deg)"></div>`,
});

function Reposicionar({ pos }: { pos: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

function Clicavel({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSet(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Mapa com marcador arrastável para ajustar o ponto exato de um cadastro
 * (cliente ou produtor). Salva lat/lng usados no Mapa de decisão.
 */
export function MapaEditavel({
  tabela,
  id,
  lat,
  lng,
  onSaved,
}: {
  tabela: "clientes" | "emissores";
  id: string;
  lat: number | null;
  lng: number | null;
  onSaved?: (lat: number, lng: number) => void;
}) {
  const inicial: [number, number] = [lat ?? -19.92, lng ?? -44.05];
  const [pos, setPos] = React.useState<[number, number]>(inicial);
  const [salvando, setSalvando] = React.useState(false);
  const semCoord = lat == null || lng == null;
  const mudou =
    Math.abs(pos[0] - (lat ?? pos[0])) > 1e-6 ||
    Math.abs(pos[1] - (lng ?? pos[1])) > 1e-6 ||
    semCoord;

  async function salvar() {
    setSalvando(true);
    try {
      await salvarCoordenadas(tabela, id, pos[0], pos[1]);
      toast.success("Localização salva — refletirá no Mapa de decisão.");
      onSaved?.(pos[0], pos[1]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar localização.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Arraste o marcador ou clique no mapa para ajustar o ponto exato.
        {semCoord && " Este cadastro ainda não tem coordenada — posicione no mapa."}
      </p>
      <div className="overflow-hidden rounded-md border">
        <MapContainer
          center={inicial}
          zoom={semCoord ? 6 : 14}
          scrollWheelZoom
          className="relative z-0"
          style={{ height: 300, width: "100%" }}
        >
          <CamadasBase />
          <Reposicionar pos={pos} />
          <Clicavel onSet={(la, ln) => setPos([la, ln])} />
          <Marker
            position={pos}
            icon={PIN}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target.getLatLng();
                setPos([m.lat, m.lng]);
              },
            }}
          />
        </MapContainer>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
        </span>
        <Button size="sm" onClick={salvar} disabled={salvando || !mudou}>
          {salvando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar localização
        </Button>
      </div>
    </div>
  );
}
