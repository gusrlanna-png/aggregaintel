import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { address } = await req.json().catch(() => ({ address: "" }));
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "Endereço ausente." }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY não configurada." },
      { status: 503 }
    );
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&region=br&key=${key}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    return NextResponse.json(
      { error: `Geocoding falhou: ${data.status}` },
      { status: 404 }
    );
  }

  const r = data.results[0];
  return NextResponse.json({
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted_address: r.formatted_address,
  });
}
