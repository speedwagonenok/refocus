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

type RegisterPayload = {
  fullName?: string;
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RegisterPayload | null;

  if (!body?.fullName || !body?.email || !body?.password) {
    return NextResponse.json(
      { message: "Заполните ФИО, email и пароль." },
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
    await prisma.user.create({
      data: {
        fullName,
        email,
        role: Role.PATIENT,
        passwordHash,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Пользователь с таким email уже зарегистрирован." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json(
    { message: "Регистрация прошла успешно." },
    { status: 201 },
  );
}
