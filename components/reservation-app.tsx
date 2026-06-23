"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Grid3X3,
  MapPin,
  UserSquare2,
  X
} from "lucide-react";
import { cancelReservation, createReservation } from "@/app/actions";
import { AdminFacilityManager } from "@/components/admin-facility-manager";
import { LogoutButton } from "@/components/logout-button";
import {
  canReserveReservation,
  formatDateKey,
  formatHour,
  getNearestReservableHour,
  getReservationDateOptions,
  getReservationMonthOptions,
  getReservationStatus,
  getSeoulTodayKey
} from "@/lib/date";
import type { Facility, Reservation } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type ReservationRange = {
  start: number;
  end: number;
};

type ReservationAppProps = {
  currentUserId: string;
  isAdmin: boolean;
  userName: string;
  facilities: Facility[];
  initialReservations: Reservation[];
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function getReservedHours(reservations: Reservation[]) {
  const hours = new Set<number>();

  reservations.forEach((reservation) => {
    for (let hour = reservation.start_time; hour < reservation.end_time; hour += 1) {
      hours.add(hour);
    }
  });

  return hours;
}

function getReservationForHour(reservations: Reservation[], hour: number) {
  return reservations.find(
    (reservation) => hour >= reservation.start_time && hour < reservation.end_time
  );
}

function getRangeFromClicks(firstHour: number, secondHour: number): ReservationRange {
  const first = Math.min(firstHour, secondHour);
  const last = Math.max(firstHour, secondHour);

  return {
    start: first,
    end: last + 1
  };
}

function hasReservedSlotInRange(range: ReservationRange, reservedHours: Set<number>) {
  for (let hour = range.start; hour < range.end; hour += 1) {
    if (reservedHours.has(hour)) {
      return true;
    }
  }

  return false;
}

export function ReservationApp({
  currentUserId,
  isAdmin,
  userName,
  facilities,
  initialReservations
}: ReservationAppProps) {
  const dates = useMemo(() => getReservationDateOptions(), []);
  const monthOptions = useMemo(() => getReservationMonthOptions(dates), [dates]);
  const todayKey = useMemo(() => getSeoulTodayKey(), []);
  const todayIndex = dates.findIndex((date) => date.value === todayKey);
  const [facilityList, setFacilityList] = useState(facilities);
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilities[0]?.id);
  const [selectedDate, setSelectedDate] = useState(
    dates[todayIndex >= 0 ? todayIndex : 0]?.value
  );
  const [reservations, setReservations] = useState(initialReservations);
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<ReservationRange | null>(null);
  const [notice, setNotice] = useState("");
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = useState(false);
  const [isCalendarSheetOpen, setIsCalendarSheetOpen] = useState(false);
  const [isMyReservationsOpen, setIsMyReservationsOpen] = useState(false);
  const todayButtonRef = useRef<HTMLButtonElement | null>(null);
  const dateButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const hourSlotRefs = useRef(new Map<number, HTMLElement>());
  const [isPending, startTransition] = useTransition();

  const selectedReservations = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        reservation.facility_id === selectedFacilityId &&
        reservation.reservation_date === selectedDate
    );
  }, [reservations, selectedDate, selectedFacilityId]);

  const reservedHours = useMemo(
    () => getReservedHours(selectedReservations),
    [selectedReservations]
  );

  const selectedFacility = facilityList.find(
    (facility) => facility.id === selectedFacilityId
  );

  const myReservations = useMemo(() => {
    return reservations
      .filter((reservation) => reservation.user_id === currentUserId)
      .map((reservation) => ({
        ...reservation,
        facilityName:
          facilityList.find((facility) => facility.id === reservation.facility_id)
            ?.name ?? "시설"
      }))
      .sort((first, second) => {
        if (first.reservation_date !== second.reservation_date) {
          return first.reservation_date.localeCompare(second.reservation_date);
        }

        return first.start_time - second.start_time;
      });
  }, [currentUserId, facilityList, reservations]);

  const refreshFacilities = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("facilities")
      .select("id,name")
      .order("id", { ascending: true });

    if (!data) {
      return;
    }

    setFacilityList(data);
    setSelectedFacilityId((current) =>
      data.some((facility) => facility.id === current) ? current : data[0]?.id
    );
  }, []);

  const refreshReservations = useCallback(async () => {
    if (!dates[0] || !dates[dates.length - 1]) {
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select(
        "id,user_id,facility_id,reservation_date,start_time,end_time,reserved_by_name,created_at"
      )
      .gte("reservation_date", dates[0].value)
      .lte("reservation_date", dates[dates.length - 1].value)
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (data) {
      setReservations(data);
    }
  }, [dates]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reservation-and-facility-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          void refreshReservations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "facilities" },
        () => {
          void refreshFacilities();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshFacilities, refreshReservations]);

  useEffect(() => {
    todayButtonRef.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "center"
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    dateButtonRefs.current.get(selectedDate)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    const targetHour = getNearestReservableHour(selectedDate);
    window.setTimeout(() => {
      hourSlotRefs.current.get(targetHour)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  }, [selectedDate]);

  const resetSelection = () => {
    setDraftStart(null);
    setSelectedRange(null);
  };

  const handleFacilityChange = (facilityId: number) => {
    setSelectedFacilityId(facilityId);
    setIsFacilitySheetOpen(false);
    resetSelection();
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setIsCalendarSheetOpen(false);
    resetSelection();
  };

  const handleHourClick = (hour: number) => {
    if (!selectedDate || !canReserveReservation(selectedDate, hour)) {
      return;
    }

    if (reservedHours.has(hour)) {
      return;
    }

    setNotice("");

    if (draftStart === null) {
      setDraftStart(hour);
      setSelectedRange(null);
      return;
    }

    const range = getRangeFromClicks(draftStart, hour);

    if (hasReservedSlotInRange(range, reservedHours)) {
      resetSelection();
      setNotice("선택한 범위에 이미 예약된 시간이 포함되어 있습니다.");
      window.alert("선택한 범위에 이미 예약된 시간이 포함되어 있습니다.");
      return;
    }

    setDraftStart(null);
    setSelectedRange(range);
  };

  const handleSubmit = () => {
    if (!selectedRange || selectedFacilityId === undefined || !selectedDate) {
      return;
    }

    if (!canReserveReservation(selectedDate, selectedRange.start)) {
      resetSelection();
      setNotice("이미 지난 시간은 예약할 수 없습니다.");
      window.alert("이미 지난 시간은 예약할 수 없습니다.");
      return;
    }

    if (hasReservedSlotInRange(selectedRange, reservedHours)) {
      resetSelection();
      setNotice("선택한 범위에 이미 예약된 시간이 포함되어 있습니다.");
      window.alert("선택한 범위에 이미 예약된 시간이 포함되어 있습니다.");
      return;
    }

    startTransition(async () => {
      const result = await createReservation({
        facilityId: selectedFacilityId,
        reservationDate: selectedDate,
        startTime: selectedRange.start,
        endTime: selectedRange.end
      });

      setNotice(result.message);

      if (!result.ok) {
        resetSelection();
        window.alert(result.message);
        await refreshReservations();
        return;
      }

      resetSelection();
      await refreshReservations();
    });
  };

  const handleCancelReservation = (reservationId: string) => {
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
      <div className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <header className="px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-[13px] font-semibold text-zinc-900">
              <span>의과대학 시설 예약</span>
              <span className="mx-2 text-zinc-300">·</span>
              <span className="truncate text-zinc-600">{userName}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMyReservationsOpen(true)}
                title="나의 예약"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
              >
                <UserSquare2 aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">나의 예약</span>
              </button>
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="px-5 pb-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
            <MapPin aria-hidden="true" className="h-4 w-4 text-teal-700" />
            시설 선택
          </div>

          <button
            type="button"
            onClick={() => setIsFacilitySheetOpen(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-left"
          >
            <p className="truncate text-sm font-semibold text-zinc-950">
              {selectedFacility?.name ?? "시설을 선택해 주세요"}
            </p>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>

          {facilityList.length === 0 ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              등록된 시설이 없습니다.
            </p>
          ) : null}
        </section>

        <section className="px-5 pb-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-teal-700" />
              날짜
            </div>
            <button
              type="button"
              onClick={() => setIsCalendarSheetOpen(true)}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-700"
            >
              <Grid3X3 aria-hidden="true" className="h-3.5 w-3.5" />
              달력
            </button>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {dates.map((date) => {
              const isSelected = date.value === selectedDate;

              return (
                <button
                  key={date.value}
                  ref={(node) => {
                    if (node) {
                      dateButtonRefs.current.set(date.value, node);
                    } else {
                      dateButtonRefs.current.delete(date.value);
                    }

                    if (date.isToday) {
                      todayButtonRef.current = node;
                    }
                  }}
                  type="button"
                  onClick={() => handleDateChange(date.value)}
                  className={[
                    "flex h-[56px] min-w-[48px] flex-col items-center justify-center rounded-lg border px-2 transition active:scale-[0.98]",
                    isSelected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  ].join(" ")}
                >
                  <span className="text-[11px] font-medium opacity-75">
                    {date.weekday}
                  </span>
                  <span className="mt-0.5 text-base font-bold">{date.day}</span>
                  <span className="text-[10px] opacity-70">
                    {date.isToday ? "오늘" : date.month}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {isAdmin ? (
        <AdminFacilityManager facilities={facilityList} onRefresh={refreshFacilities} />
      ) : null}

      <section className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <Clock3 aria-hidden="true" className="h-4 w-4 text-teal-700" />
            시간
          </div>
          <p className="truncate text-xs font-medium text-zinc-500">
            {selectedFacility?.name ?? "시설 미선택"} · {selectedDate}
          </p>
        </div>

        {notice ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-950">
            {notice}
          </p>
        ) : null}

        <div
          className="pb-28"
          onClick={() => {
            if (draftStart !== null || selectedRange !== null) {
              resetSelection();
            }
          }}
        >
          <div className="space-y-2">
            {HOURS.map((hour) => {
              const reservationForHour = getReservationForHour(selectedReservations, hour);
              const isReserved = Boolean(reservationForHour);
              const isPastSlot = selectedDate
                ? !canReserveReservation(selectedDate, hour)
                : false;
              const isMine = reservationForHour?.user_id === currentUserId;
              const isDraftStart = draftStart === hour;
              const isInRange =
                selectedRange !== null &&
                hour >= selectedRange.start &&
                hour < selectedRange.end;
              const helperText = isReserved
                ? isMine
                  ? `${reservationForHour?.reserved_by_name} · 내 예약`
                  : `${reservationForHour?.reserved_by_name} 예약`
                : isPastSlot
                  ? "지난 시간"
                : isDraftStart
                    ? "종료 시간을 선택하세요"
                    : isInRange
                      ? "연속 시간"
                      : "";
              const canCancelMine =
                isMine &&
                reservationForHour !== undefined &&
                canReserveReservation(
                  reservationForHour.reservation_date,
                  reservationForHour.start_time
                );
              const rowClassName = [
                "scroll-mt-[220px] flex min-h-[62px] w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                isReserved || isPastSlot
                  ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                  : isInRange || isDraftStart
                    ? "border-teal-700 bg-teal-50 text-teal-950 active:scale-[0.99]"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99]"
              ].join(" ");

              const slotContent = (
                <>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold">
                      {formatHour(hour)} - {formatHour(hour + 1)}
                    </p>
                    {helperText ? (
                      <p className="mt-1 truncate text-[12px] font-medium">
                        {helperText}
                      </p>
                    ) : null}
                  </div>
                  {isDraftStart || isInRange ? (
                    <span className="ml-3 shrink-0 text-xs font-semibold">
                      {isDraftStart ? "시작" : "선택됨"}
                    </span>
                  ) : null}
                </>
              );

              if (isReserved) {
                return (
                  <div
                    key={hour}
                    ref={(node) => {
                      if (node) {
                        hourSlotRefs.current.set(hour, node);
                      } else {
                        hourSlotRefs.current.delete(hour);
                      }
                    }}
                    className={rowClassName}
                  >
                    {slotContent}
                    {canCancelMine ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCancelReservation(reservationForHour.id);
                        }}
                        className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 disabled:text-zinc-300"
                        title="예약 취소"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">예약 취소</span>
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={hour}
                  ref={(node) => {
                    if (node) {
                      hourSlotRefs.current.set(hour, node);
                    } else {
                      hourSlotRefs.current.delete(hour);
                    }
                  }}
                  type="button"
                  disabled={isReserved || isPastSlot || !selectedFacility}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleHourClick(hour);
                  }}
                  className={`${rowClassName} disabled:active:scale-100`}
                >
                  {slotContent}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 border-t border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mb-3 flex min-h-5 items-center justify-between text-sm">
          <span className="font-medium text-zinc-500">선택 시간</span>
          <span className="font-bold text-zinc-950">
            {selectedRange
              ? `${formatHour(selectedRange.start)} - ${formatHour(selectedRange.end)}`
              : draftStart !== null
                ? `${formatHour(draftStart)} 시작`
                : "미선택"}
          </span>
        </div>
        <button
          type="button"
          disabled={
            !selectedRange ||
            !selectedFacility ||
            !selectedDate ||
            !canReserveReservation(selectedDate, selectedRange.start) ||
            isPending
          }
          onClick={handleSubmit}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-[15px] font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {isPending ? "예약 중" : "예약하기"}
        </button>
      </div>

      {isFacilitySheetOpen ? (
        <>
          <button
            type="button"
            aria-label="시설 선택 닫기"
            onClick={() => setIsFacilitySheetOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <section className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-[24px] bg-white px-5 pb-6 pt-5 shadow-soft">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-teal-700">시설 선택</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950">
                  예약할 공간을 고르세요
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFacilitySheetOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">닫기</span>
              </button>
            </div>

            <div className="no-scrollbar max-h-[55vh] overflow-y-auto">
              <div className="space-y-2">
                {facilityList.map((facility) => {
                  const isSelected = facility.id === selectedFacilityId;

                  return (
                    <button
                      key={facility.id}
                      type="button"
                      onClick={() => handleFacilityChange(facility.id)}
                      className={[
                        "flex h-14 w-full items-center justify-between rounded-lg border px-4 text-left",
                        isSelected
                          ? "border-teal-700 bg-teal-50 text-teal-950"
                          : "border-zinc-200 bg-white text-zinc-900"
                      ].join(" ")}
                    >
                      <span className="text-sm font-semibold">{facility.name}</span>
                      <span className="text-xs font-semibold">
                        {isSelected ? "선택됨" : "선택"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {isCalendarSheetOpen ? (
        <>
          <button
            type="button"
            aria-label="날짜 선택 닫기"
            onClick={() => setIsCalendarSheetOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <section className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-[24px] bg-white px-5 pb-6 pt-5 shadow-soft">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-teal-700">날짜 선택</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950">
                  예약 현황을 볼 날짜
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarSheetOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">닫기</span>
              </button>
            </div>

            <div className="no-scrollbar max-h-[62vh] overflow-y-auto">
              <div className="space-y-6">
                {monthOptions.map((month) => {
                  const leadingBlankCount = new Date(`${month.key}-01`).getDay();

                  return (
                    <section key={month.key}>
                      <h3 className="mb-3 text-sm font-bold text-zinc-900">
                        {month.label}
                      </h3>
                      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-400">
                        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
                          <span key={weekday}>{weekday}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: leadingBlankCount }, (_, index) => (
                          <span key={`blank-${month.key}-${index}`} className="h-10" />
                        ))}
                        {month.dates.map((date) => {
                          const isSelected = date.value === selectedDate;

                          return (
                            <button
                              key={date.value}
                              type="button"
                              onClick={() => handleDateChange(date.value)}
                              className={[
                                "h-10 rounded-lg text-sm font-semibold",
                                isSelected
                                  ? "bg-zinc-950 text-white"
                                  : date.isToday
                                    ? "bg-teal-50 text-teal-800"
                                    : "text-zinc-700 hover:bg-zinc-100"
                              ].join(" ")}
                            >
                              {date.day}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {isMyReservationsOpen ? (
        <>
          <button
            type="button"
            aria-label="나의 예약 닫기"
            onClick={() => setIsMyReservationsOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <section className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-[24px] bg-white px-5 pb-6 pt-5 shadow-soft">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-teal-700">나의 예약</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950">
                  예약 내역
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMyReservationsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">닫기</span>
              </button>
            </div>

            <div className="no-scrollbar max-h-[62vh] overflow-y-auto">
              <div className="space-y-3">
                {myReservations.length === 0 ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
                    아직 예약한 내역이 없습니다.
                  </div>
                ) : null}

                {myReservations.map((reservation) => {
                  const status = getReservationStatus(
                    reservation.reservation_date,
                    reservation.start_time,
                    reservation.end_time
                  );
                  const canCancel = canReserveReservation(
                    reservation.reservation_date,
                    reservation.start_time
                  );

                  return (
                    <article
                      key={reservation.id}
                      className="rounded-lg border border-zinc-200 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-zinc-950">
                            {reservation.facilityName}
                          </h3>
                          <p className="mt-2 text-sm font-medium text-zinc-600">
                            {formatDateKey(reservation.reservation_date)}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600">
                            {formatHour(reservation.start_time)} -{" "}
                            {formatHour(reservation.end_time)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                          {status === "upcoming"
                            ? "예정"
                            : status === "ongoing"
                              ? "진행 중"
                              : "지난 예약"}
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={!canCancel || isPending}
                          onClick={() => handleCancelReservation(reservation.id)}
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
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
