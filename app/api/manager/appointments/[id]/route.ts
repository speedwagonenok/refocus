import { AppointmentStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

type UpdateAppointmentPayload = {
  action?: "confirm" | "cancel";
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.MANAGER) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isInteger(appointmentId) || appointmentId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор записи." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as UpdateAppointmentPayload | null;
  if (!body?.action || (body.action !== "confirm" && body.action !== "cancel")) {
    return NextResponse.json({ message: "Некорректное действие." }, { status: 400 });
  }

  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Запись не найдена." }, { status: 404 });
  }

  if (body.action === "cancel") {
    if (existing.status === AppointmentStatus.CANCELLED) {
      return NextResponse.json({ message: "Запись уже отменена." }, { status: 200 });
    }
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED },
    });
    return NextResponse.json({ message: "Запись отменена." }, { status: 200 });
  }

  if (existing.status === AppointmentStatus.CONFIRMED) {
    return NextResponse.json({ message: "Запись уже подтверждена." }, { status: 200 });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: AppointmentStatus.CONFIRMED },
  });

  return NextResponse.json({ message: "Запись подтверждена." }, { status: 200 });
}
