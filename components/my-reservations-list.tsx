"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarDays, Clock3, MapPin } from "lucide-react";
import { cancelReservation } from "@/app/actions";
import {
  canCancelReservation,
  formatDateKey,
  formatHour,
  getSeoulTodayKey,
  getReservationStatus
} from "@/lib/date";
import { createClient } from "@/lib/supabase/client";

export type MyReservationItem = {
  id: string;
  facility_id: number;
  facility_name: string;
  reservation_date: string;
  start_time: number;
  end_time: number;
};

type MyReservationsListProps = {
  currentUserId: string;
  initialReservations: MyReservationItem[];
};

function getStatusLabel(reservation: MyReservationItem) {
  const status = getReservationStatus(
    reservation.reservation_date,
    reservation.start_time,
    reservation.end_time
  );

  if (status === "upcoming") {
    return {
      label: canCancelReservation(reservation.reservation_date, reservation.start_time)
        ? "취소 가능"
        : "예정됨",
      tone: "bg-teal-50 text-teal-800"
    };
  }

  if (status === "ongoing") {
    return { label: "진행 중", tone: "bg-amber-50 text-amber-800" };
  }

  return { label: "지난 예약", tone: "bg-zinc-100 text-zinc-600" };
}

function mapReservationRows(rows: any[]): MyReservationItem[] {
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

export function MyReservationsList({
  currentUserId,
  initialReservations
}: MyReservationsListProps) {
  const [reservations, setReservations] = useState(initialReservations);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const refreshReservations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("id,facility_id,reservation_date,start_time,end_time,facilities(name)")
      .eq("user_id", currentUserId)
      .gte("reservation_date", getSeoulTodayKey())
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (data) {
      setReservations(mapReservationRows(data));
    }
  }, [currentUserId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("my-reservation-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          void refreshReservations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshReservations]);

  const handleCancel = (reservationId: string) => {
    startTransition(async () => {
      const result = await cancelReservation({ reservationId });
      setNotice(result.message);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      await refreshReservations();
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-5 pb-4 pt-5">
        <Link
          href="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">뒤로가기</span>
        </Link>
        <div>
          <p className="text-[13px] font-medium text-teal-700">나의 예약</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-950">예약 내역</h1>
        </div>
      </header>

      <section className="flex-1 px-5 py-4">
        {notice ? (
          <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-medium text-zinc-700">
            {notice}
          </p>
        ) : null}

        <div className="space-y-3">
          {reservations.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
              아직 예약한 내역이 없습니다.
            </div>
          ) : null}

          {reservations.map((reservation) => {
            const status = getStatusLabel(reservation);
            const cancellable = canCancelReservation(
              reservation.reservation_date,
              reservation.start_time
            );

            return (
              <article
                key={reservation.id}
                className="rounded-lg border border-zinc-200 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-950">
                      {reservation.facility_name}
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays aria-hidden="true" className="h-4 w-4 text-teal-700" />
                        {formatDateKey(reservation.reservation_date)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 aria-hidden="true" className="h-4 w-4 text-teal-700" />
                        {formatHour(reservation.start_time)} - {formatHour(reservation.end_time)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">
                    예약 시작 전까지만 취소할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    disabled={!cancellable || isPending}
                    onClick={() => handleCancel(reservation.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                    <Ban aria-hidden="true" className="h-4 w-4" />
                    취소
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
