"use server";

import { revalidatePath } from "next/cache";
import {
  getUserDisplayName,
  isAdminEmail,
  isAllowedSchoolEmail
} from "@/lib/auth";
import { canCancelReservation, canReserveReservation } from "@/lib/date";
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

type DeleteFacilityInput = {
  facilityId: number;
};

type CreateFacilityInput = {
  name: string;
};

type CancelReservationInput = {
  reservationId: string;
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

async function getAuthorizedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, message: "로그인이 필요합니다." };
  }

  if (!isAllowedSchoolEmail(user.email)) {
    await supabase.auth.signOut();
    return {
      supabase,
      user: null,
      message: "학교 메일 계정만 사용할 수 있습니다."
    };
  }

  return { supabase, user, message: null };
}

export async function createReservation(
  input: CreateReservationInput
): Promise<ActionResult> {
  if (!validateReservationInput(input)) {
    return { ok: false, message: "예약 시간이 올바르지 않습니다." };
  }

  const { supabase, user, message } = await getAuthorizedUser();

  if (!user) {
    return { ok: false, message: message ?? "로그인이 필요합니다." };
  }

  if (!canReserveReservation(input.reservationDate, input.startTime)) {
    return { ok: false, message: "이미 지난 시간은 예약할 수 없습니다." };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const reservedByName = profile?.name?.trim() || getUserDisplayName(user);

  const { error } = await supabase.from("reservations").insert({
    user_id: user.id,
    facility_id: input.facilityId,
    reservation_date: input.reservationDate,
    start_time: input.startTime,
    end_time: input.endTime,
    reserved_by_name: reservedByName
  });

  if (error) {
    return { ok: false, message: "예약 저장에 실패했습니다. 시간을 다시 확인해 주세요." };
  }

  revalidatePath("/");
  revalidatePath("/my-reservations");

  return { ok: true, message: "예약이 완료되었습니다." };
}

export async function createFacility(
  input: CreateFacilityInput
): Promise<ActionResult> {
  const { supabase, user, message } = await getAuthorizedUser();

  if (!user) {
    return { ok: false, message: message ?? "로그인이 필요합니다." };
  }

  if (!isAdminEmail(user.email)) {
    return { ok: false, message: "시설 관리는 관리자만 가능합니다." };
  }

  const name = input.name.replace(/\s+/g, " ").trim();

  if (name.length < 2 || name.length > 30) {
    return { ok: false, message: "시설명은 2자 이상 30자 이하로 입력해 주세요." };
  }

  const { error } = await supabase.from("facilities").insert({ name });

  if (error) {
    return { ok: false, message: "시설 추가에 실패했습니다. 중복 여부를 확인해 주세요." };
  }

  revalidatePath("/");

  return { ok: true, message: "시설이 추가되었습니다." };
}

export async function deleteFacility(
  input: DeleteFacilityInput
): Promise<ActionResult> {
  const { supabase, user, message } = await getAuthorizedUser();

  if (!user) {
    return { ok: false, message: message ?? "로그인이 필요합니다." };
  }

  if (!isAdminEmail(user.email)) {
    return { ok: false, message: "시설 관리는 관리자만 가능합니다." };
  }

  const { count, error: countError } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("facility_id", input.facilityId);

  if (countError) {
    return { ok: false, message: "시설 삭제 가능 여부를 확인하지 못했습니다." };
  }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "예약 이력이 있는 시설은 삭제할 수 없습니다."
    };
  }

  const { error } = await supabase
    .from("facilities")
    .delete()
    .eq("id", input.facilityId);

  if (error) {
    return { ok: false, message: "시설 삭제에 실패했습니다." };
  }

  revalidatePath("/");

  return { ok: true, message: "시설이 삭제되었습니다." };
}

export async function cancelReservation(
  input: CancelReservationInput
): Promise<ActionResult> {
  const { supabase, user, message } = await getAuthorizedUser();

  if (!user) {
    return { ok: false, message: message ?? "로그인이 필요합니다." };
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id,user_id,reservation_date,start_time")
    .eq("id", input.reservationId)
    .maybeSingle();

  if (reservationError || !reservation) {
    return { ok: false, message: "예약 정보를 찾을 수 없습니다." };
  }

  if (reservation.user_id !== user.id) {
    return { ok: false, message: "본인 예약만 취소할 수 있습니다." };
  }

  if (!canCancelReservation(reservation.reservation_date, reservation.start_time)) {
    return { ok: false, message: "시작 시간이 지난 예약은 취소할 수 없습니다." };
  }

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", input.reservationId);

  if (error) {
    return { ok: false, message: "예약 취소에 실패했습니다." };
  }

  revalidatePath("/");
  revalidatePath("/my-reservations");

  return { ok: true, message: "예약이 취소되었습니다." };
}
