/** Mascaramento de dados pessoais (LGPD) para exibição por padrão. */
export type TipoPii = "cpf" | "cnpj" | "fone" | "email";

export function mascararPii(valor: string | null | undefined, tipo: TipoPii): string {
  const v = (valor ?? "").trim();
  if (!v) return "—";
  if (tipo === "email") {
    const [u, dom] = v.split("@");
    if (!dom) return "•••";
    const ini = u.slice(0, 1);
    return `${ini}${"•".repeat(Math.max(2, u.length - 1))}@${dom}`;
  }
  const d = v.replace(/\D/g, "");
  if (tipo === "fone") {
    if (d.length < 4) return "•".repeat(d.length || 3);
    return `${"•".repeat(d.length - 4)}${d.slice(-4)}`;
  }
  // cpf / cnpj: mostra início e fim, mascara o miolo
  if (d.length <= 4) return "•".repeat(d.length);
  const ini = d.slice(0, 3);
  const fim = d.slice(-2);
  return `${ini}${"•".repeat(Math.max(3, d.length - 5))}${fim}`;
}
