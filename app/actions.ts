"use server";

import { revalidatePath } from "next/cache";
import { isAllowedSchoolEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CreateReservationInput = {
  facilityId: number;
  reservationDate: string;
  startTime: number;
  endTime: number;
};

type ActionResult = {
  ok: boolean;
  message: string;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateReservationInput(input: CreateReservationInput) {
  return (
    Number.isInteger(input.facilityId) &&
    input.facilityId > 0 &&
    DATE_KEY_PATTERN.test(input.reservationDate) &&
    Number.isInteger(input.startTime) &&
    Number.isInteger(input.endTime) &&
    input.startTime >= 0 &&
    input.startTime <= 23 &&
    input.endTime >= 1 &&
    input.endTime <= 24 &&
    input.startTime < input.endTime
  );
}

export async function createReservation(
  input: CreateReservationInput
): Promise<ActionResult> {
  if (!validateReservationInput(input)) {
    return { ok: false, message: "예약 시간이 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  if (!isAllowedSchoolEmail(user.email)) {
    await supabase.auth.signOut();
    return { ok: false, message: "학교 메일 계정만 예약할 수 있습니다." };
  }

  const { data: conflicts, error: conflictError } = await supabase
    .from("reservations")
    .select("id")
    .eq("facility_id", input.facilityId)
    .eq("reservation_date", input.reservationDate)
    .lt("start_time", input.endTime)
    .gt("end_time", input.startTime)
    .limit(1);

  if (conflictError) {
    return { ok: false, message: "예약 가능 여부를 확인하지 못했습니다." };
  }

  if ((conflicts?.length ?? 0) > 0) {
    return { ok: false, message: "선택한 시간에 이미 예약이 있습니다." };
  }

  const { error } = await supabase.from("reservations").insert({
    user_id: user.id,
    facility_id: input.facilityId,
    reservation_date: input.reservationDate,
    start_time: input.startTime,
    end_time: input.endTime
  });

  if (error) {
    return { ok: false, message: "예약 저장에 실패했습니다. 시간을 다시 확인해 주세요." };
  }

  revalidatePath("/");

  return { ok: true, message: "예약이 완료되었습니다." };
}
