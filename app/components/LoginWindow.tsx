"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  getEmailValidationError,
  getPasswordValidationError,
} from "@/lib/authValidation";

export default function LoginWindow() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const emailError = getEmailValidationError(email);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
            user?: {
              id: number;
              role: "PATIENT" | "DOCTOR" | "REGISTRAR" | "SYSTEM_ADMIN";
            };
          }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? "Не удалось авторизоваться.");
        return;
      }

      const loggedInUserId = data?.user?.id;
      if (!loggedInUserId) {
        setErrorMessage("Не удалось получить идентификатор пользователя.");
        return;
      }

      if (data.user?.role === "PATIENT") {
        router.push(`/user/${loggedInUserId}`);
        return;
      }

      router.push("/admin");
    } catch {
      setErrorMessage("Ошибка сети. Повторите попытку.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Вход</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <p className="pt-1 text-sm text-gray-600">
          Нет аккаунта?{" "}
          <Link
            href="/registrationPage"
            className="font-medium text-black underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Перейти к регистрации
          </Link>
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          {isSubmitting ? "Вход..." : "Войти"}
        </button>
      </form>
    </section>
  );
}
