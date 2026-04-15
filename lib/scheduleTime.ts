export type WeekdayValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const CLINIC_OPEN_TIME = "10:00";
export const CLINIC_CLOSE_TIME = "21:00";
export const MAX_SLOT_DURATION_MINUTES = 60;

const weekdayOffset: Record<WeekdayValue, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayLocalIsoDate(): string {
  return formatDateLocal(new Date());
}

export function getCurrentLocalTimeHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateLocal(date);
}

export function getSlotDateIso(weekStartDateIso: string, weekday: WeekdayValue): string {
  return addDaysToIsoDate(weekStartDateIso, weekdayOffset[weekday]);
}

export function isWithinClinicHours(startTime: string, endTime: string): boolean {
  return (
    timeToMinutes(startTime) >= timeToMinutes(CLINIC_OPEN_TIME) &&
    timeToMinutes(endTime) <= timeToMinutes(CLINIC_CLOSE_TIME)
  );
}

export function isSlotDurationValid(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) - timeToMinutes(startTime) <= MAX_SLOT_DURATION_MINUTES;
}

export function getAutoEndForStart(startTime: string): string {
  const openMinutes = timeToMinutes(CLINIC_OPEN_TIME);
  const closeMinutes = timeToMinutes(CLINIC_CLOSE_TIME);
  const startMinutes = clamp(timeToMinutes(startTime), openMinutes, closeMinutes);
  const endMinutes = clamp(startMinutes + MAX_SLOT_DURATION_MINUTES, openMinutes, closeMinutes);
  return minutesToTime(endMinutes);
}

export function getAutoStartForEnd(endTime: string): string {
  const openMinutes = timeToMinutes(CLINIC_OPEN_TIME);
  const closeMinutes = timeToMinutes(CLINIC_CLOSE_TIME);
  const endMinutes = clamp(timeToMinutes(endTime), openMinutes, closeMinutes);
  const startMinutes = clamp(endMinutes - MAX_SLOT_DURATION_MINUTES, openMinutes, closeMinutes);
  return minutesToTime(startMinutes);
}
