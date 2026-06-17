"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmissorForm } from "@/components/concorrentes/emissor-form";

export default function NovoConcorrentePage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/concorrentes">
          <ArrowLeft className="h-4 w-4" /> Produtores
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Novo produtor</h1>
      <EmissorForm />
    </div>
  );
}
