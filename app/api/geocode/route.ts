import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

interface Coord {
  lat: number;
  lng: number;
}

async function viaGoogle(address: string, key: string): Promise<Coord | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=br&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const l = data.results[0].geometry.location;
    return { lat: l.lat, lng: l.lng };
  } catch {
    return null;
  }
}

async function viaNominatim(url: string): Promise<Coord | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": "AggregaIntel/1.0 (geocode interno)", "Accept-Language": "pt-BR" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: string; lon: string }[];
    if (!arr?.length) return null;
    const lat = Number(arr[0].lat);
    const lng = Number(arr[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * Geocodifica um endereço em coordenadas. Aceita campos estruturados
 * (logradouro/numero/bairro/municipio/uf/cep) ou um `address` livre.
 * Usa Google (se GOOGLE_MAPS_API_KEY) e cai para Nominatim/OSM (gratuito).
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const logradouro = String(b?.logradouro ?? "").trim();
  const numero = String(b?.numero ?? "").trim();
  const bairro = String(b?.bairro ?? "").trim();
  const municipio = String(b?.municipio ?? "").trim();
  const uf = String(b?.uf ?? "").trim();
  const cep = String(b?.cep ?? "").replace(/\D/g, "");
  const street = [logradouro, numero].filter(Boolean).join(" ");
  const livre =
    String(b?.address ?? "").trim() ||
    [street, bairro, municipio, uf, "Brasil"].filter(Boolean).join(", ");

  if (!municipio && !cep && !street && !String(b?.address ?? "").trim()) {
    return NextResponse.json({ error: "Endereço insuficiente." }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  let r: Coord | null = key ? await viaGoogle(livre, key) : null;

  if (!r) {
    const base = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br";
    const p1 = new URLSearchParams();
    if (street) p1.set("street", street);
    if (municipio) p1.set("city", municipio);
    if (uf) p1.set("state", uf);
    if (cep) p1.set("postalcode", cep);
    if ([...p1.keys()].length) r = await viaNominatim(`${base}&${p1.toString()}`);
    if (!r && cep) r = await viaNominatim(`${base}&postalcode=${cep}`);
    if (!r) r = await viaNominatim(`${base}&q=${encodeURIComponent(livre)}`);
  }

  if (!r) return NextResponse.json({ error: "Endereço não localizado." }, { status: 404 });
  return NextResponse.json(r);
}
