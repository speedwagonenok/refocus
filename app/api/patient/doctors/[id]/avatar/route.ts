import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { readAvatarFile } from "@/lib/doctorUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const { id } = await params;
  const doctorId = Number(id);
  if (!Number.isInteger(doctorId) || doctorId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор." }, { status: 400 });
  }

  const doctor = await prisma.user.findFirst({
    where: { id: doctorId, role: Role.DOCTOR },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }

  const fromDisk = await readAvatarFile(doctorId);
  if (fromDisk) {
    const mime = MIME[fromDisk.ext.toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(fromDisk.buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return NextResponse.json({ message: "Фото не найдено." }, { status: 404 });
}
