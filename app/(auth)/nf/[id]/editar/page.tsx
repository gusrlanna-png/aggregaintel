"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NFReviewForm } from "@/components/nf/nf-review-form";
import { getNFById } from "@/lib/supabase/nf";
import { getNFUrl } from "@/lib/supabase/storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { nfToForm } from "@/lib/utils/ocr-map";

export default function EditarNFPage() {
  const { id } = useParams<{ id: string }>();

  const { data: nf, isLoading } = useQuery({
    queryKey: ["nf-edit", id],
    queryFn: () => getNFById(id),
  });

  const { data: imgUrl } = useQuery({
    queryKey: ["nf-edit-img", nf?.arquivo_url],
    queryFn: () =>
      nf?.arquivo_url && isSupabaseConfigured()
        ? getNFUrl(nf.arquivo_url)
        : Promise.resolve(null),
    enabled: Boolean(nf?.arquivo_url),
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={id ? `/nf/${id}` : "/nf"}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="text-xl font-bold tracking-tight">Editar NF</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !nf ? (
        <p className="text-sm text-muted-foreground">NF não encontrada.</p>
      ) : (
        <NFReviewForm
          nfId={nf.id}
          emissorId={nf.emissor_id}
          clienteId={nf.cliente_id}
          initial={nfToForm(nf)}
          imageUrl={imgUrl ?? null}
          submitLabel="Salvar alterações"
        />
      )}
    </div>
  );
}
