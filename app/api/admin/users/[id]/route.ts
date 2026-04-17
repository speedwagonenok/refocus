import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function DELETE(
  _req: Request,
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

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  }

  if (targetUser.role === Role.PATIENT) {
    return NextResponse.json(
      { message: "Удаление через эту кнопку доступно только для сотрудников." },
      { status: 400 },
    );
  }

  if (targetUser.id === sessionUser.id) {
    return NextResponse.json(
      { message: "Нельзя удалить свою учетную запись." },
      { status: 400 },
    );
  }

  if (targetUser.role === Role.SYSTEM_ADMIN) {
    const systemAdminCount = await prisma.user.count({
      where: { role: Role.SYSTEM_ADMIN },
    });
    if (systemAdminCount <= 1) {
      return NextResponse.json(
        { message: "В системе должен оставаться хотя бы один SYSTEM_ADMIN." },
        { status: 400 },
      );
    }
  }

  await prisma.user.delete({
    where: { id: targetUserId },
  });

  return NextResponse.json({ message: "Сотрудник удален." }, { status: 200 });
}
