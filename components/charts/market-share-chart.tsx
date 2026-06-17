"use client";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { COR_PRIMARIA, fmtPct, fmtTon } from "@/lib/utils/agregados";

const CINZAS = ["#64748b", "#94a3b8", "#475569", "#cbd5e1", "#334155", "#7c93ad"];

export interface ShareSlice {
  name: string;
  volume: number;
  isMbv?: boolean;
}

export function MarketSharePie({ data }: { data: ShareSlice[] }) {
  if (!data.length)
    return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="volume"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell
              key={d.name}
              fill={d.isMbv ? COR_PRIMARIA : CINZAS[i % CINZAS.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtTon(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface SharePoint {
  mes: string;
  share: number;
}

export function MarketShareLine({ data }: { data: SharePoint[] }) {
  if (!data.length)
    return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="mes" fontSize={11} tickLine={false} />
        <YAxis fontSize={11} tickLine={false} unit="%" />
        <Tooltip formatter={(v) => fmtPct(Number(v))} />
        <Line
          type="monotone"
          dataKey="share"
          stroke={COR_PRIMARIA}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
