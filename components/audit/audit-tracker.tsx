"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { logAcesso } from "@/lib/audit/log";

/** Registra cada navegação (rota) na auditoria. Invisível. */
export function AuditTracker() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (pathname) logAcesso(pathname);
  }, [pathname]);
  return null;
}
