"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getGruposEconomicos } from "@/lib/supabase/grupos";

export default function GruposPage() {
  const [busca, setBusca] = React.useState("");
  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["grupos-economicos"],
    queryFn: getGruposEconomicos,
  });

  const nrm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtrados = React.useMemo(() => {
    const q = nrm(busca.trim());
    return q ? grupos.filter((g) => nrm(g.nome).includes(q)) : grupos;
  }, [grupos, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Grupos econômicos</h1>
          <p className="text-sm text-muted-foreground">
            Empresas agrupadas pelo mesmo grupo econômico. Abra para ver os membros e o consolidado.
          </p>
        </div>
      </div>

      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar grupo…" />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum grupo econômico com mais de uma empresa.
            </p>
          ) : (
            <ul className="divide-y">
              {filtrados.slice(0, 500).map((g) => (
                <li key={g.nome}>
                  <Link
                    href={`/grupos/${encodeURIComponent(g.nome)}`}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{g.nome}</span>
                    <Badge variant="secondary" className="shrink-0">{g.membros} empresas</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">{filtrados.length} grupo(s)</p>
    </div>
  );
}
