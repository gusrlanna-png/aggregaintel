"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Plus, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { IntelFeed } from "@/components/inteligencia/intel-feed";
import { NFImport } from "@/components/nf/nf-import";
import { getEmissores } from "@/lib/supabase/emissores";
import { getClientes } from "@/lib/supabase/clientes";
import { getIntel, saveIntel } from "@/lib/supabase/intel";

export default function InteligenciaPage() {
  const queryClient = useQueryClient();
  const [filtroTipo, setFiltroTipo] = React.useState("all");
  const [filtroConf, setFiltroConf] = React.useState("all");

  // Upload WhatsApp
  const [waFile, setWaFile] = React.useState<File | null>(null);
  const [waLoading, setWaLoading] = React.useState(false);
  const [waResult, setWaResult] = React.useState<string | null>(null);

  // Feed: busca, agrupamento e perguntas
  const [busca, setBusca] = React.useState("");
  const [agrupar, setAgrupar] = React.useState(false);
  const [pergunta, setPergunta] = React.useState("");
  const [resposta, setResposta] = React.useState<string | null>(null);
  const [perguntando, setPerguntando] = React.useState(false);

  // Manual
  const [tipoFonte, setTipoFonte] = React.useState("manual");
  const [classificacao, setClassificacao] = React.useState("preco");
  const [confianca, setConfianca] = React.useState("media");
  const [emissorId, setEmissorId] = React.useState<string>("none");
  const [clienteId, setClienteId] = React.useState<string>("none");
  const [dataInfo, setDataInfo] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [valorNum, setValorNum] = React.useState("");
  const [unidade, setUnidade] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const { data: emissores } = useQuery({
    queryKey: ["emissores-all"],
    queryFn: () => getEmissores(),
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-all"],
    queryFn: () => getClientes(),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["intel"],
    queryFn: () => getIntel(),
  });

  async function enviarWhatsapp() {
    if (!waFile) return;
    setWaLoading(true);
    setWaResult(null);
    try {
      const { extrairTextoDocumento } = await import(
        "@/lib/import/extrair-documento"
      );
      const { texto: conteudo, aviso } = await extrairTextoDocumento(waFile);
      if (!conteudo.trim()) {
        throw new Error(aviso ?? "Não foi possível ler o documento.");
      }
      if (aviso) toast.warning(aviso);
      const res = await fetch("/api/whatsapp/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Falha ao processar o arquivo.");
      }
      const items = Array.isArray(json.items) ? json.items : [];
      const sinteses = Array.isArray(json.sinteses) ? json.sinteses : [];

      // Sínteses por cliente (geradas pela IA) — destaque no feed
      for (const s of sinteses) {
        const pontos = Array.isArray(s.pontos) ? s.pontos : [];
        const texto = [s.resumo, ...pontos.map((p: string) => `• ${p}`)]
          .filter(Boolean)
          .join("\n");
        await saveIntel({
          tipo_fonte: "whatsapp",
          classificacao: "sintese",
          confianca: "media",
          is_sintese: true,
          cliente_nome: s.cliente_nome ?? "Geral",
          texto_extraido: texto,
          tags: ["sintese", "whatsapp"],
        });
      }

      // Itens individuais relevantes
      let inseridas = 0;
      for (const it of items) {
        await saveIntel({
          tipo_fonte: "whatsapp",
          classificacao: it.classificacao ?? "outro",
          confianca: it.confianca ?? "baixa",
          data_info: it.data_info ?? null,
          cliente_nome: it.cliente_nome ?? null,
          texto_extraido: it.texto_extraido ?? "",
          valor_num: it.valor_num ?? null,
          unidade: it.unidade ?? null,
          tags: it.tags ?? ["whatsapp"],
        });
        inseridas += 1;
      }
      await queryClient.invalidateQueries({ queryKey: ["intel"] });
      setWaResult(
        `Mensagens: ${json.total ?? "?"} · Relevantes: ${
          json.relevantes ?? items.length
        } · Sínteses: ${sinteses.length} · Itens: ${inseridas}${
          json.metodo === "heuristica" ? " (local)" : " (IA)"
        }${json.aviso ? ` — ${json.aviso}` : ""}`
      );
      toast.success(
        sinteses.length + inseridas > 0
          ? `${sinteses.length} síntese(s) e ${inseridas} item(ns) registrados.`
          : "Nenhuma informação relevante encontrada."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no processamento.");
    } finally {
      setWaLoading(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function salvarManual() {
    if (!texto.trim()) {
      toast.error("Informe o texto da informação.");
      return;
    }
    setSaving(true);
    try {
      const clienteSel = (clientes ?? []).find((c) => c.id === clienteId);
      await saveIntel({
        tipo_fonte: tipoFonte,
        emissor_id: emissorId === "none" ? null : emissorId,
        cliente_id: clienteId === "none" ? null : clienteId,
        cliente_nome: clienteSel?.razao_social ?? null,
        classificacao,
        confianca,
        data_info: dataInfo || null,
        texto_extraido: texto,
        valor_num: valorNum ? Number(valorNum) : null,
        unidade: unidade || null,
        tags,
      });
      await queryClient.invalidateQueries({ queryKey: ["intel"] });
      toast.success("Informação registrada.");
      setTexto("");
      setValorNum("");
      setUnidade("");
      setTags([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const filtrados = items.filter((i) => {
    if (filtroTipo !== "all" && i.tipo_fonte !== filtroTipo) return false;
    if (filtroConf !== "all" && i.confianca !== filtroConf) return false;
    if (busca) {
      const alvo = `${i.texto_extraido ?? ""} ${i.cliente_nome ?? ""} ${(
        i.tags ?? []
      ).join(" ")}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  async function perguntar() {
    if (!pergunta.trim()) return;
    setPerguntando(true);
    setResposta(null);
    try {
      const contexto = items
        .map((i) => {
          const quem = i.cliente_nome ? `[${i.cliente_nome}] ` : "";
          const val = i.valor_num != null ? ` (${i.valor_num} ${i.unidade ?? ""})` : "";
          return `- ${i.data_info ?? ""} ${quem}${i.texto_extraido ?? ""}${val}`;
        })
        .join("\n");
      const res = await fetch("/api/intel/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, contexto }),
      });
      const json = await res.json();
      setResposta(json.resposta ?? json.error ?? "Sem resposta.");
    } catch (e) {
      setResposta(e instanceof Error ? e.message : "Falha ao consultar.");
    } finally {
      setPerguntando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Inteligência de mercado
        </h1>
        <p className="text-sm text-muted-foreground">
          Central de entradas: NF, WhatsApp/documentos, manual e sinais de
          concorrência
        </p>
      </div>

      <Tabs defaultValue="adicionar">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="adicionar">Adicionar</TabsTrigger>
          <TabsTrigger value="nf">NF</TabsTrigger>
          <TabsTrigger value="feed">Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="adicionar" className="space-y-4">
          {/* Documentos (WhatsApp .zip/.txt, PDF, Word, Markdown…) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Importar documento (IA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept=".txt,.md,.csv,.json,.vcf,.zip,.pdf,.docx,text/plain,application/zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setWaFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Aceita conversa do WhatsApp (.txt ou .zip com mídia/contatos),
                PDF, Word (.docx), Markdown, CSV. A IA agrupa as mensagens e
                extrai preços, concorrentes, clientes e sinais de mercado.
              </p>
              <Button
                onClick={enviarWhatsapp}
                disabled={!waFile || waLoading}
                className="w-full"
              >
                {waLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Processar documento
              </Button>
              {waResult && (
                <p className="rounded-md bg-muted p-2 text-sm">{waResult}</p>
              )}
            </CardContent>
          </Card>

          {/* Manual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" /> Adicionar informação manual
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <SelField
                label="Tipo de fonte"
                value={tipoFonte}
                onChange={setTipoFonte}
                options={[
                  ["whatsapp", "WhatsApp"],
                  ["manual", "Manual"],
                  ["nf", "NF"],
                  ["anm", "ANM"],
                  ["outro", "Outro"],
                ]}
              />
              <SelField
                label="Classificação"
                value={classificacao}
                onChange={setClassificacao}
                options={[
                  ["preco", "Preço"],
                  ["volume", "Volume"],
                  ["concorrente", "Concorrente"],
                  ["cliente", "Cliente"],
                  ["alerta", "Alerta"],
                  ["outro", "Outro"],
                ]}
              />
              <SelField
                label="Confiança"
                value={confianca}
                onChange={setConfianca}
                options={[
                  ["alta", "Alta"],
                  ["media", "Média"],
                  ["baixa", "Baixa"],
                ]}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Data da informação</Label>
                <Input
                  type="date"
                  value={dataInfo}
                  onChange={(e) => setDataInfo(e.target.value)}
                />
              </div>
              <SelField
                label="Emissor relacionado"
                value={emissorId}
                onChange={setEmissorId}
                options={[
                  ["none", "—"],
                  ...((emissores ?? []).map((e) => [e.id, e.razao_social]) as [
                    string,
                    string,
                  ][]),
                ]}
              />
              <SelField
                label="Cliente relacionado"
                value={clienteId}
                onChange={setClienteId}
                options={[
                  ["none", "—"],
                  ...((clientes ?? []).map((c) => [c.id, c.razao_social]) as [
                    string,
                    string,
                  ][]),
                ]}
              />
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Texto / informação</Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Concorrente X reduziu preço da brita 1 para R$ 50/t…"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor numérico</Label>
                <Input
                  type="number"
                  value={valorNum}
                  onChange={(e) => setValorNum(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Input
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder="R$/t, t/mês…"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Digite e Enter"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                      >
                        {t} <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Button
                  onClick={salvarManual}
                  disabled={saving}
                  className="w-full"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Registrar informação
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nf" className="space-y-4">
          <NFImport mostrarTitulo={false} />
        </TabsContent>

        <TabsContent value="feed" className="space-y-3">
          {/* Perguntar à IA sobre o intel */}
          <Card>
            <CardContent className="space-y-2 p-3">
              <Label className="flex items-center gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Perguntar à IA
                sobre as informações
              </Label>
              <div className="flex gap-2">
                <Input
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  placeholder="Ex.: qual o preço da brita 1 da concorrência?"
                  onKeyDown={(e) => e.key === "Enter" && perguntar()}
                />
                <Button onClick={perguntar} disabled={perguntando}>
                  {perguntando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Perguntar"
                  )}
                </Button>
              </div>
              {resposta && (
                <p className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">
                  {resposta}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Filtros + busca */}
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no feed (texto, cliente, tags)…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SelField
              label="Tipo"
              value={filtroTipo}
              onChange={setFiltroTipo}
              options={[
                ["all", "Todos os tipos"],
                ["whatsapp", "WhatsApp"],
                ["manual", "Manual"],
                ["nf", "NF"],
                ["anm", "ANM"],
              ]}
            />
            <SelField
              label="Confiança"
              value={filtroConf}
              onChange={setFiltroConf}
              options={[
                ["all", "Todas"],
                ["alta", "Alta"],
                ["media", "Média"],
                ["baixa", "Baixa"],
              ]}
            />
            <SelField
              label="Organizar"
              value={agrupar ? "cliente" : "data"}
              onChange={(v) => setAgrupar(v === "cliente")}
              options={[
                ["data", "Por data"],
                ["cliente", "Por cliente"],
              ]}
            />
          </div>
          <IntelFeed
            items={filtrados}
            groupByCliente={agrupar}
            onChanged={() =>
              queryClient.invalidateQueries({ queryKey: ["intel"] })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SelField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
