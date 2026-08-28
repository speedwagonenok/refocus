import { AppointmentStatus } from "@prisma/client";

export function getAppointmentSlotEndMs(slotDateIso: string, endTime: string): number {
  const datePart = slotDateIso.length >= 10 ? slotDateIso.slice(0, 10) : slotDateIso;
  return new Date(`${datePart}T${endTime}:00`).getTime();
}

export function isAppointmentPast(
  slotDateIso: string,
  endTime: string,
  nowMs: number = Date.now(),
): boolean {
  return getAppointmentSlotEndMs(slotDateIso, endTime) < nowMs;
}

export function isActiveAppointmentStatus(status: AppointmentStatus): boolean {
  return status === AppointmentStatus.PENDING || status === AppointmentStatus.CONFIRMED;
}

const statusPriority: Record<AppointmentStatus, number> = {
  [AppointmentStatus.CONFIRMED]: 0,
  [AppointmentStatus.PENDING]: 1,
  [AppointmentStatus.CANCELLED]: 2,
};

/** Для одного слота выбираем актуальную запись: сначала подтверждённая/ожидающая, не отменённая. */
export function pickAppointmentForSlotDisplay<
  T extends { status: AppointmentStatus; createdAt: Date | string; id: number },
>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const sorted = [...items].sort((a, b) => {
    const byStatus = statusPriority[a.status] - statusPriority[b.status];
    if (byStatus !== 0) {
      return byStatus;
    }
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    return b.id - a.id;
  });

  return sorted[0] ?? null;
}

export function slotDateToIsoDate(slotDate: Date | string): string {
  if (typeof slotDate === "string") {
    return slotDate.length >= 10 ? slotDate.slice(0, 10) : slotDate;
  }
  return slotDate.toISOString().slice(0, 10);
}

/** Текст статуса для интерфейса (врач, пациент, менеджер). */
export function getAppointmentStatusLabelRu(
  status: AppointmentStatus,
  slotDateIso: string,
  endTime: string,
): string {
  if (status === AppointmentStatus.CONFIRMED) {
    return "подтверждён";
  }
  if (status === AppointmentStatus.CANCELLED) {
    return "отменён";
  }
  if (isAppointmentPast(slotDateIso, endTime)) {
    return "не подтверждён (время приёма прошло)";
  }
  return "ожидает подтверждения";
}
