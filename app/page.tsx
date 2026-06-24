import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getClaimsDisplayName,
  isAdminEmail,
  isAllowedSchoolEmail
} from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { ReservationApp } from "@/components/reservation-app";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

const USER_ID_HEADER = "x-k2-user-id";
const USER_EMAIL_HEADER = "x-k2-user-email";
const USER_NAME_HEADER = "x-k2-user-name";

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const requestHeaders = await headers();
  let userId = requestHeaders.get(USER_ID_HEADER);
  let email = requestHeaders.get(USER_EMAIL_HEADER) ?? "";
  let fallbackName = decodeHeaderValue(requestHeaders.get(USER_NAME_HEADER) ?? "");

  if (!userId) {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    if (claimsError || !claims?.sub) {
      redirect("/login");
    }

    userId = claims.sub;
    email = claims.email ?? "";
    fallbackName = getClaimsDisplayName(claims);
  }

  if (!isAllowedSchoolEmail(email)) {
    redirect("/auth/sign-out?reason=domain");
  }

  const isAdmin = isAdminEmail(email);

  return (
    <ReservationApp
      currentUserId={userId}
      isAdmin={isAdmin}
      userName={fallbackName || email.split("@")[0] || "사용자"}
      facilities={[]}
      initialReservations={[]}
      initialDataLoaded={false}
    />
  );
}
