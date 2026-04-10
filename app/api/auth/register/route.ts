import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import {
  getFullNameValidationError,
  getPasswordValidationError,
} from "@/lib/authValidation";
import { prisma } from "@/lib/prisma";

type RegisterPayload = {
  fullName?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RegisterPayload | null;

  if (!body?.fullName || !body?.password) {
    return NextResponse.json(
      { message: "Заполните ФИО и пароль." },
      { status: 400 },
    );
  }

  const fullName = body.fullName.trim();
  const password = body.password;

  const fullNameError = getFullNameValidationError(fullName);
  if (fullNameError) {
    return NextResponse.json(
      { message: fullNameError },
      { status: 400 },
    );
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return NextResponse.json(
      { message: passwordError },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { fullName },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { message: "Пользователь с таким ФИО уже зарегистрирован." },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      fullName,
      passwordHash,
    },
    select: {
      id: true,
      fullName: true,
    },
  });

  return NextResponse.json(
    {
      message: "Регистрация прошла успешно.",
      user,
    },
    { status: 201 },
  );
}
