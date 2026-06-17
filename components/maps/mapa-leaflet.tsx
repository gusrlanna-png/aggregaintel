"use client";

import * as React from "react";
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { LocalPonto } from "./mapa-locais";

export interface CirculoRaio {
  id: string;
  lat: number;
  lng: number;
  raioM: number;
  cor: string;
}

const COR_PADRAO = "#0F6E56";

/**
 * Camadas base do mapa: Satélite (padrão) e Ruas, com rótulos opcionais.
 * Esri World Imagery e OSM — gratuitos, sem chave de API.
 */
export function CamadasBase() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Satélite">
        <TileLayer
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Ruas (OSM)">
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.Overlay checked name="Rótulos (cidades/vias)">
        <TileLayer
          attribution="Labels &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.Overlay>
    </LayersControl>
  );
}

/** Marcador com símbolo (inicial do segmento) — usado quando p.simbolo existe. */
function iconeSimbolo(cor: string, simbolo: string, destaque?: boolean) {
  const s = destaque ? 26 : 22;
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;line-height:1">${simbolo}</div>`,
  });
}

function AjustarLimites({ pontos }: { pontos: LocalPonto[] }) {
  const map = useMap();
  React.useEffect(() => {
    const pts = pontos
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => [p.lat as number, p.lng as number] as [number, number]);
    if (pts.length === 1) map.setView(pts[0], 12);
    else if (pts.length > 1)
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  }, [pontos, map]);
  return null;
}

export function MapaLeaflet({
  pontos,
  circulos = [],
  altura = 360,
}: {
  pontos: LocalPonto[];
  circulos?: CirculoRaio[];
  altura?: number;
}) {
  const comGeo = pontos.filter((p) => p.lat != null && p.lng != null);
  const centro: [number, number] = comGeo[0]
    ? [comGeo[0].lat as number, comGeo[0].lng as number]
    : [-19.93, -44.05];

  return (
    <MapContainer
      center={centro}
      zoom={11}
      scrollWheelZoom
      className="relative z-0"
      style={{ height: altura, width: "100%" }}
    >
      <CamadasBase />
      <AjustarLimites pontos={comGeo} />
      {circulos.map((c) => (
        <Circle
          key={c.id}
          center={[c.lat, c.lng]}
          radius={c.raioM}
          pathOptions={{
            color: c.cor,
            weight: 1,
            fillColor: c.cor,
            fillOpacity: 0.08,
          }}
        />
      ))}
      {comGeo.map((p) => {
        const conteudo = (
          <>
            <Tooltip direction="top" offset={[0, -4]}>
              <span style={{ fontWeight: 600 }}>{p.nome}</span>
              {p.detalhe ? <div>{p.detalhe}</div> : null}
            </Tooltip>
            <Popup>
              <div>
                <p style={{ fontWeight: 600 }}>{p.nome}</p>
                {p.detalhe && (
                  <p style={{ fontSize: 12, color: "#64748b" }}>{p.detalhe}</p>
                )}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "#0F6E56" }}
                >
                  abrir no mapa
                </a>
              </div>
            </Popup>
          </>
        );
        return p.simbolo ? (
          <Marker
            key={p.id}
            position={[p.lat as number, p.lng as number]}
            icon={iconeSimbolo(p.cor ?? COR_PADRAO, p.simbolo, p.destaque)}
          >
            {conteudo}
          </Marker>
        ) : (
          <CircleMarker
            key={p.id}
            center={[p.lat as number, p.lng as number]}
            radius={p.destaque ? 9 : 7}
            pathOptions={{
              color: "#fff",
              weight: p.destaque ? 2 : 1,
              fillColor: p.cor ?? COR_PADRAO,
              fillOpacity: 0.9,
            }}
          >
            {conteudo}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
