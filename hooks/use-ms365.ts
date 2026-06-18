"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export interface Ms365Session {
  connected: boolean;
  providerToken: string | null;
  displayName: string | null;
  email: string | null;
}

/** Retorna o estado de conexão Microsoft 365 da sessão Supabase atual. */
export function useMs365(): Ms365Session {
  const [state, setState] = React.useState<Ms365Session>({
    connected: false,
    providerToken: null,
    displayName: null,
    email: null,
  });

  React.useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      const isAzure = sess?.user?.app_metadata?.provider === "azure";
      setState({
        connected: isAzure && !!sess?.provider_token,
        providerToken: isAzure ? (sess?.provider_token ?? null) : null,
        displayName: sess?.user?.user_metadata?.full_name ?? sess?.user?.user_metadata?.name ?? null,
        email: sess?.user?.email ?? null,
      });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
