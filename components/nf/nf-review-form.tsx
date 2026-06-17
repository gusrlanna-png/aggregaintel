"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Save,
  Search,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  CnpjInput,
  CpfCnpjInput,
  MoneyInput,
  NumberInput,
} from "@/components/ui/masked-input";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { EmissorPicker } from "@/components/nf/emissor-picker";
import { cn } from "@/lib/utils";
import { saveNFFromForm } from "@/lib/utils/save-nf-from-form";
import { getEmissores } from "@/lib/supabase/emissores";
import { isValidCNPJ, onlyDigits } from "@/lib/utils/masks";
import type { Emissor } from "@/lib/supabase/types";
import {
  PRODUTO_TIPOS,
  fmtReais,
  fmtReaisDec,
  labelProduto,
  type ProdutoTipo,
} from "@/lib/utils/agregados";
import type { NFFormValues } from "@/lib/utils/ocr-map";

function Section({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border bg-card [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between p-3 font-medium">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2">
        {children}
      </div>
    </details>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        inputMode={type === "number" ? "decimal" : undefined}
      />
    </div>
  );
}

/** Rótulo + qualquer input (usado pelos campos com máscara). */
function FieldShell({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

/** Campo de dinheiro (R$ x.xxx,xx). */
function MoneyField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <FieldShell label={props.label} required={props.required}>
      <MoneyInput value={props.value} onChange={props.onChange} />
    </FieldShell>
  );
}

/** Campo numérico pt-BR (x.xxx,xx). */
function NumberField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  decimals?: number;
}) {
  return (
    <FieldShell label={props.label} required={props.required}>
      <NumberInput
        value={props.value}
        onChange={props.onChange}
        decimals={props.decimals}
      />
    </FieldShell>
  );
}

export function NFReviewForm({
  initial,
  imageUrl,
  onSaved,
  onFormChange,
  submitLabel = "Salvar NF",
  nfId,
  emissorId,
  clienteId,
}: {
  initial: NFFormValues;
  imageUrl?: string | null;
  /** Quando definido, é chamado após salvar (modo fila/lote) em vez de navegar para /nf. */
  onSaved?: () => void;
  /** Persiste as edições para fora (ex.: contexto de importação em segundo plano). */
  onFormChange?: (form: NFFormValues) => void;
  submitLabel?: string;
  /** Em modo edição: id da NF existente (chama updateNF). */
  nfId?: string;
  emissorId?: string | null;
  clienteId?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<NFFormValues>(initial);
  const [saving, setSaving] = React.useState(false);
  // Produtor vinculado (existente). null = produtor novo / a cadastrar.
  const [emissorSelId, setEmissorSelId] = React.useState<string | null>(
    emissorId ?? null
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = React.useState(false);
  // Verificação do CNPJ na Receita (existência + razão oficial).
  const [cnpjVerif, setCnpjVerif] = React.useState<{
    status: "idle" | "verificando" | "ok" | "nao_encontrado" | "erro";
    razao?: string;
  }>({ status: "idle" });
  const autoVerifRan = React.useRef(false);

  const { data: emissoresList = [] } = useQuery({
    queryKey: ["emissores-all"],
    queryFn: () => getEmissores(),
  });

  const onChangeRef = React.useRef(onFormChange);
  onChangeRef.current = onFormChange;
  React.useEffect(() => {
    onChangeRef.current?.(form);
  }, [form]);

  const set = <K extends keyof NFFormValues>(key: K, v: NFFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  // Edição manual do emissor "desvincula" o produtor (passa a tratar como novo).
  const setEmissorField = <K extends keyof NFFormValues>(
    key: K,
    v: NFFormValues[K]
  ) => {
    setEmissorSelId(null);
    if (key === "emissor_cnpj") setCnpjVerif({ status: "idle" });
    set(key, v);
  };

  // Tenta casar o emissor lido (OCR) com um produtor cadastrado (CNPJ → razão).
  React.useEffect(() => {
    if (emissorSelId || emissoresList.length === 0) return;
    const cnpj = onlyDigits(form.emissor_cnpj);
    if (cnpj.length >= 11) {
      const m = emissoresList.find((e) => onlyDigits(e.cnpj) === cnpj);
      if (m) {
        setEmissorSelId(m.id);
        return;
      }
    }
    const nome = form.emissor_razao.trim().toLowerCase();
    if (nome) {
      const m = emissoresList.find(
        (e) => e.razao_social.trim().toLowerCase() === nome
      );
      if (m) {
        setEmissorSelId(m.id);
        return;
      }
    }
    // Não há produtor cadastrado e o CNPJ está completo → valida na Receita
    // (existência + razão oficial) para completar/garantir o cadastro.
    if (cnpj.length === 14 && !autoVerifRan.current) {
      autoVerifRan.current = true;
      void verificarCnpjReceita();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emissoresList]);

  const emissorSel = emissoresList.find((e) => e.id === emissorSelId) ?? null;

  function vincularEmissor(e: Emissor) {
    setEmissorSelId(e.id);
    setForm((f) => ({
      ...f,
      emissor_razao: e.razao_social,
      emissor_cnpj: e.cnpj || "",
      emissor_municipio: e.municipio || f.emissor_municipio,
      emissor_uf: e.uf || f.emissor_uf,
    }));
  }

  // Verifica o CNPJ na Receita (BrasilAPI): confirma a EXISTÊNCIA e traz a razão
  // social oficial (autocompleta). Distingue "não encontrado" (404) de erro de rede.
  async function verificarCnpjReceita(): Promise<
    "ok" | "nao_encontrado" | "erro" | "invalido"
  > {
    const d = onlyDigits(form.emissor_cnpj);
    if (d.length !== 14 || !isValidCNPJ(d)) {
      setCnpjVerif({ status: "idle" });
      return "invalido";
    }
    setCnpjVerif({ status: "verificando" });
    try {
      const res = await fetch(`/api/cnpj/${d}`);
      if (res.status === 404) {
        setCnpjVerif({ status: "nao_encontrado" });
        return "nao_encontrado";
      }
      if (!res.ok) {
        // Falha transitória (502/500) — não reprova o CNPJ.
        setCnpjVerif({ status: "erro" });
        return "erro";
      }
      const c = await res.json();
      const razao = (c.razao_social as string | undefined) ?? undefined;
      setCnpjVerif({ status: "ok", razao });
      setForm((f) => ({
        ...f,
        emissor_razao: razao || f.emissor_razao,
        emissor_municipio: c.municipio || f.emissor_municipio,
        emissor_uf: c.uf || f.emissor_uf,
      }));
      return "ok";
    } catch {
      setCnpjVerif({ status: "erro" });
      return "erro";
    }
  }

  async function buscarReceitaEmissor() {
    if (onlyDigits(form.emissor_cnpj).length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const s = await verificarCnpjReceita();
      if (s === "ok") toast.success("CNPJ verificado na Receita.");
      else if (s === "nao_encontrado")
        toast.error("CNPJ não encontrado na Receita.");
      else if (s === "invalido")
        toast.error("CNPJ inválido (dígito verificador).");
      else toast.error("Falha ao consultar o CNPJ (rede). Tente de novo.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  const cnpjValido = isValidCNPJ(form.emissor_cnpj);
  // Produtor OK: vinculado a um cadastrado, OU novo com razão + CNPJ válido que
  // NÃO foi reprovado na Receita (não encontrado bloqueia o cadastro).
  const produtorOk =
    Boolean(emissorSelId) ||
    (form.emissor_razao.trim().length > 0 &&
      cnpjValido &&
      cnpjVerif.status !== "nao_encontrado");

  const conf = Math.round((form.ocr_confianca ?? 0) * 100);

  // Validação de preço: valor_total / peso deve bater com o valor unitário.
  const qtd = Number(form.quantidade_ton) || 0;
  const total = Number(form.valor_total) || 0;
  const unit = Number(form.valor_unitario) || 0;
  const precoCalc = qtd > 0 && total > 0 ? total / qtd : 0;
  const divergePreco =
    unit > 0 && precoCalc > 0 && Math.abs(unit - precoCalc) / precoCalc > 0.05;

  // R$/t/km
  const frete = Number(form.frete_valor) || 0;
  const dist = Number(form.distancia_km) || 0;
  const rsTonKm = frete > 0 && qtd > 0 && dist > 0 ? frete / (qtd * dist) : 0;

  async function handleSave() {
    if (!produtorOk) {
      toast.error(
        "Produtor não cadastrado: selecione um produtor existente ou informe CNPJ válido + razão social."
      );
      return;
    }
    // Ao CRIAR um produtor novo (sem vínculo), confirma o CNPJ na Receita.
    if (!emissorSelId && !emissorId) {
      if (!cnpjValido) {
        toast.error("CNPJ inválido — confira o número.");
        return;
      }
      let st: string = cnpjVerif.status;
      if (st !== "ok" && st !== "nao_encontrado") {
        st = await verificarCnpjReceita();
      }
      if (st === "nao_encontrado" || st === "invalido") {
        toast.error(
          "CNPJ não encontrado na Receita — não é possível cadastrar este produtor. Confira o número lido na nota."
        );
        return;
      }
    }
    setSaving(true);
    try {
      const r = await saveNFFromForm(form, {
        nfId,
        emissorId: emissorSelId ?? emissorId,
        clienteId,
      });
      if (r.status === "invalid") {
        toast.error(r.message ?? "Dados incompletos.");
        return;
      }
      if (r.status === "duplicate") {
        toast.error(`${r.message}. Duplicidade não permitida.`);
        return;
      }
      if (r.status === "error") {
        toast.error(r.message ?? "Erro ao salvar.");
        return;
      }
      toast.success(r.status === "updated" ? "NF atualizada." : "NF salva.");
      if (onSaved) {
        onSaved();
      } else {
        router.push("/nf");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Revisão da NF</h2>
          {form.ocr_confianca > 0 && (
            <Badge variant={conf >= 85 ? "success" : "warning"}>
              OCR {conf}%
            </Badge>
          )}
        </div>

        <Section title="Nota fiscal" defaultOpen>
          <Field
            label="Número da NF"
            value={form.numero_nf}
            onChange={(v) => set("numero_nf", v)}
            type="number"
            required
          />
          <Field
            label="Série"
            value={form.serie}
            onChange={(v) => set("serie", v)}
          />
          <Field
            label="Data de emissão"
            value={form.data_emissao}
            onChange={(v) => set("data_emissao", v)}
            type="date"
            required
          />
          <Field
            label="Hora de saída"
            value={form.hora_saida}
            onChange={(v) => set("hora_saida", v)}
            type="time"
          />
          <Field label="CFOP" value={form.cfop} onChange={(v) => set("cfop", v)} />
          <Field
            label="Natureza da operação"
            value={form.natureza_op}
            onChange={(v) => set("natureza_op", v)}
          />
          <div className="sm:col-span-2">
            <Field
              label="Chave de acesso"
              value={form.chave_acesso}
              onChange={(v) => set("chave_acesso", v)}
            />
          </div>
        </Section>

        <Section title="Emissor (produtor / fornecedor)" defaultOpen>
          <div className="sm:col-span-2">
            {emissorSel ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      Vinculado a {emissorSel.razao_social}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      produtor já cadastrado
                    </span>
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmissorSelId(null)}
                >
                  <Unlink className="h-4 w-4" /> Desvincular
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Produtor novo / não vinculado
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                >
                  <Building2 className="h-4 w-4" /> Selecionar cadastrado
                </Button>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Razão social"
              value={form.emissor_razao}
              onChange={(v) => setEmissorField("emissor_razao", v)}
              required
            />
          </div>

          <FieldShell label="CNPJ" required>
            <div className="flex gap-2">
              <CnpjInput
                value={form.emissor_cnpj}
                onChange={(v) => setEmissorField("emissor_cnpj", v)}
                onBlur={() => {
                  if (
                    !emissorSelId &&
                    onlyDigits(form.emissor_cnpj).length === 14
                  )
                    void verificarCnpjReceita();
                }}
                className={cn(
                  !emissorSelId &&
                    form.emissor_cnpj &&
                    (!cnpjValido || cnpjVerif.status === "nao_encontrado") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={buscarReceitaEmissor}
                disabled={buscandoCnpj}
                title="Verificar e completar dados na Receita (BrasilAPI)"
              >
                {buscandoCnpj || cnpjVerif.status === "verificando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!emissorSelId && form.emissor_cnpj && !cnpjValido && (
              <p className="text-xs text-destructive">
                CNPJ inválido (dígito verificador).
              </p>
            )}
            {!emissorSelId && cnpjValido && cnpjVerif.status === "verificando" && (
              <p className="text-xs text-muted-foreground">
                Verificando na Receita…
              </p>
            )}
            {!emissorSelId && cnpjVerif.status === "ok" && (
              <p className="text-xs text-emerald-600">
                ✓ Verificado: {cnpjVerif.razao ?? "CNPJ válido na Receita"}
              </p>
            )}
            {!emissorSelId && cnpjVerif.status === "nao_encontrado" && (
              <p className="text-xs text-destructive">
                CNPJ não encontrado na Receita — confira o número (não será
                cadastrado).
              </p>
            )}
            {!emissorSelId && !form.emissor_cnpj && (
              <p className="text-xs text-amber-600">
                CNPJ não identificado — informe para cadastrar o produtor.
              </p>
            )}
          </FieldShell>

          <Field
            label="Município"
            value={form.emissor_municipio}
            onChange={(v) => set("emissor_municipio", v)}
          />
          <Field
            label="UF"
            value={form.emissor_uf}
            onChange={(v) => set("emissor_uf", v)}
          />
        </Section>

        <EmissorPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={vincularEmissor}
        />

        <Section title="Destinatário (cliente)">
          <div className="sm:col-span-2">
            <Field
              label="Nome / razão social"
              value={form.cliente_nome}
              onChange={(v) => set("cliente_nome", v)}
            />
          </div>
          <FieldShell label="CNPJ / CPF">
            <CpfCnpjInput
              value={form.cliente_doc}
              onChange={(v) => set("cliente_doc", v)}
            />
          </FieldShell>
          <Field
            label="Município"
            value={form.cliente_municipio}
            onChange={(v) => set("cliente_municipio", v)}
          />
        </Section>

        <Section title="Produto" defaultOpen>
          <div className="sm:col-span-2">
            <Field
              label="Descrição"
              value={form.produto_desc}
              onChange={(v) => set("produto_desc", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Tipo de produto <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.produto_tipo || undefined}
              onValueChange={(v) => set("produto_tipo", v as ProdutoTipo)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PRODUTO_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {labelProduto(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="NCM"
            value={form.produto_ncm}
            onChange={(v) => set("produto_ncm", v)}
          />
          <NumberField
            label="Quantidade (t)"
            value={form.quantidade_ton}
            onChange={(v) => set("quantidade_ton", v)}
            required
          />
          <MoneyField
            label="Valor unitário (R$)"
            value={form.valor_unitario}
            onChange={(v) => set("valor_unitario", v)}
          />
          <MoneyField
            label="Valor total (R$)"
            value={form.valor_total}
            onChange={(v) => set("valor_total", v)}
          />
          {precoCalc > 0 && (
            <div
              className={`sm:col-span-2 rounded-md p-2 text-xs ${
                divergePreco
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Preço calculado (total ÷ peso): {fmtReais(precoCalc)}/t
              {divergePreco
                ? ` — diverge do valor unitário (${fmtReais(unit)}/t). Verifique.`
                : " — confere com o valor unitário."}
            </div>
          )}
        </Section>

        <Section title="Impostos">
          <MoneyField
            label="ICMS valor (R$)"
            value={form.icms_valor}
            onChange={(v) => set("icms_valor", v)}
          />
          <Field
            label="ICMS fundamento"
            value={form.icms_fundamento}
            onChange={(v) => set("icms_fundamento", v)}
          />
        </Section>

        <Section title="Transporte / Frete">
          <Field
            label="Frete por conta (CIF=emitente / FOB=destinatário)"
            value={form.frete_por_conta}
            onChange={(v) => set("frete_por_conta", v)}
            placeholder="emitente / destinatario"
          />
          <MoneyField
            label="Valor do frete (R$)"
            value={form.frete_valor}
            onChange={(v) => set("frete_valor", v)}
          />
          <NumberField
            label="Distância (km)"
            value={form.distancia_km}
            onChange={(v) => set("distancia_km", v)}
            decimals={0}
          />
          {rsTonKm > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">R$/t/km</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium tabular-nums">
                {fmtReaisDec(rsTonKm)}
              </div>
            </div>
          )}
          <Field
            label="Transportador"
            value={form.transportador}
            onChange={(v) => set("transportador", v)}
          />
          <Field
            label="Placa do veículo"
            value={form.placa_veiculo}
            onChange={(v) => set("placa_veiculo", v)}
          />
          <Field
            label="UF do veículo"
            value={form.uf_veiculo}
            onChange={(v) => set("uf_veiculo", v)}
          />
          <NumberField
            label="Peso bruto (t)"
            value={form.peso_bruto}
            onChange={(v) => set("peso_bruto", v)}
          />
          <NumberField
            label="Peso líquido (t)"
            value={form.peso_liquido}
            onChange={(v) => set("peso_liquido", v)}
          />
          <Field
            label="Espécie da carga"
            value={form.especie_carga}
            onChange={(v) => set("especie_carga", v)}
            placeholder="granel / carga"
          />
        </Section>

        <div className="space-y-1.5">
          <Label className="text-xs">Dados adicionais</Label>
          <Textarea
            value={form.dados_adicionais}
            onChange={(e) => set("dados_adicionais", e.target.value)}
            rows={3}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>

      {imageUrl && (
        <div className="order-first lg:order-last">
          <div className="sticky top-20">
            <ZoomableImage src={imageUrl} alt="NF capturada" />
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Toque na imagem para ampliar e conferir os dados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
