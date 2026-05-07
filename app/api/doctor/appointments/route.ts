import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: sessionUser.id },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      endTime: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({ appointments }, { status: 200 });
}
