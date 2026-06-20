"use client";

import Link from "next/link";
import { ArrowLeft, Merge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientesDuplicados } from "@/components/duplicados/clientes-duplicados";
import { PessoasDuplicadas } from "@/components/duplicados/pessoas-duplicadas";

export default function DuplicadosPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Merge className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cadastros duplicados</h1>
          <p className="text-sm text-muted-foreground">
            Encontre e mescle registros repetidos — clientes (mesmo CNPJ) e pessoas
            (mesmo CPF/nome) num único cadastro.
          </p>
        </div>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="pt-2">
          <ClientesDuplicados embed />
        </TabsContent>
        <TabsContent value="pessoas" className="pt-2">
          <PessoasDuplicadas embed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
