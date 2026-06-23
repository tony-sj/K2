import { redirect } from "next/navigation";
import { getUserDisplayName, isAllowedSchoolEmail } from "@/lib/auth";
import { getSeoulTodayKey } from "@/lib/date";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { MyReservationsList, type MyReservationItem } from "@/components/my-reservations-list";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

type ReservationRow = {
  id: string;
  facility_id: number;
  reservation_date: string;
  start_time: number;
  end_time: number;
  facilities: { name: string } | { name: string }[] | null;
};

function mapReservations(rows: ReservationRow[]): MyReservationItem[] {
  return rows.map((row) => ({
    id: row.id,
    facility_id: row.facility_id,
    facility_name: Array.isArray(row.facilities)
      ? (row.facilities[0]?.name ?? "시설")
      : (row.facilities?.name ?? "시설"),
    reservation_date: row.reservation_date,
    start_time: row.start_time,
    end_time: row.end_time
  }));
}

export default async function MyReservationsPage() {
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

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      name: getUserDisplayName(user)
    },
    { onConflict: "id" }
  );

  const { data } = await supabase
    .from("reservations")
    .select("id,facility_id,reservation_date,start_time,end_time,facilities(name)")
    .eq("user_id", user.id)
    .gte("reservation_date", getSeoulTodayKey())
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <MyReservationsList
      currentUserId={user.id}
      initialReservations={mapReservations((data ?? []) as ReservationRow[])}
    />
  );
}
