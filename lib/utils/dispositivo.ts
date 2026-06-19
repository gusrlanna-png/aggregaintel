/** Traduz o user-agent num rótulo legível: "Windows · Chrome", "Android · Chrome". */
export function descreverDispositivo(ua: string | null | undefined): {
  os: string;
  navegador: string;
  tipo: "Celular" | "Tablet" | "Computador";
  label: string;
} {
  const s = ua ?? "";
  // Sistema operacional
  let os = "Desconhecido";
  if (/Windows NT 10/.test(s)) os = "Windows 10/11";
  else if (/Windows/.test(s)) os = "Windows";
  else if (/Android\s*([\d.]+)/.test(s)) os = "Android " + (s.match(/Android\s*([\d.]+)/)?.[1] ?? "");
  else if (/iPhone|iPad|iOS|CPU OS/.test(s)) os = "iOS";
  else if (/Mac OS X/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";

  // Navegador (ordem importa: Edge/Chrome contêm "Safari")
  let navegador = "Desconhecido";
  if (/Edg\//.test(s)) navegador = "Edge";
  else if (/OPR\/|Opera/.test(s)) navegador = "Opera";
  else if (/SamsungBrowser/.test(s)) navegador = "Samsung Internet";
  else if (/Chrome\//.test(s)) navegador = "Chrome";
  else if (/Firefox\//.test(s)) navegador = "Firefox";
  else if (/Safari\//.test(s)) navegador = "Safari";

  const tipo: "Celular" | "Tablet" | "Computador" = /iPad|Tablet/.test(s)
    ? "Tablet"
    : /Mobile|Android|iPhone/.test(s)
      ? "Celular"
      : "Computador";

  const label = [os, navegador].filter((x) => x && x !== "Desconhecido").join(" · ") || "Dispositivo";
  return { os, navegador, tipo, label };
}

/** Local legível: "Belo Horizonte/MG · Brasil". */
export function descreverLocal(g: {
  geo_cidade?: string | null;
  geo_uf?: string | null;
  geo_pais?: string | null;
}): string {
  const cidadeUf = [g.geo_cidade, g.geo_uf].filter(Boolean).join("/");
  return [cidadeUf, g.geo_pais].filter(Boolean).join(" · ");
}

/** Link de mapa (Google Maps). Usa coordenadas se houver; senão o texto do local. */
export function linkMapa(g: {
  geo_cidade?: string | null;
  geo_uf?: string | null;
  geo_pais?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
}): string | null {
  if (g.geo_lat != null && g.geo_lng != null) {
    return `https://www.google.com/maps?q=${g.geo_lat},${g.geo_lng}`;
  }
  const texto = [g.geo_cidade, g.geo_uf, g.geo_pais].filter(Boolean).join(", ");
  return texto ? `https://www.google.com/maps?q=${encodeURIComponent(texto)}` : null;
}
