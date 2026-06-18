import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Transcrição de áudio (gravado pelo usuário) → texto, via Groq Whisper (grátis).
 * Recebe FormData com o campo "file" (áudio). Requer GROQ_API_KEY.
 */
export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Transcrição por servidor indisponível (configure GROQ_API_KEY)." },
      { status: 503 }
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Áudio ausente." }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file, file.name || "audio.webm");
  fd.append("model", process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo");
  fd.append("language", "pt");
  fd.append("response_format", "json");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Falha na transcrição (${res.status}). ${t.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ texto: (data?.text ?? "").trim() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro na transcrição." },
      { status: 500 }
    );
  }
}
