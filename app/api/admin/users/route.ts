import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import {
  getEmailValidationError,
  getFullNameValidationError,
  getPasswordValidationError,
  normalizeEmail,
} from "@/lib/authValidation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

type CreateEmployeePayload = {
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
};

function isAllowedEmployeeRole(role: unknown): role is Role {
  return role === Role.DOCTOR || role === Role.MANAGER || role === Role.SYSTEM_ADMIN;
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users }, { status: 200 });
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateEmployeePayload | null;
  if (!body?.fullName || !body?.email || !body?.password || !body?.role) {
    return NextResponse.json(
      { message: "Заполните ФИО, email, пароль и роль." },
      { status: 400 },
    );
  }

  if (!isAllowedEmployeeRole(body.role)) {
    return NextResponse.json(
      { message: "Для сотрудника выберите роль DOCTOR, MANAGER или SYSTEM_ADMIN." },
      { status: 400 },
    );
  }

  const fullNameError = getFullNameValidationError(body.fullName);
  if (fullNameError) {
    return NextResponse.json({ message: fullNameError }, { status: 400 });
  }

  const emailError = getEmailValidationError(body.email);
  if (emailError) {
    return NextResponse.json({ message: emailError }, { status: 400 });
  }

  const passwordError = getPasswordValidationError(body.password);
  if (passwordError) {
    return NextResponse.json({ message: passwordError }, { status: 400 });
  }

  const fullName = body.fullName.trim();
  const email = normalizeEmail(body.email);
  const passwordHash = await hash(body.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        role: body.role,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(
      { message: "Сотрудник успешно создан.", user },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Не удалось создать сотрудника. Такой email уже используется." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Не удалось создать сотрудника из-за ошибки сервера." },
      { status: 500 },
    );
  }
}
