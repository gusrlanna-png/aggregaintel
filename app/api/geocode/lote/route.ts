import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Coord { lat: number; lng: number }

async function geocode(addr: {
  logradouro: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}): Promise<Coord | null> {
  const cep = (addr.cep ?? "").replace(/\D/g, "");
  const street = (addr.logradouro ?? "").trim();
  const headers = { "User-Agent": "AggregaIntel/1.0 (geocode lote)", "Accept-Language": "pt-BR" };
  const base = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br";
  async function buscar(url: string): Promise<Coord | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const arr = (await res.json()) as { lat: string; lon: string }[];
      if (!arr?.length) return null;
      const lat = Number(arr[0].lat), lng = Number(arr[0].lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch { return null; }
  }
  const p = new URLSearchParams();
  if (street) p.set("street", street);
  if (addr.municipio) p.set("city", addr.municipio);
  if (addr.uf) p.set("state", addr.uf);
  if (cep) p.set("postalcode", cep);
  let r = [...p.keys()].length ? await buscar(`${base}&${p.toString()}`) : null;
  if (!r && cep) r = await buscar(`${base}&postalcode=${cep}`);
  if (!r) {
    const q = [street, addr.bairro, addr.municipio, addr.uf, "Brasil"].filter(Boolean).join(", ");
    if (q) r = await buscar(`${base}&q=${encodeURIComponent(q)}`);
  }
  return r;
}

/**
 * Geocodifica um LOTE de empresas sem coordenada de endereço (e sem coordenada
 * manual), respeitando o limite do Nominatim (~1 req/s). O cliente chama
 * repetidamente até `restantes` chegar a 0.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lote = Math.min(Math.max(Number(body?.lote) || 30, 1), 60);

  // Empresas ainda não tentadas, sem coord do endereço e não-manuais, com algum endereço.
  const { data: alvos, error } = await supabase
    .from("empresas")
    .select("id, logradouro, bairro, municipio, uf, cep")
    .is("endereco_lat", null)
    .is("geocode_tentado", null)
    .eq("coord_manual", false)
    .or("municipio.not.is.null,cep.not.is.null")
    .limit(lote);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let geocodificados = 0;
  const rows = alvos ?? [];
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const r = await geocode(e);
    const patch: Record<string, unknown> = { geocode_tentado: new Date().toISOString() };
    if (r) {
      patch.endereco_lat = r.lat;
      patch.endereco_lng = r.lng;
      patch.lat = r.lat; // efetiva (coord_manual=false garantido pelo filtro)
      patch.lng = r.lng;
      geocodificados++;
    }
    await supabase.from("empresas").update(patch).eq("id", e.id);
    if (i < rows.length - 1) await new Promise((res) => setTimeout(res, 1100)); // ~1 req/s
  }

  // Quantos ainda faltam (para a barra de progresso).
  const { count: restantes } = await supabase
    .from("empresas")
    .select("id", { count: "exact", head: true })
    .is("endereco_lat", null)
    .is("geocode_tentado", null)
    .eq("coord_manual", false)
    .or("municipio.not.is.null,cep.not.is.null");

  return NextResponse.json({ processados: rows.length, geocodificados, restantes: restantes ?? 0 });
}
