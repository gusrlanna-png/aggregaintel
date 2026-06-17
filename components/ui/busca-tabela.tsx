"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Campo de busca padrão do app: ícone, sugestões (autocomplete nativo via
 * <datalist>) e botão de limpar. A filtragem em si é feita por quem usa —
 * normalmente concatenando todos os campos da linha e testando `includes`.
 */
export function BuscaTabela({
  value,
  onChange,
  sugestoes = [],
  placeholder = "Buscar em qualquer campo…",
  id = "busca",
}: {
  value: string;
  onChange: (v: string) => void;
  sugestoes?: string[];
  placeholder?: string;
  id?: string;
}) {
  const listId = `${id}-sugestoes`;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        list={listId}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <datalist id={listId}>
        {Array.from(new Set(sugestoes))
          .filter(Boolean)
          .slice(0, 50)
          .map((s, i) => (
            <option key={i} value={s} />
          ))}
      </datalist>
    </div>
  );
}

/** Normaliza texto p/ busca: minúsculo, sem acentos. */
export function normalizar(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Matcher único de busca do sistema: confere a query contra TODOS os campos
 * passados (texto normalizado, sem acento) e também por dígitos (CNPJ/CPF/nº).
 * Vazio = casa tudo. Use em qualquer lista: matchBusca(q, a, b, c).
 */
export function matchBusca(
  busca: string,
  ...campos: (string | number | null | undefined)[]
): boolean {
  const q = normalizar((busca ?? "").trim());
  if (!q) return true;
  const join = campos.map((c) => (c == null ? "" : String(c))).join(" ");
  if (normalizar(join).includes(q)) return true;
  const qd = (busca ?? "").replace(/\D/g, "");
  if (qd.length >= 2 && join.replace(/\D/g, "").includes(qd)) return true;
  return false;
}
