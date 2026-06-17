"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClienteForm } from "@/components/clientes/cliente-form";

export default function NovoClientePage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/clientes">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Novo cliente</h1>
      <ClienteForm />
    </div>
  );
}
