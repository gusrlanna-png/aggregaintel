"use client";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isMbvEmissor, fmtPct, fmtTon } from "@/lib/utils/agregados";
import type { Emissor } from "@/lib/supabase/types";

export interface RankingRow {
  emissor: Emissor;
  volume: number;
  ic: number;
  cfem?: number | null;
}

export function RankingProducoes({ rows }: { rows: RankingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Emissor</TableHead>
          <TableHead className="hidden sm:table-cell">Município</TableHead>
          <TableHead className="text-right">Volume est.</TableHead>
          <TableHead className="hidden text-right sm:table-cell">IC</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const isMbv = isMbvEmissor(r.emissor);
          return (
            <TableRow
              key={r.emissor.id}
              className={cn(isMbv && "bg-primary/5")}
            >
              <TableCell className="font-medium text-muted-foreground">
                {i + 1}
              </TableCell>
              <TableCell
                className={cn(
                  "font-medium",
                  isMbv && "border-l-2 border-primary pl-2 text-primary"
                )}
              >
                {r.emissor.razao_social}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {r.emissor.municipio ?? "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {fmtTon(r.volume)}
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                {r.ic ? fmtPct(r.ic) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
