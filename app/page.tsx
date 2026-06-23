import { redirect } from "next/navigation";
import {
  getUserDisplayName,
  isAdminEmail,
  isAllowedSchoolEmail
} from "@/lib/auth";
import { getReservationRange } from "@/lib/date";
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
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAllowedSchoolEmail(user.email)) {
    redirect("/auth/sign-out?reason=domain");
  }

  const fallbackName = getUserDisplayName(user);
  const isAdmin = isAdminEmail(user.email);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,name,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        name: fallbackName
      },
      { onConflict: "id" }
    );
  }

  const { startKey, endKey } = getReservationRange();

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
      currentUserId={user.id}
      isAdmin={isAdmin}
      userName={profile?.name ?? fallbackName}
      facilities={(facilities ?? []) as Facility[]}
      initialReservations={(reservations ?? []) as Reservation[]}
    />
  );
}
