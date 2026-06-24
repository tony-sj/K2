"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseKey } = requireSupabaseEnv();

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseKey);

  return browserClient;
}
