"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { getClienteById } from "@/lib/supabase/clientes";

export default function EditarClientePage() {
  const { id } = useParams<{ id: string }>();
  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-edit", id],
    queryFn: () => getClienteById(id),
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/clientes/${id}`}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Editar cliente</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cliente ? (
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      ) : (
        <ClienteForm cliente={cliente} />
      )}
    </div>
  );
}
