import { NextResponse, type NextRequest } from "next/server";
import { getUserDisplayName, isAllowedSchoolEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(request: NextRequest, error: string, detail?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);

  if (detail) {
    url.searchParams.set("detail", detail.slice(0, 240));
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error") ??
    requestUrl.searchParams.get("error_code");

  if (oauthError) {
    console.error("OAuth provider returned an error", oauthError);
    return loginRedirect(request, "oauth", oauthError);
  }

  if (!code) {
    console.error("OAuth callback did not include an authorization code");
    return loginRedirect(request, "missing_code");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Failed to exchange OAuth code for session", error?.message);
    return loginRedirect(request, "exchange", error?.message);
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
