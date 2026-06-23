import { redirect } from "next/navigation";
import { getUserDisplayName, isAllowedSchoolEmail } from "@/lib/auth";
import { toDateKey } from "@/lib/date";
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

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 13);

  const [{ data: facilities }, { data: reservations }] = await Promise.all([
    supabase.from("facilities").select("id,name").order("id", { ascending: true }),
    supabase
      .from("reservations")
      .select("id,user_id,facility_id,reservation_date,start_time,end_time,created_at")
      .gte("reservation_date", toDateKey(today))
      .lte("reservation_date", toDateKey(endDate))
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true })
  ]);

  return (
    <ReservationApp
      userName={profile?.name ?? fallbackName}
      facilities={(facilities ?? []) as Facility[]}
      initialReservations={(reservations ?? []) as Reservation[]}
    />
  );
}
