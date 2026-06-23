const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SEOUL_TIME_ZONE = "Asia/Seoul";
export const RESERVATION_HISTORY_START_DATE = "2026-01-01";
export const RESERVATION_FUTURE_DAYS = 14;

export type DateOption = {
  value: string;
  weekday: string;
  day: string;
  month: string;
  year: string;
  isToday: boolean;
};

export type MonthOption = {
  key: string;
  label: string;
  dates: DateOption[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedDateParts(date: Date, timeZone = SEOUL_TIME_ZONE): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute")
  };
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getSeoulToday() {
  const { year, month, day } = getZonedDateParts(new Date());
  return new Date(year, month - 1, day);
}

export function getSeoulTodayKey() {
  const { year, month, day } = getZonedDateParts(new Date());
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateOption(date: Date, todayKey: string): DateOption {
  return {
    value: toDateKey(date),
    weekday: KOREAN_WEEKDAYS[date.getDay()],
    day: String(date.getDate()),
    month: `${date.getMonth() + 1}월`,
    year: String(date.getFullYear()),
    isToday: toDateKey(date) === todayKey
  };
}

export function getDateOptions(days = RESERVATION_FUTURE_DAYS): DateOption[] {
  const today = getSeoulToday();
  const todayKey = toDateKey(today);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() + index);

    return toDateOption(date, todayKey);
  });
}

export function getReservationRange() {
  const startDate = parseDateKey(RESERVATION_HISTORY_START_DATE);
  const endDate = getSeoulToday();
  endDate.setDate(endDate.getDate() + RESERVATION_FUTURE_DAYS);

  return {
    startDate,
    endDate,
    startKey: toDateKey(startDate),
    endKey: toDateKey(endDate)
  };
}

export function getReservationDateOptions(): DateOption[] {
  const { startDate, endDate } = getReservationRange();
  const todayKey = getSeoulTodayKey();
  const dates: DateOption[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(toDateOption(cursor, todayKey));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getReservationMonthOptions(dateOptions: DateOption[]) {
  return dateOptions.reduce<MonthOption[]>((months, date) => {
    const key = date.value.slice(0, 7);
    const current = months[months.length - 1];

    if (current?.key === key) {
      current.dates.push(date);
      return months;
    }

    months.push({
      key,
      label: `${date.year}년 ${date.month}`,
      dates: [date]
    });

    return months;
  }, []);
}

export function formatHour(hour: number) {
  return `${pad(hour)}:00`;
}

export function formatDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${KOREAN_WEEKDAYS[date.getDay()]})`;
}

export function canCancelReservation(reservationDate: string, startTime: number) {
  const now = getZonedDateParts(new Date());
  const todayKey = `${now.year}-${pad(now.month)}-${pad(now.day)}`;

  if (reservationDate > todayKey) {
    return true;
  }

  if (reservationDate < todayKey) {
    return false;
  }

  return startTime > now.hour;
}

export function canReserveReservation(reservationDate: string, startTime: number) {
  return canCancelReservation(reservationDate, startTime);
}

export function getNearestReservableHour(reservationDate: string) {
  for (let hour = 0; hour < 24; hour += 1) {
    if (canReserveReservation(reservationDate, hour)) {
      return hour;
    }
  }

  return 23;
}

export function getReservationStatus(
  reservationDate: string,
  startTime: number,
  endTime: number
) {
  const now = getZonedDateParts(new Date());
  const todayKey = `${now.year}-${pad(now.month)}-${pad(now.day)}`;

  if (reservationDate > todayKey) {
    return "upcoming" as const;
  }

  if (reservationDate < todayKey) {
    return "past" as const;
  }

  if (now.hour < startTime) {
    return "upcoming" as const;
  }

  if (now.hour >= endTime) {
    return "past" as const;
  }

  return "ongoing" as const;
}
