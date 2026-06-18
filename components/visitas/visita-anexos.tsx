"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mic,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAnexosVisita,
  addAnexoArquivo,
  addAnexoLink,
  deleteAnexoVisita,
  getAnexoUrlVisita,
  type VisitaAnexo,
} from "@/lib/supabase/visita-anexos";

function IconeTipo({ tipo }: { tipo: VisitaAnexo["tipo"] }) {
  const c = "h-4 w-4 shrink-0 text-muted-foreground";
  if (tipo === "foto") return <ImageIcon className={c} />;
  if (tipo === "video") return <Film className={c} />;
  if (tipo === "audio") return <Mic className={c} />;
  if (tipo === "link") return <Link2 className={c} />;
  return <FileText className={c} />;
}

function fmtTamanho(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function VisitaAnexos({ visitaId }: { visitaId: string }) {
  const qc = useQueryClient();
  const camRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [addLink, setAddLink] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");

  const { data: anexos = [] } = useQuery({
    queryKey: ["visita-anexos", visitaId],
    queryFn: () => getAnexosVisita(visitaId),
  });

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    try {
      for (const f of Array.from(files)) {
        await addAnexoArquivo(visitaId, f);
      }
      qc.invalidateQueries({ queryKey: ["visita-anexos", visitaId] });
      toast.success(files.length > 1 ? `${files.length} anexos enviados.` : "Anexo enviado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setEnviando(false);
      if (camRef.current) camRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function salvarLink() {
    const u = linkUrl.trim();
    if (!u) return;
    try {
      await addAnexoLink(visitaId, u.startsWith("http") ? u : `https://${u}`);
      qc.invalidateQueries({ queryKey: ["visita-anexos", visitaId] });
      setLinkUrl("");
      setAddLink(false);
      toast.success("Link adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar link.");
    }
  }

  async function abrir(a: VisitaAnexo) {
    if (a.url) {
      window.open(a.url, "_blank", "noopener");
      return;
    }
    if (a.arquivo_url) {
      const url = await getAnexoUrlVisita(a.arquivo_url);
      if (url) window.open(url, "_blank", "noopener");
      else toast.error("Não foi possível abrir o anexo.");
    }
  }

  async function remover(a: VisitaAnexo) {
    try {
      await deleteAnexoVisita(a);
      qc.invalidateQueries({ queryKey: ["visita-anexos", visitaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4" /> Anexos
          {anexos.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({anexos.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ações: tirar foto / anexar arquivo / link */}
        <div className="flex flex-wrap gap-2">
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => enviarArquivos(e.target.files)}
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => enviarArquivos(e.target.files)}
          />
          <Button size="sm" variant="outline" disabled={enviando} onClick={() => camRef.current?.click()}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Tirar foto
          </Button>
          <Button size="sm" variant="outline" disabled={enviando} onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" /> Anexar arquivo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddLink((v) => !v)}>
            <Link2 className="h-4 w-4" /> Link
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Foto, vídeo, áudio, PDF, Word, planilha, apresentação ou link. Até 100 MB por arquivo.
        </p>

        {addLink && (
          <div className="flex gap-2">
            <Input
              className="h-9 flex-1 text-sm"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvarLink()}
            />
            <Button size="sm" className="h-9" onClick={salvarLink}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setAddLink(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {anexos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {anexos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                <IconeTipo tipo={a.tipo} />
                <button
                  onClick={() => abrir(a)}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  title={a.nome ?? ""}
                >
                  {a.nome ?? a.url ?? "anexo"}
                </button>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {fmtTamanho(a.tamanho)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => remover(a)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
