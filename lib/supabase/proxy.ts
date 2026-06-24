import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClaimsDisplayName } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

const USER_ID_HEADER = "x-k2-user-id";
const USER_EMAIL_HEADER = "x-k2-user-email";
const USER_NAME_HEADER = "x-k2-user-name";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(USER_ID_HEADER);
  requestHeaders.delete(USER_EMAIL_HEADER);
  requestHeaders.delete(USER_NAME_HEADER);

  const cookiesToApply: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const createResponse = () => {
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    cookiesToApply.forEach(({ name, value, options }) => {
      nextResponse.cookies.set(name, value, options);
    });

    return nextResponse;
  };

  let response = createResponse();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToApply.push(...cookiesToSet);
        response = createResponse();
      }
    }
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims?.sub) {
    requestHeaders.set(USER_ID_HEADER, claims.sub);
    requestHeaders.set(USER_EMAIL_HEADER, claims.email ?? "");
    requestHeaders.set(
      USER_NAME_HEADER,
      encodeURIComponent(getClaimsDisplayName(claims))
    );
    response = createResponse();
  }

  return response;
}
