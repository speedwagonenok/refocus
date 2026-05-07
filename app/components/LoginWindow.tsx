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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
              role: "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";
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
          <div className="relative">
            <input
              id="password"
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Введите пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 outline-none transition focus:border-black"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-gray-600 transition hover:text-gray-800"
            >
              {isPasswordVisible ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.73-1.73 1.86-3.31 3.22-4.61" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a11.84 11.84 0 0 1-1.56 2.83" />
                  <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <p className="pt-1 text-sm text-gray-600">
          Нет аккаунта?{" "}
          <Link
            href="/registrationPage"
            className="font-semibold text-[#21486b] underline decoration-[#21486b]/35 underline-offset-2 transition hover:text-[#1a3a57] hover:decoration-[#1a3a57]"
          >
            Перейти к регистрации
          </Link>
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-md bg-[#21486b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a3a57] hover:shadow active:bg-[#16314a] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-[#21486b] disabled:hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21486b]/45"
        >
          {isSubmitting ? "Вход..." : "Войти"}
        </button>
      </form>
    </section>
  );
}
