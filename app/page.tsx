import { redirect } from "next/navigation";
import {
  getClaimsDisplayName,
  isAdminEmail,
  isAllowedSchoolEmail
} from "@/lib/auth";
import { getReservationQueryRange } from "@/lib/date";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Facility, Reservation } from "@/lib/database.types";
import { ReservationApp } from "@/components/reservation-app";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    redirect("/login");
  }

  const email = claims.email ?? "";

  if (!isAllowedSchoolEmail(email)) {
    redirect("/auth/sign-out?reason=domain");
  }

  const fallbackName = getClaimsDisplayName(claims);
  const isAdmin = isAdminEmail(email);

  const { startKey, endKey } = getReservationQueryRange();

  const [{ data: facilities }, { data: reservations }] = await Promise.all([
    supabase.from("facilities").select("id,name").order("id", { ascending: true }),
    supabase
      .from("reservations")
      .select(
        "id,user_id,facility_id,reservation_date,start_time,end_time,reserved_by_name,created_at"
      )
      .gte("reservation_date", startKey)
      .lte("reservation_date", endKey)
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true })
  ]);

  return (
    <ReservationApp
      currentUserId={claims.sub}
      isAdmin={isAdmin}
      userName={fallbackName}
      facilities={(facilities ?? []) as Facility[]}
      initialReservations={(reservations ?? []) as Reservation[]}
    />
  );
}
