import { compare } from "bcryptjs";
import { NextResponse } from "next/server";

import {
  getFullNameValidationError,
  getPasswordValidationError,
} from "@/lib/authValidation";
import { prisma } from "@/lib/prisma";
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

type LoginPayload = {
  fullName?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginPayload | null;

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

  const user = await prisma.user.findUnique({
    where: { fullName },
    select: {
      id: true,
      fullName: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { message: "Пользователь не найден." },
      { status: 404 },
    );
  }

  const isPasswordCorrect = await compare(password, user.passwordHash);
  if (!isPasswordCorrect) {
    return NextResponse.json(
      { message: "Неверный пароль." },
      { status: 401 },
    );
  }

  const response = NextResponse.json(
    {
      message: "Вход выполнен успешно.",
      user: {
        id: user.id,
        fullName: user.fullName,
      },
    },
    { status: 200 },
  );

  response.cookies.set(USER_SESSION_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
