import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.MANAGER) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const rows = await prisma.appointment.findMany({
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      endTime: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      doctor: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      patient: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  const appointments = rows.map((row) => ({
    ...row,
    slotDate: row.slotDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({ appointments }, { status: 200 });
}
