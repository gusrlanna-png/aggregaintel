"use client";

import Link from "next/link";
import { LogOut, Mountain } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/search/global-search";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AppHeader() {
  const demo = !isSupabaseConfigured();

  async function handleLogout() {
    if (demo) {
      toast.info("Modo demonstração — configure o Supabase para autenticação.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-safe">
      <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mountain className="h-5 w-5" />
          </span>
          <span className="text-base font-bold tracking-tight">AggregaIntel</span>
        </Link>
        <div className="flex items-center gap-1">
          <GlobalSearch variant="header" />
          {demo && (
            <Badge variant="warning" className="hidden sm:inline-flex">
              Modo demonstração
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
