"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, Mountain } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const demo = !isSupabaseConfigured();

  function destino() {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "/dashboard";
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      window.location.href = "/dashboard";
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.href = destino();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "E-mail ou senha inválidos."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleMicrosoft() {
    if (demo) {
      window.location.href = "/dashboard";
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email profile openid offline_access User.Read",
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao conectar com Microsoft."
      );
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (demo) {
      window.location.href = "/dashboard";
      return;
    }
    if (!email) {
      toast.error("Informe o e-mail para receber o link.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Link de acesso enviado para o seu e-mail.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o link."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mountain className="h-8 w-8" />
          </span>
          <CardTitle className="text-2xl">AggregaIntel</CardTitle>
          <CardDescription>
            Inteligência de mercado para agregados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demo ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                O backend (Supabase) ainda não foi configurado. Você pode
                explorar o app em <strong>modo demonstração</strong> com dados
                de exemplo.
              </p>
              <Button className="w-full" onClick={() => (window.location.href = "/dashboard")}>
                Entrar (demonstração)
              </Button>
            </div>
          ) : sent ? (
            <div className="space-y-2 text-center">
              <p className="text-sm">
                Enviamos um <strong>link mágico</strong> para{" "}
                <strong>{email}</strong>. Abra-o neste dispositivo para entrar.
              </p>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSent(false)}
              >
                Usar outro e-mail
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="voce@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Entrar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={loading}
                onClick={handleMagicLink}
              >
                Entrar por link mágico
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loading}
                onClick={handleMicrosoft}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Entrar com Microsoft 365
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
