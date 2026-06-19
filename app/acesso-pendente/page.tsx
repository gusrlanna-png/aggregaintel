"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function AcessoPendentePage() {
  const router = useRouter();
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    const s = createClient();
    s.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function sair() {
    const s = createClient();
    await s.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Clock className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Acesso aguardando aprovação</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu acesso{email ? ` (${email})` : ""} foi registrado e está
              aguardando a liberação de um administrador, que definirá o seu
              perfil de uso. Você será avisado quando for aprovado.
            </p>
          </div>
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Dica: para acesso corporativo, entre sempre com{" "}
            <strong>Microsoft 365</strong>.
          </p>
          <Button variant="outline" className="w-full" onClick={sair}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
