"use client";

/** Identificador estável do dispositivo (gerado e guardado no navegador). */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("aggrega_device_id");
    if (!id) {
      id =
        (crypto?.randomUUID?.() as string) ||
        `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("aggrega_device_id", id);
    }
    return id;
  } catch {
    return "";
  }
}
