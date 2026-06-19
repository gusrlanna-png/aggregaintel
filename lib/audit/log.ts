"use client";

import { getDeviceId } from "./device";

interface Payload {
  tipo: "acesso" | "acao";
  recurso?: string;
  acao?: string;
  detalhe?: unknown;
}

function enviar(p: Payload) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ ...p, device_id: getDeviceId() });
    const url = "/api/auditoria/ping";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* auditoria nunca quebra a navegação */
  }
}

/** Registra acesso a uma página/rota. */
export function logAcesso(recurso: string) {
  enviar({ tipo: "acesso", recurso });
}

/** Registra uma ação sensível (ex.: revelar_pii, exportar, mesclar, disparar). */
export function logAcao(acao: string, recurso?: string, detalhe?: unknown) {
  enviar({ tipo: "acao", acao, recurso, detalhe });
}
