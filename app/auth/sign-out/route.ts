import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const reason = requestUrl.searchParams.get("reason");
  const supabase = await createClient();

  await supabase.auth.signOut();

  const redirectUrl = new URL("/login", request.url);

  if (reason) {
    redirectUrl.searchParams.set("error", reason);
  }

  return NextResponse.redirect(redirectUrl);
}
