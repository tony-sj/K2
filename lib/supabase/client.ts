"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseKey } = requireSupabaseEnv();

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
