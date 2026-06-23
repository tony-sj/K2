import { NextResponse, type NextRequest } from "next/server";
import { getUserDisplayName, isAllowedSchoolEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const email = data.user.email ?? "";

  if (!isAllowedSchoolEmail(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=domain", request.url));
  }

  const name = getUserDisplayName(data.user);

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      email,
      name
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=profile", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
