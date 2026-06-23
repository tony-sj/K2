const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type DateOption = {
  value: string;
  weekday: string;
  day: string;
  month: string;
  isToday: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getDateOptions(days = 14): DateOption[] {
  const today = new Date();
  const todayKey = toDateKey(today);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() + index);

    return {
      value: toDateKey(date),
      weekday: KOREAN_WEEKDAYS[date.getDay()],
      day: String(date.getDate()),
      month: `${date.getMonth() + 1}월`,
      isToday: toDateKey(date) === todayKey
    };
  });
}

export function formatHour(hour: number) {
  return `${pad(hour)}:00`;
}
