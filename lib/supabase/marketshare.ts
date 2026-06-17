import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { MarketShareSnapshot } from "./types";
import { localList } from "@/lib/local/store";

export async function getMarketShare(): Promise<MarketShareSnapshot[]> {
  if (!isSupabaseConfigured()) {
    return localList<MarketShareSnapshot>("market_share_snapshot").sort((a, b) =>
      a.mes_ref < b.mes_ref ? -1 : 1
    );
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("market_share_snapshot")
    .select("*")
    .order("mes_ref");
  if (error) throw error;
  return (data ?? []) as MarketShareSnapshot[];
}
