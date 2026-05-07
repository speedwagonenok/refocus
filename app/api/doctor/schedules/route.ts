import { AppointmentStatus, Role, Weekday } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSlotDateIso, type WeekdayValue } from "@/lib/scheduleTime";
import { getSessionUser } from "@/lib/sessionUser";

type ScheduleRow = {
  id: number;
  weekStartDate: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  appointment: {
    id: number;
    status: AppointmentStatus;
    patient: {
      id: number;
      fullName: string;
      email: string;
    };
  } | null;
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function weekdayToValue(w: Weekday): WeekdayValue {
  return w as WeekdayValue;
}

export async function GET(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const weekStartDate = searchParams.get("weekStartDate");
  if (!weekStartDate || !isIsoDate(weekStartDate)) {
    return NextResponse.json({ message: "Некорректная неделя." }, { status: 400 });
  }

  const schedules = await prisma.doctorSchedule.findMany({
    where: {
      doctorId: sessionUser.id,
      weekStartDate: new Date(weekStartDate),
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      weekStartDate: true,
      weekday: true,
      startTime: true,
      endTime: true,
    },
  });
  const weekStart = new Date(`${weekStartDate}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: sessionUser.id,
      slotDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      endTime: true,
      status: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
  const appointmentBySlot = new Map<
    string,
    {
      id: number;
      status: AppointmentStatus;
      patient: {
        id: number;
        fullName: string;
        email: string;
      };
    }
  >();
  for (const item of appointments) {
    const key = `${item.slotDate.toISOString().slice(0, 10)}|${item.startTime}|${item.endTime}`;
    if (appointmentBySlot.has(key)) {
      continue;
    }
    appointmentBySlot.set(key, {
      id: item.id,
      status: item.status,
      patient: item.patient,
    });
  }

  const normalized: ScheduleRow[] = schedules.map((item) => ({
    weekStartDate: item.weekStartDate.toISOString().slice(0, 10),
    id: item.id,
    weekday: item.weekday,
    startTime: item.startTime,
    endTime: item.endTime,
    appointment:
      appointmentBySlot.get(
        `${getSlotDateIso(
          item.weekStartDate.toISOString().slice(0, 10),
          weekdayToValue(item.weekday),
        )}|${item.startTime}|${item.endTime}`,
      ) ?? null,
  }));

  return NextResponse.json({ schedules: normalized }, { status: 200 });
}
