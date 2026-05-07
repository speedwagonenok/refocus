import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { saveAvatarFile } from "@/lib/doctorUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

const AVATAR_PUBLIC_URL = "/api/doctor/files/avatar";

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Выберите файл изображения." }, { status: 400 });
  }

  try {
    await saveAvatarFile(sessionUser.id, file);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_AVATAR_TYPE") {
      return NextResponse.json(
        { message: "Допустимо только фото в формате JPEG (.jpg или .jpeg)." },
        { status: 400 },
      );
    }
    if (code === "INVALID_AVATAR_SIZE") {
      return NextResponse.json({ message: "Файл фото слишком большой (максимум 5 МБ)." }, { status: 400 });
    }
    return NextResponse.json({ message: "Не удалось сохранить фото." }, { status: 500 });
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { avatarUrl: AVATAR_PUBLIC_URL },
  });

  return NextResponse.json({ message: "Фото обновлено.", avatarUrl: AVATAR_PUBLIC_URL }, { status: 200 });
}
