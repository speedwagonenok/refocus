import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { readAvatarFile } from "@/lib/doctorUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const fromDisk = await readAvatarFile(sessionUser.id);
  if (fromDisk) {
    const mime = MIME[fromDisk.ext.toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(fromDisk.buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { avatarUrl: true },
  });
  const legacy = user?.avatarUrl?.trim();
  if (legacy && /^https?:\/\//i.test(legacy)) {
    return NextResponse.redirect(legacy);
  }

  return NextResponse.json({ message: "Фото не найдено." }, { status: 404 });
}
