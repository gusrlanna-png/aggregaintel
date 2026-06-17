"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  maskCNPJ,
  maskCpfCnpj,
  maskMoney,
  moneyDisplay,
  numberDisplay,
  onlyDigits,
  parseNumberBR,
} from "@/lib/utils/masks";

type BaseProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
>;

/**
 * Campo de CNPJ: exibe com máscara (xx.xxx.xxx/xxxx-xx) e devolve em `onChange`
 * apenas os dígitos (até 14). O `value` pode chegar com ou sem máscara.
 */
export function CnpjInput({
  value,
  onChange,
  ...props
}: BaseProps & { value: string; onChange: (digits: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={maskCNPJ(value)}
      placeholder={props.placeholder ?? "00.000.000/0000-00"}
      onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 14))}
    />
  );
}

/** Campo de CPF/CNPJ: máscara automática conforme o tamanho; devolve dígitos. */
export function CpfCnpjInput({
  value,
  onChange,
  ...props
}: BaseProps & { value: string; onChange: (digits: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={maskCpfCnpj(value)}
      placeholder={props.placeholder ?? "CPF ou CNPJ"}
      onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 14))}
    />
  );
}

/**
 * Campo de dinheiro estilo calculadora: digita-se os números e a máscara
 * "R$ x.xxx,xx" é aplicada da direita (centavos). `onChange` devolve string
 * com ponto decimal ("1234.56"), compatível com Number().
 */
export function MoneyInput({
  value,
  onChange,
  ...props
}: BaseProps & { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="decimal"
      value={moneyDisplay(value)}
      placeholder={props.placeholder ?? "R$ 0,00"}
      onChange={(e) => onChange(maskMoney(e.target.value).value)}
    />
  );
}

/**
 * Campo numérico pt-BR ("x.xxx,xx"): permite digitar livremente; ao sair do
 * campo formata com ponto de milhar e vírgula decimal. `onChange` devolve
 * string com ponto decimal ("1234.56"). `decimals` controla as casas exibidas.
 */
export function NumberInput({
  value,
  onChange,
  decimals = 3,
  ...props
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
}) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState("");

  // Enquanto edita, mostra o texto cru; fora de foco, mostra formatado.
  const display = editing ? raw : numberDisplay(value, decimals);

  return (
    <Input
      {...props}
      inputMode="decimal"
      value={display}
      placeholder={props.placeholder ?? "0,00"}
      onFocus={(e) => {
        setEditing(true);
        // começa a edição com o valor atual em formato pt-BR (vírgula decimal)
        setRaw(value ? String(value).replace(".", ",") : "");
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parseNumberBR(e.target.value));
      }}
      onBlur={(e) => {
        setEditing(false);
        onChange(parseNumberBR(e.target.value));
        props.onBlur?.(e);
      }}
    />
  );
}
