"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmissorForm } from "@/components/concorrentes/emissor-form";
import { getEmissorById } from "@/lib/supabase/emissores";

export default function EditarConcorrentePage() {
  const { id } = useParams<{ id: string }>();
  const { data: emissor, isLoading } = useQuery({
    queryKey: ["emissor-edit", id],
    queryFn: () => getEmissorById(id),
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concorrentes/${id}`}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Editar produtor</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !emissor ? (
        <p className="text-sm text-muted-foreground">Produtor não encontrado.</p>
      ) : (
        <EmissorForm emissor={emissor} />
      )}
    </div>
  );
}
