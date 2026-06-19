"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Mail, MapPin, Phone, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPessoaTelefones,
  addPessoaTelefone,
  deletePessoaTelefone,
  getPessoaEmails,
  addPessoaEmail,
  deletePessoaEmail,
  getPessoaEnderecos,
  addPessoaEndereco,
  deletePessoaEndereco,
  getPessoaLinks,
  addPessoaLink,
  deletePessoaLink,
  atualizarPessoa,
  type PessoaTelefone,
} from "@/lib/supabase/pessoas";

// Redes sociais (ordem + cores de marca)
const REDES_ORDEM = ["linkedin", "instagram", "facebook", "youtube"] as const;
type RedeTipo = (typeof REDES_ORDEM)[number];
const REDES_META: Record<RedeTipo, { label: string; color: string; nome: string }> = {
  linkedin: { label: "in", color: "#0A66C2", nome: "LinkedIn" },
  instagram: { label: "Ig", color: "#E1306C", nome: "Instagram" },
  facebook: { label: "f", color: "#1877F2", nome: "Facebook" },
  youtube: { label: "▶", color: "#FF0000", nome: "YouTube" },
};

export function ContatoExtras({ pessoaId }: { pessoaId: string }) {
  const qc = useQueryClient();

  const { data: telefones = [] } = useQuery({
    queryKey: ["pessoa-telefones", pessoaId],
    queryFn: () => getPessoaTelefones(pessoaId),
  });
  const { data: emails = [] } = useQuery({
    queryKey: ["pessoa-emails", pessoaId],
    queryFn: () => getPessoaEmails(pessoaId),
  });
  const { data: enderecos = [] } = useQuery({
    queryKey: ["pessoa-enderecos", pessoaId],
    queryFn: () => getPessoaEnderecos(pessoaId),
  });
  const { data: redes = [] } = useQuery({
    queryKey: ["pessoa-links", pessoaId],
    queryFn: () => getPessoaLinks(pessoaId),
  });

  const inval = (k: string) => qc.invalidateQueries({ queryKey: [k, pessoaId] });

  // ── Telefones ───────────────────────────────────────────────────────────
  const [addFone, setAddFone] = React.useState(false);
  const [foneTipo, setFoneTipo] = React.useState<PessoaTelefone["tipo"]>("celular");
  const [foneNum, setFoneNum] = React.useState("");
  const [savingFone, setSavingFone] = React.useState(false);

  async function salvarFone() {
    if (!foneNum.trim()) return;
    setSavingFone(true);
    try {
      await addPessoaTelefone(pessoaId, { tipo: foneTipo, numero: foneNum.trim() });
      // 1º telefone vira o principal do cadastro (evita campo de cima vazio).
      if (telefones.length === 0) {
        await atualizarPessoa(pessoaId, { fone: foneNum.trim() });
        qc.invalidateQueries({ queryKey: ["pessoa", pessoaId] });
      }
      inval("pessoa-telefones");
      setFoneNum("");
      setAddFone(false);
      toast.success("Telefone adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar telefone.");
    } finally {
      setSavingFone(false);
    }
  }

  // ── E-mails ─────────────────────────────────────────────────────────────
  const [addEmail, setAddEmail] = React.useState(false);
  const [emailVal, setEmailVal] = React.useState("");
  const [savingEmail, setSavingEmail] = React.useState(false);

  async function salvarEmail() {
    if (!emailVal.trim()) return;
    setSavingEmail(true);
    try {
      await addPessoaEmail(pessoaId, { email: emailVal.trim() });
      if (emails.length === 0) {
        await atualizarPessoa(pessoaId, { email: emailVal.trim() });
        qc.invalidateQueries({ queryKey: ["pessoa", pessoaId] });
      }
      inval("pessoa-emails");
      setEmailVal("");
      setAddEmail(false);
      toast.success("E-mail adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar e-mail.");
    } finally {
      setSavingEmail(false);
    }
  }

  // ── Endereços ───────────────────────────────────────────────────────────
  const [addEnd, setAddEnd] = React.useState(false);
  const [endForm, setEndForm] = React.useState({
    rotulo: "",
    logradouro: "",
    numero: "",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
  });
  const [savingEnd, setSavingEnd] = React.useState(false);

  async function salvarEndereco() {
    if (!endForm.logradouro.trim() && !endForm.municipio.trim()) {
      toast.error("Informe ao menos o logradouro ou o município.");
      return;
    }
    setSavingEnd(true);
    try {
      await addPessoaEndereco(pessoaId, {
        rotulo: endForm.rotulo || null,
        logradouro: endForm.logradouro || null,
        numero: endForm.numero || null,
        bairro: endForm.bairro || null,
        municipio: endForm.municipio || null,
        uf: endForm.uf || null,
        cep: endForm.cep || null,
      });
      if (enderecos.length === 0) {
        await atualizarPessoa(pessoaId, {
          logradouro: endForm.logradouro || null,
          municipio: endForm.municipio || null,
          uf: endForm.uf || null,
          cep: endForm.cep || null,
        });
        qc.invalidateQueries({ queryKey: ["pessoa", pessoaId] });
      }
      inval("pessoa-enderecos");
      setEndForm({ rotulo: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "", cep: "" });
      setAddEnd(false);
      toast.success("Endereço adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar endereço.");
    } finally {
      setSavingEnd(false);
    }
  }

  // ── Redes sociais ───────────────────────────────────────────────────────
  const [editRede, setEditRede] = React.useState<string | null>(null);
  const [redeUrl, setRedeUrl] = React.useState("");
  const [savingRede, setSavingRede] = React.useState(false);

  function abrirRede(tipo: string) {
    const atual = redes.find((r) => r.tipo === tipo);
    setRedeUrl(atual?.url ?? "");
    setEditRede(tipo);
  }

  async function salvarRede() {
    if (!editRede) return;
    const url = redeUrl.trim();
    if (!url) {
      toast.error("Informe o link.");
      return;
    }
    setSavingRede(true);
    try {
      await addPessoaLink(pessoaId, { tipo: editRede, url });
      inval("pessoa-links");
      setEditRede(null);
      setRedeUrl("");
      toast.success("Link salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar link.");
    } finally {
      setSavingRede(false);
    }
  }

  async function removerRede(id: string) {
    try {
      await deletePessoaLink(id);
      inval("pessoa-links");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }

  const outrasRedes = redes.filter(
    (r) => !(REDES_ORDEM as readonly string[]).includes(r.tipo)
  );

  return (
    <div className="space-y-4">
      {/* Telefones */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Phone className="h-4 w-4 text-muted-foreground" /> Telefones
              {telefones.length > 0 && <Badge variant="secondary">{telefones.length}</Badge>}
            </p>
            {!addFone && (
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setAddFone(true)}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
          {telefones.length === 0 && !addFone && (
            <p className="text-xs text-muted-foreground">Nenhum telefone extra. O principal fica no cadastro acima.</p>
          )}
          {telefones.length > 0 && (
            <div className="mb-2 divide-y rounded-md border">
              {telefones.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{t.tipo}</Badge>
                  <span className="flex-1 text-sm">{t.numero}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={async () => { await deletePessoaTelefone(t.id); inval("pessoa-telefones"); }}
                    aria-label="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {addFone && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Select value={foneTipo} onValueChange={(v) => setFoneTipo(v as PessoaTelefone["tipo"])}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["celular", "fixo", "whatsapp", "comercial"] as const).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="h-8 flex-1 text-sm" placeholder="Ex: (11) 99999-9999"
                value={foneNum} onChange={(e) => setFoneNum(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarFone()} />
              <Button size="sm" className="h-8" onClick={salvarFone} disabled={savingFone}>
                {savingFone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddFone(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* E-mails */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" /> E-mails
              {emails.length > 0 && <Badge variant="secondary">{emails.length}</Badge>}
            </p>
            {!addEmail && (
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setAddEmail(true)}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
          {emails.length === 0 && !addEmail && (
            <p className="text-xs text-muted-foreground">Nenhum e-mail extra. O principal fica no cadastro acima.</p>
          )}
          {emails.length > 0 && (
            <div className="mb-2 divide-y rounded-md border">
              {emails.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 truncate text-sm">{e.email}</span>
                  {e.rotulo && <Badge variant="outline" className="shrink-0 text-[10px]">{e.rotulo}</Badge>}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={async () => { await deletePessoaEmail(e.id); inval("pessoa-emails"); }}
                    aria-label="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {addEmail && (
            <div className="flex gap-2 pt-1">
              <Input className="h-8 flex-1 text-sm" type="email" placeholder="email@exemplo.com"
                value={emailVal} onChange={(e) => setEmailVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarEmail()} />
              <Button size="sm" className="h-8" onClick={salvarEmail} disabled={savingEmail}>
                {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddEmail(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endereços */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-4 w-4 text-muted-foreground" /> Endereços
              {enderecos.length > 0 && <Badge variant="secondary">{enderecos.length}</Badge>}
            </p>
            {!addEnd && (
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setAddEnd(true)}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
          {enderecos.length === 0 && !addEnd && (
            <p className="text-xs text-muted-foreground">Nenhum endereço extra. O principal fica no cadastro acima.</p>
          )}
          {enderecos.length > 0 && (
            <div className="mb-2 divide-y rounded-md border">
              {enderecos.map((en) => (
                <div key={en.id} className="flex items-start gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {en.rotulo && <Badge variant="outline" className="mb-0.5 text-[10px]">{en.rotulo}</Badge>}
                    <p className="text-sm">
                      {[en.logradouro, en.numero].filter(Boolean).join(", ")}
                      {en.bairro ? ` — ${en.bairro}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[[en.municipio, en.uf].filter(Boolean).join("/"), en.cep].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={async () => { await deletePessoaEndereco(en.id); inval("pessoa-enderecos"); }}
                    aria-label="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {addEnd && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Input className="h-8 text-sm" placeholder="Rótulo (casa, trabalho…)"
                value={endForm.rotulo} onChange={(e) => setEndForm((f) => ({ ...f, rotulo: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="CEP"
                value={endForm.cep} onChange={(e) => setEndForm((f) => ({ ...f, cep: e.target.value }))} />
              <Input className="col-span-2 h-8 text-sm" placeholder="Logradouro"
                value={endForm.logradouro} onChange={(e) => setEndForm((f) => ({ ...f, logradouro: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="Número"
                value={endForm.numero} onChange={(e) => setEndForm((f) => ({ ...f, numero: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="Bairro"
                value={endForm.bairro} onChange={(e) => setEndForm((f) => ({ ...f, bairro: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="Município"
                value={endForm.municipio} onChange={(e) => setEndForm((f) => ({ ...f, municipio: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="UF"
                value={endForm.uf} onChange={(e) => setEndForm((f) => ({ ...f, uf: e.target.value }))} />
              <div className="col-span-2 flex gap-2">
                <Button size="sm" className="h-8" onClick={salvarEndereco} disabled={savingEnd}>
                  {savingEnd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar endereço"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddEnd(false)}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redes sociais e presença digital */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-medium">Redes sociais e presença digital</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {REDES_ORDEM.map((tipo) => {
              const link = redes.find((r) => r.tipo === tipo);
              const meta = REDES_META[tipo];
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => abrirRede(tipo)}
                  title={link ? `Editar ${meta.nome}` : `Adicionar ${meta.nome}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: link ? meta.color : "var(--muted, #e5e7eb)", color: link ? "#fff" : "#6b7280" }}
                >
                  {meta.label}
                </button>
              );
            })}
            <span className="text-xs text-muted-foreground">toque para adicionar/editar</span>
          </div>

          {editRede && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium capitalize">
                {REDES_META[editRede as RedeTipo]?.nome ?? editRede}:
              </span>
              <Input className="h-8 flex-1 text-sm" placeholder="https://…"
                value={redeUrl} onChange={(e) => setRedeUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarRede()} />
              <Button size="sm" className="h-8" onClick={salvarRede} disabled={savingRede}>
                {savingRede ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditRede(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Outros links (site, etc.) com remoção */}
          {outrasRedes.length > 0 && (
            <ul className="space-y-1">
              {outrasRedes.map((l) => (
                <li key={l.id} className="flex items-center gap-1.5 text-sm">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="capitalize text-muted-foreground">{l.tipo}:</span>
                  <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                    {l.label ?? l.url}
                  </a>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6 text-destructive"
                    onClick={() => removerRede(l.id)} aria-label="Remover">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
