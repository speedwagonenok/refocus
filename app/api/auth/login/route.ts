import { compare } from "bcryptjs";
import { NextResponse } from "next/server";

import {
  getEmailValidationError,
  getPasswordValidationError,
  normalizeEmail,
} from "@/lib/authValidation";
import { prisma } from "@/lib/prisma";
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginPayload | null;

  if (!body) {
    return NextResponse.json(
      { message: "Некорректный запрос." },
      { status: 400 },
    );
  }

  if (typeof body.email !== "string") {
    return NextResponse.json(
      { message: "Введите email." },
      { status: 400 },
    );
  }

  const emailError = getEmailValidationError(body.email);
  if (emailError) {
    return NextResponse.json({ message: emailError }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string") {
    return NextResponse.json(
      { message: "Введите пароль." },
      { status: 400 },
    );
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return NextResponse.json({ message: passwordError }, { status: 400 });
  }

  const email = normalizeEmail(body.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
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
        email: user.email,
        role: user.role,
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
