import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { getPasswordValidationError } from "@/lib/authValidation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

type UpdatePasswordPayload = {
  password?: string;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const targetUserId = Number(id);
  if (!Number.isInteger(targetUserId) || targetUserId < 1) {
    return NextResponse.json({ message: "Некорректный ID пользователя." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as UpdatePasswordPayload | null;
  if (!body?.password) {
    return NextResponse.json({ message: "Введите новый пароль." }, { status: 400 });
  }

  const passwordError = getPasswordValidationError(body.password);
  if (passwordError) {
    return NextResponse.json({ message: passwordError }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  }

  const passwordHash = await hash(body.password, 12);
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  return NextResponse.json({ message: "Пароль успешно обновлен." }, { status: 200 });
}
