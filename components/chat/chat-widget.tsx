"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Mic, Send, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

interface Msg {
  papel: "user" | "assistant";
  conteudo: string;
  provedor?: string | null;
}

/** Nome amigável da página, para o agente saber "onde o usuário está". */
function rotuloPagina(pathname: string): string {
  const mapa: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/visitas": "Visitas",
    "/visitas/nova": "Nova visita",
    "/nf": "Notas Fiscais",
    "/nf/nova": "Importar NF",
    "/concorrentes": "Produtores (Mercado)",
    "/clientes": "Clientes",
    "/pessoas": "Contatos",
    "/inteligencia": "Inteligência de mercado",
    "/ranking": "Ranking de produtores",
    "/produtos": "Produtos",
    "/mapa": "Mapa",
    "/configuracoes": "Configurações",
    "/configuracoes/brindes": "Configurações → Brindes",
    "/configuracoes/usuarios": "Configurações → Usuários",
    "/configuracoes/agentes": "Configurações → Agentes",
    "/configuracoes/desenvolvimento": "Configurações → Desenvolvimento",
    "/configuracoes/integracao": "Configurações → Integração",
    "/configuracoes/sazonalidade": "Configurações → Sazonalidade",
    "/configuracoes/carteiras": "Configurações → Carteiras",
    "/configuracoes/dias-uteis": "Configurações → Dias úteis",
    "/configuracoes/contatos-m365": "Configurações → Contatos M365",
  };
  if (mapa[pathname]) return mapa[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return mapa[base] ?? pathname;
}

/** Deriva o contexto (entidade + página) a partir da rota atual. */
function contextoDaRota(pathname: string): {
  entidade_tipo?: string;
  entidade_id?: string;
  pathname: string;
  pagina: string;
} {
  const pagina = rotuloPagina(pathname);
  let m = pathname.match(/^\/concorrentes\/([^/]+)/);
  if (m && m[1] !== "novo") return { entidade_tipo: "emissor", entidade_id: m[1], pathname, pagina };
  m = pathname.match(/^\/pessoas\/([^/]+)/);
  if (m) return { entidade_tipo: "pessoa", entidade_id: m[1], pathname, pagina };
  m = pathname.match(/^\/clientes\/([^/]+)/);
  if (m && m[1] !== "novo") return { entidade_tipo: "cliente", entidade_id: m[1], pathname, pagina };
  return { pathname, pagina };
}

export function ChatWidget() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [aberto, setAberto] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [gravando, setGravando] = React.useState(false);
  const [transcrevendo, setTranscrevendo] = React.useState(false);
  const fimRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const filaRef = React.useRef<string[]>([]);
  const drenandoRef = React.useRef(false);
  const recRef = React.useRef<unknown>(null);
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Fecha o chat ao clicar fora dele (deixa o clique navegar normalmente).
  React.useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  // Voz: grava o áudio e transcreve via Whisper (servidor, Groq) — confiável e
  // em pt-BR. Se o navegador não suportar gravação, cai no ditado Web Speech.
  function toggleVoz() {
    if (transcrevendo) return;
    if (gravando) {
      mediaRef.current?.stop();
      return;
    }
    const podeGravar =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined";
    if (!podeGravar) {
      ditadoWebSpeech();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        chunksRef.current = [];
        const rec = new MediaRecorder(stream);
        mediaRef.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = async () => {
          setGravando(false);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          const blob = new Blob(chunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          if (blob.size < 1200) return; // áudio vazio/curto demais
          setTranscrevendo(true);
          try {
            const fd = new FormData();
            const ext = (rec.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
            fd.append("file", blob, `audio.${ext}`);
            const res = await fetch("/api/transcribe", { method: "POST", body: fd });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              // Sem chave no servidor (503) → usa o ditado do navegador.
              if (res.status === 503) {
                ditadoWebSpeech();
              } else {
                alert(json.error || "Não consegui transcrever o áudio.");
              }
              return;
            }
            const t = String(json.texto ?? "").trim();
            if (t) setTexto((prev) => (prev.trim() ? prev.trim() + " " : "") + t);
            else alert("Não entendi o áudio. Tente falar mais perto do microfone.");
          } catch {
            alert("Falha ao transcrever. Verifique a conexão.");
          } finally {
            setTranscrevendo(false);
          }
        };
        setGravando(true);
        rec.start();
      })
      .catch(() => {
        alert("Permita o acesso ao microfone para usar a voz.");
      });
  }

  // Fallback: ditado por voz no navegador (Web Speech API, pt-BR).
  function ditadoWebSpeech() {
    const w = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert("Seu navegador não suporta voz. Use o Chrome ou digite a mensagem.");
      return;
    }
    if (gravando) {
      (recRef.current as { stop?: () => void } | null)?.stop?.();
      return;
    }
    const rec = new SR() as {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: (e: { error?: string }) => void;
      start: () => void;
      stop: () => void;
    };
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true; // captura fala mais longa até o usuário parar
    let base = "";
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setTexto((base ? base + " " : "") + txt);
    };
    rec.onend = () => setGravando(false);
    rec.onerror = (ev: { error?: string }) => {
      setGravando(false);
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        alert("Permita o acesso ao microfone no navegador para usar a voz.");
      } else if (ev?.error === "no-speech") {
        alert("Não ouvi nada. Tente falar mais perto do microfone.");
      }
    };
    base = texto.trim();
    recRef.current = rec;
    setGravando(true);
    rec.start();
  }

  React.useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, aberto]);

  // Carrega as últimas mensagens ao abrir.
  React.useEffect(() => {
    if (!aberto || msgs.length > 0 || !isSupabaseConfigured()) return;
    const s = createClient();
    s.from("chat_mensagens")
      .select("papel, conteudo, provedor")
      .order("criado_em", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setMsgs((data as Msg[]).reverse());
      });
  }, [aberto, msgs.length]);

  // Processa a fila de mensagens em sequência (assíncrono): o usuário pode
  // enviar várias seguidas sem esperar a resposta de cada uma.
  const drenar = React.useCallback(async () => {
    if (drenandoRef.current) return;
    drenandoRef.current = true;
    setEnviando(true);
    try {
      while (filaRef.current.length > 0) {
        const m = filaRef.current.shift() as string;
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensagem: m, contexto: contextoDaRota(pathname) }),
          });
          const json = await res.json().catch(() => ({}));
          const resposta = json.resposta ?? json.error ?? "Não consegui responder agora.";
          setMsgs((prev) => [...prev, { papel: "assistant", conteudo: resposta, provedor: json.provedor }]);
          if (json.acao) qc.invalidateQueries({ queryKey: ["jobs-recentes"] });
        } catch {
          setMsgs((prev) => [...prev, { papel: "assistant", conteudo: "Erro de conexão. Tente novamente." }]);
        }
      }
    } finally {
      drenandoRef.current = false;
      setEnviando(false);
    }
  }, [pathname, qc]);

  function enviar() {
    const m = texto.trim();
    if (!m) return;
    setTexto("");
    if (taRef.current) taRef.current.style.height = "auto";
    setMsgs((prev) => [...prev, { papel: "user", conteudo: m }]);
    filaRef.current.push(m);
    void drenar();
  }

  return (
    <div ref={containerRef} className="fixed bottom-36 right-4 z-40 flex flex-col items-end">
      {aberto && (
        <div className="mb-2 flex h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg border bg-background/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" /> Assistente / Agentes
            </p>
            <button onClick={() => setAberto(false)} aria-label="Fechar">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Converse comigo e dispare agentes de qualquer página. Ex.:{" "}
                <em>&quot;atualize os dados deste produtor e do grupo&quot;</em> ou{" "}
                <em>&quot;enriqueça este contato pela web&quot;</em>.
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.papel === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap">{m.conteudo}</p>
                {m.papel === "assistant" && m.provedor && (
                  <p className="mt-0.5 text-[10px] opacity-60">via {m.provedor}</p>
                )}
              </div>
            ))}
            {enviando && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando…
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <button
              onClick={toggleVoz}
              disabled={transcrevendo}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60",
                gravando ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-muted"
              )}
              aria-label={gravando ? "Parar gravação" : "Falar"}
              title={
                transcrevendo
                  ? "Transcrevendo…"
                  : gravando
                    ? "Gravando… toque para parar"
                    : "Falar (gravar e transcrever)"
              }
            >
              {transcrevendo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className={cn("h-4 w-4", gravando && "animate-pulse")} />
              )}
            </button>
            <textarea
              ref={taRef}
              value={texto}
              rows={1}
              onChange={(e) => {
                setTexto(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 72) + "px"; // até ~3 linhas
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder={
                transcrevendo
                  ? "Transcrevendo o áudio…"
                  : gravando
                    ? "Gravando… toque no 🎤 para parar"
                    : "Pergunte, peça uma ação ou fale 🎤"
              }
              className="max-h-[72px] min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={enviar}
              disabled={!texto.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Enviar"
              title="Enviar (Enter). Pode enviar várias seguidas — entram na fila."
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setAberto((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Abrir chat dos agentes"
      >
        <Bot className="h-6 w-6" />
      </button>
    </div>
  );
}
